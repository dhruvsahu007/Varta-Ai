import { config as loadEnv } from "dotenv";
loadEnv();

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

// Initialize AWS Bedrock with proper error handling
let bedrockClient: BedrockRuntimeClient | null = null;
try {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || "us-east-1";
  
  if (!accessKeyId || !secretAccessKey) {
    console.warn('⚠️  AWS credentials not set - embeddings will be disabled');
  } else {
    bedrockClient = new BedrockRuntimeClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    console.log("[Bedrock Embeddings] Successfully initialized with AWS credentials");
  }
} catch (error) {
  console.error("[Bedrock Embeddings] Initialization error:", error);
  bedrockClient = null;
}

// Default embedding model - Amazon Titan Embeddings G1 - Text
const EMBEDDING_MODEL = 'amazon.titan-embed-text-v1'; // 1536 dimensions, cost-effective
const MAX_INPUT_LENGTH = 8000; // Character limit for embedding input

export interface EmbeddingResult {
  embedding: number[];
  inputText: string;
  tokenCount: number;
  model: string;
}

/**
 * Generate embeddings for a given text using AWS Bedrock Titan model
 */
export async function generateEmbedding(text: string, model: string = EMBEDDING_MODEL): Promise<EmbeddingResult | null> {
  try {
    if (!bedrockClient) {
      console.warn('[EmbeddingsService] Bedrock not configured - skipping embedding generation');
      return null;
    }

    if (!text || text.trim().length === 0) {
      console.warn('[EmbeddingsService] Empty text provided');
      return null;
    }

    // Truncate text if too long
    const inputText = text.length > MAX_INPUT_LENGTH 
      ? text.substring(0, MAX_INPUT_LENGTH) + '...' 
      : text;

    console.log(`[EmbeddingsService] Generating embedding for text (${inputText.length} chars) using Bedrock Titan`);
    
    const input = {
      modelId: model,
      contentType: "application/json",
      body: JSON.stringify({
        inputText: inputText
      })
    };

    const command = new InvokeModelCommand(input);
    const response = await bedrockClient.send(command);
    
    if (!response.body) {
      throw new Error('No embedding data returned from Bedrock');
    }

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (!responseBody.embedding) {
      throw new Error('No embedding in Bedrock response');
    }

    const result: EmbeddingResult = {
      embedding: responseBody.embedding,
      inputText,
      tokenCount: responseBody.inputTextTokenCount || 0,
      model: model,
    };

    console.log(`✅ Generated embedding: ${result.embedding.length} dimensions, ${result.tokenCount} tokens`);
    return result;

  } catch (error: any) {
    console.error('❌ Error generating embedding:', error.message);
    
    // Handle specific Bedrock errors
    if (error.name === 'ValidationException') {
      console.error('Invalid input for embedding generation');
    } else if (error.name === 'AccessDeniedException') {
      console.error('Access denied - check AWS credentials and permissions');
    } else if (error.name === 'ThrottlingException') {
      console.error('Rate limit exceeded - consider reducing embedding requests');
    }
    
    return null;
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts: string[], model: string = EMBEDDING_MODEL): Promise<(EmbeddingResult | null)[]> {
  try {
    if (!bedrockClient) {
      console.warn('[EmbeddingsService] Bedrock not configured - skipping batch embedding generation');
      return texts.map(() => null);
    }

    if (!texts || texts.length === 0) {
      return [];
    }

    console.log(`[EmbeddingsService] Generating embeddings for ${texts.length} texts using Bedrock Titan`);
    
    // Process texts (truncate if needed)
    const processedTexts = texts.map(text => {
      if (!text || text.trim().length === 0) return '';
      return text.length > MAX_INPUT_LENGTH 
        ? text.substring(0, MAX_INPUT_LENGTH) + '...' 
        : text;
    }).filter(text => text.length > 0);

    if (processedTexts.length === 0) {
      console.warn('[EmbeddingsService] No valid texts provided for batch processing');
      return texts.map(() => null);
    }

    // Bedrock Titan doesn't support batch processing, so we'll process one by one
    const results: (EmbeddingResult | null)[] = [];
    let textIndex = 0;

    for (let i = 0; i < texts.length; i++) {
      const originalText = texts[i];
      
      if (!originalText || originalText.trim().length === 0) {
        results.push(null);
      } else {
        try {
          const result = await generateEmbedding(processedTexts[textIndex]);
          results.push(result);
          textIndex++;
          
          // Add small delay between requests to avoid rate limiting
          if (textIndex < processedTexts.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.error(`Error generating embedding for text ${i}:`, error);
          results.push(null);
          textIndex++;
        }
      }
    }

    console.log(`✅ Generated ${results.filter(r => r !== null).length} embeddings successfully`);
    return results;

  } catch (error: any) {
    console.error('❌ Error generating batch embeddings:', error.message);
    return texts.map(() => null);
  }
}

/**
 * Generate embedding for search queries (with query optimization)
 */
export async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  try {
    // Optimize query text for better search results
    const optimizedQuery = query.trim();
    
    if (optimizedQuery.length === 0) {
      console.warn('[EmbeddingsService] Empty query provided');
      return null;
    }

    const result = await generateEmbedding(optimizedQuery);
    return result ? result.embedding : null;

  } catch (error: any) {
    console.error('❌ Error generating query embedding:', error.message);
    return null;
  }
}

/**
 * Check if embeddings service is available
 */
export function isEmbeddingsAvailable(): boolean {
  return bedrockClient !== null;
}

/**
 * Get embedding model info
 */
export function getEmbeddingModelInfo() {
  return {
    model: EMBEDDING_MODEL,
    dimensions: 1536, // Amazon Titan Embeddings G1 - Text produces 1536 dimensional vectors
    maxInputLength: MAX_INPUT_LENGTH,
    isAvailable: isEmbeddingsAvailable(),
    provider: 'AWS Bedrock (Titan)',
  };
}
