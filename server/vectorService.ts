import { config as loadEnv } from "dotenv";
loadEnv();

import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';

// Environment variables validation
if (!process.env.OPENSEARCH_ENDPOINT) {
  throw new Error('OPENSEARCH_ENDPOINT environment variable is required');
}

if (!process.env.AWS_REGION) {
  throw new Error('AWS_REGION environment variable is required');
}

const OPENSEARCH_ENDPOINT = process.env.OPENSEARCH_ENDPOINT;
const AWS_REGION = process.env.AWS_REGION;
const INDEX_NAME = 'varta-vectors'; // Default index name

interface VectorMetadata {
  [key: string]: any;
}

interface SearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
  embedding?: number[];
}

class OpenSearchVectorService {
  private signer: SignatureV4;
  private credentialsProvider: any;

  constructor() {
    this.credentialsProvider = fromNodeProviderChain();
    this.signer = new SignatureV4({
      service: 'aoss', // Amazon OpenSearch Serverless
      region: AWS_REGION,
      credentials: this.credentialsProvider,
      sha256: Sha256,
    });
  }

  /**
   * Signs and sends HTTP request to OpenSearch Serverless
   */
  private async makeSignedRequest(
    method: string,
    path: string,
    body?: string,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const url = new URL(path, OPENSEARCH_ENDPOINT);
    
    const request = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'host': url.hostname,
        ...headers,
      },
      hostname: url.hostname,
      path: url.pathname + url.search,
      protocol: url.protocol,
      body: body || '',
    };

    // Sign the request with SigV4
    const signedRequest = await this.signer.sign(request);
    
    // Make the HTTP request
    const response = await fetch(url.toString(), {
      method,
      headers: signedRequest.headers as Record<string, string>,
      body: body || undefined,
    });

    return response;
  }

  /**
   * Ensures the vector index exists with proper mapping
   */
  private async ensureIndex(): Promise<void> {
    try {
      // Check if index exists
      const existsResponse = await this.makeSignedRequest('HEAD', `/${INDEX_NAME}`);
      
      if (existsResponse.status === 404) {
        console.log(`Creating OpenSearch index: ${INDEX_NAME}`);
        
        // Create index with vector field mapping
        const indexMapping = {
          mappings: {
            properties: {
              embedding: {
                type: 'knn_vector',
                dimension: 1536, // Default for OpenAI embeddings, adjust as needed
                method: {
                  name: 'hnsw',
                  space_type: 'cosinesimil',
                  engine: 'faiss',
                  parameters: {
                    ef_construction: 128,
                    m: 24
                  }
                }
              },
              metadata: {
                type: 'object',
                enabled: true
              },
              timestamp: {
                type: 'date'
              }
            }
          },
          settings: {
            'index.knn': true,
            'index.knn.algo_param.ef_search': 100
          }
        };

        const createResponse = await this.makeSignedRequest(
          'PUT',
          `/${INDEX_NAME}`,
          JSON.stringify(indexMapping)
        );

        if (!createResponse.ok) {
          const error = await createResponse.text();
          throw new Error(`Failed to create index: ${error}`);
        }

        console.log(`✅ Created OpenSearch index: ${INDEX_NAME}`);
      }
    } catch (error) {
      console.error('Error ensuring index exists:', error);
      throw error;
    }
  }

  /**
   * Insert a vector with metadata into OpenSearch
   */
  async insertVector(id: string, embedding: number[], metadata: VectorMetadata = {}): Promise<void> {
    try {
      console.log(`[VectorService] Inserting vector with ID: ${id}`);
      
      // Ensure index exists
      await this.ensureIndex();

      const document = {
        embedding,
        metadata: {
          ...metadata,
          id, // Store the ID in metadata as well
        },
        timestamp: new Date().toISOString(),
      };

      const response = await this.makeSignedRequest(
        'PUT',
        `/${INDEX_NAME}/_doc/${id}`,
        JSON.stringify(document)
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to insert vector: ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Vector inserted successfully: ${result._id}`);
      
    } catch (error) {
      console.error(`❌ Error inserting vector ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search for similar vectors using k-NN
   */
  async searchVector(queryEmbedding: number[], k: number = 10): Promise<SearchResult[]> {
    try {
      console.log(`[VectorService] Searching for ${k} similar vectors`);
      
      const searchQuery = {
        size: k,
        query: {
          knn: {
            embedding: {
              vector: queryEmbedding,
              k: k,
            }
          }
        },
        _source: ['metadata', 'timestamp'], // Don't return embeddings by default
      };

      const response = await this.makeSignedRequest(
        'POST',
        `/${INDEX_NAME}/_search`,
        JSON.stringify(searchQuery)
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Search failed: ${error}`);
      }

      const result = await response.json();
      
      if (!result.hits || !result.hits.hits) {
        console.warn('No search results returned');
        return [];
      }

      const searchResults: SearchResult[] = result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        metadata: hit._source?.metadata || {},
      }));

      console.log(`✅ Found ${searchResults.length} similar vectors`);
      return searchResults;

    } catch (error) {
      console.error('❌ Error searching vectors:', error);
      throw error;
    }
  }

  /**
   * Delete a vector by ID
   */
  async deleteVector(id: string): Promise<void> {
    try {
      console.log(`[VectorService] Deleting vector with ID: ${id}`);
      
      const response = await this.makeSignedRequest('DELETE', `/${INDEX_NAME}/_doc/${id}`);
      
      if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`Failed to delete vector: ${error}`);
      }

      console.log(`✅ Vector deleted successfully: ${id}`);
      
    } catch (error) {
      console.error(`❌ Error deleting vector ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get vector by ID
   */
  async getVector(id: string, includeEmbedding: boolean = false): Promise<SearchResult | null> {
    try {
      const source = includeEmbedding ? ['metadata', 'embedding', 'timestamp'] : ['metadata', 'timestamp'];
      
      const response = await this.makeSignedRequest(
        'GET', 
        `/${INDEX_NAME}/_doc/${id}?_source=${source.join(',')}`
      );
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get vector: ${error}`);
      }

      const result = await response.json();
      
      return {
        id: result._id,
        score: 1.0, // Perfect match since it's the exact document
        metadata: result._source?.metadata || {},
        ...(includeEmbedding && { embedding: result._source?.embedding }),
      };
      
    } catch (error) {
      console.error(`❌ Error getting vector ${id}:`, error);
      throw error;
    }
  }
}

// Create singleton instance
const vectorService = new OpenSearchVectorService();

// Export the main functions
export const insertVector = (id: string, embedding: number[], metadata: VectorMetadata = {}) =>
  vectorService.insertVector(id, embedding, metadata);

export const searchVector = (queryEmbedding: number[], k: number = 10) =>
  vectorService.searchVector(queryEmbedding, k);

// Export additional utility functions
export const deleteVector = (id: string) => vectorService.deleteVector(id);
export const getVector = (id: string, includeEmbedding: boolean = false) =>
  vectorService.getVector(id, includeEmbedding);

// Export types
export type { VectorMetadata, SearchResult };

// Export the service instance for advanced usage
export { vectorService };
