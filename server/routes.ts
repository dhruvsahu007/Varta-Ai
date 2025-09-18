import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import rateLimit from "express-rate-limit";
import { 
  insertChannelSchema, 
  insertMessageSchema,
  insertMeetingNotesSchema,
  messages,
  channels,
  users
} from "@shared/schema";
import { 
  analyzeTone, 
  generateReply, 
  queryOrgMemory, 
  generateMeetingNotes 
} from "./ai";
import { db } from "./db";
import { eq, sql, inArray } from "drizzle-orm";
import { generateEmbedding, generateQueryEmbedding } from "./embeddingsService";
import { insertVector, searchVector } from "./vectorService";
import type { Message, User } from "@shared/schema";

/**
 * Process message embedding and store in vector database
 */
async function processMessageEmbedding(message: Message & { author: User }, content: string): Promise<void> {
  try {
    console.log(`[VectorProcessing] Processing embeddings for message ${message.id}`);
    
    // Generate embedding for the message content
    const embeddingResult = await generateEmbedding(content);
    
    if (!embeddingResult) {
      console.warn(`[VectorProcessing] Failed to generate embedding for message ${message.id}`);
      return;
    }
    
    // Prepare metadata for the vector
    const metadata = {
      messageId: message.id,
      content: content,
      authorId: message.authorId,
      authorName: message.author.displayName,
      authorUsername: message.author.username,
      channelId: message.channelId,
      recipientId: message.recipientId, // For DMs
      createdAt: message.createdAt?.toISOString() || new Date().toISOString(),
      type: message.channelId ? 'channel_message' : 'direct_message',
      tokenCount: embeddingResult.tokenCount,
      embeddingModel: embeddingResult.model,
    };
    
    // Insert vector into OpenSearch
    const vectorId = `message_${message.id}`;
    await insertVector(vectorId, embeddingResult.embedding, metadata);
    
    console.log(`✅ Successfully processed embeddings for message ${message.id}`);
    
  } catch (error) {
    console.error(`❌ Error processing embeddings for message ${message.id}:`, error);
    // Don't throw - this is a background process and shouldn't affect message creation
  }
}

export function registerRoutes(app: Express): Server {
  // Rate limiting for AI endpoints
  const aiRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many AI requests, please try again later.',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Setup authentication routes
  setupAuth(app);

  // Health check endpoint for Docker
  app.get("/api/health", (req, res) => {
    res.status(200).json({ 
      status: "healthy", 
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  });

  // Channels
  app.get("/api/channels", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch channels" });
    }
  });

  app.get("/api/channels/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channel = await storage.getChannel(parseInt(req.params.id));
      if (!channel) return res.sendStatus(404);
      res.json(channel);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch channel" });
    }
  });

  app.post("/api/channels", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channelData = insertChannelSchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      
      const channel = await storage.createChannel(channelData);
      res.status(201).json(channel);
    } catch (error) {
      res.status(400).json({ message: "Invalid channel data" });
    }
  });

  app.get("/api/channels/:id/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channelId = parseInt(req.params.id);
      const messages = await storage.getChannelMessages(channelId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.get("/api/channels/:id/members", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channelId = parseInt(req.params.id);
      const members = await storage.getChannelMembers(channelId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  app.post("/api/channels/:id/join", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channelId = parseInt(req.params.id);
      await storage.addChannelMember(channelId, req.user!.id);
      res.sendStatus(200);
    } catch (error) {
      res.status(500).json({ message: "Failed to join channel" });
    }
  });

  // Messages
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      console.log("[Messages] Raw request body:", req.body);
      
      const messageData = insertMessageSchema.parse({
        ...req.body,
        authorId: req.user!.id
      });
      
      console.log("[Messages] Parsed message data:", messageData);

      const message = await storage.createMessage(messageData);
      
      console.log("[Messages] Created message:", message);
      
      // Background processing: tone analysis, embeddings, and vector storage
      if (messageData.content) {
        const contentStr = Array.isArray(messageData.content) 
          ? messageData.content.join(' ') 
          : String(messageData.content);
          
        // Run background tasks asynchronously (don't await)
        Promise.allSettled([
          // Tone analysis
          analyzeTone(contentStr).then(analysis => {
            console.log("Tone analysis:", analysis);
          }),
          
          // Generate embeddings and store in vector database
          processMessageEmbedding(message, contentStr)
        ]).catch(console.error);
      }

      res.status(201).json(message);
    } catch (error) {
      console.error("[Messages] Error creating message:", error);
      res.status(400).json({ message: "Invalid message data" });
    }
  });

  app.get("/api/messages/:id/thread", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const messageId = parseInt(req.params.id);
      const thread = await storage.getMessageThread(messageId);
      res.json(thread);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch thread" });
    }
  });

  app.get("/api/direct-messages/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const otherUserId = parseInt(req.params.userId);
      console.log(`[DirectMessages] Fetching DMs between user ${req.user!.id} and user ${otherUserId}`);
      
      const messages = await storage.getDirectMessages(req.user!.id, otherUserId);
      console.log(`[DirectMessages] Found ${messages.length} messages:`, messages);
      
      res.json(messages);
    } catch (error) {
      console.error("[DirectMessages] Error fetching direct messages:", error);
      res.status(500).json({ message: "Failed to fetch direct messages" });
    }
  });

  app.get("/api/direct-message-users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const users = await storage.getDirectMessageUsers(req.user!.id);
      res.json(users);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch DM users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // AI Features (with rate limiting)
  app.post("/api/ai/suggest-reply", aiRateLimit, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { messageContent, threadContext = [], orgContext = "", messageId = null, generateMultiple = false } = req.body;
      
      if (!messageContent || typeof messageContent !== 'string') {
        return res.status(400).json({ 
          message: "Invalid message content",
          details: "Message content is required and must be a string" 
        });
      }

      // Validate thread context is an array of strings
      if (!Array.isArray(threadContext) || !threadContext.every(msg => typeof msg === 'string')) {
        return res.status(400).json({ 
          message: "Invalid thread context",
          details: "Thread context must be an array of strings" 
        });
      }

      // Get channel info if orgContext contains a channel ID
      let enhancedOrgContext = orgContext;
      if (orgContext.startsWith('Channel:')) {
        const channelId = parseInt(orgContext.split(':')[1].trim());
        if (!isNaN(channelId)) {
          try {
            const channel = await storage.getChannel(channelId);
            if (channel) {
              enhancedOrgContext = `Channel: ${channel.name}\nDescription: ${channel.description || 'No description'}`;
            }
          } catch (error) {
            console.error("[API] Failed to fetch channel info:", error);
          }
        }
      }

      console.log("[API] Generating reply for message:", {
        contentLength: messageContent.length,
        threadContextLength: threadContext.length,
        orgContextLength: enhancedOrgContext.length,
        generateMultiple
      });
      
      // Generate reply based on message content
      const suggestion = await generateReply(
        messageContent,
        threadContext,
        enhancedOrgContext,
        generateMultiple
      );

      // Only store in database if messageId is provided (i.e., not from AI modal)
      if (messageId) {
        try {
          // Store only the first suggestion in the database
          await storage.createAiSuggestion({
            messageId,
            suggestedReply: suggestion.suggestions[0].suggestedReply,
            confidence: suggestion.suggestions[0].confidence,
            reasoning: suggestion.suggestions[0].reasoning
          });
        } catch (dbError) {
          console.error("[API] Failed to store AI suggestion:", dbError);
          // Don't fail the request if storage fails
        }
      }

      res.json(suggestion);
    } catch (error) {
      console.error("[API] Error generating reply:", error);
      res.status(500).json({ 
        message: "Failed to generate reply",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/ai/analyze-tone", aiRateLimit, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { content } = req.body;
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ 
          message: "Invalid content",
          details: "Content is required and must be a string" 
        });
      }

      console.log("[API] Analyzing tone for content:", content.substring(0, 50) + "...");
      
      const analysis = await analyzeTone(content);
      res.json(analysis);
    } catch (error) {
      console.error("[API] Tone analysis error:", error);
      res.status(500).json({ 
        message: "Failed to analyze tone",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Debug endpoint for org memory
  app.get("/api/debug/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const messageCount = await db.select({}).from(messages);
      const channelCount = await db.select({}).from(channels);
      const userCount = await db.select({}).from(users);
      
      const sampleMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          channelId: messages.channelId,
          recipientId: messages.recipientId,
          authorName: users.displayName,
          channelName: channels.name
        })
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .leftJoin(channels, eq(messages.channelId, channels.id))
        .limit(10);

      res.json({
        messageCount: messageCount.length,
        channelCount: channelCount.length,
        userCount: userCount.length,
        sampleMessages
      });
    } catch (error) {
      console.error("[DEBUG] Error fetching debug info:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  app.post("/api/ai/org-memory", aiRateLimit, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { query } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ 
          message: "Invalid query",
          details: "Query is required and must be a string" 
        });
      }

      console.log("[API] Searching organizational memory for:", query);
      
      let relevantMessages = [];
      
      // Try vector search first (if embeddings are available)
      try {
        const queryEmbedding = await generateQueryEmbedding(query);
        if (queryEmbedding) {
          console.log("[API] Using vector search for semantic results");
          const vectorResults = await searchVector(queryEmbedding, 10);
          
          if (vectorResults.length > 0) {
            console.log("[API] Found", vectorResults.length, "vector search results");
            
            // Convert vector results to message format
            const messageIds = vectorResults
              .filter(result => result.metadata.messageId)
              .map(result => parseInt(result.metadata.messageId));
            
            if (messageIds.length > 0) {
              // Fetch full message details from database
              const vectorMessages = await db
                .select({
                  id: messages.id,
                  content: messages.content,
                  authorId: messages.authorId,
                  channelId: messages.channelId,
                  parentMessageId: messages.parentMessageId,
                  recipientId: messages.recipientId,
                  aiAnalysis: messages.aiAnalysis,
                  createdAt: messages.createdAt,
                  updatedAt: messages.updatedAt,
                  author: users,
                  channel: channels,
                })
                .from(messages)
                .innerJoin(users, eq(messages.authorId, users.id))
                .leftJoin(channels, eq(messages.channelId, channels.id))
                .where(inArray(messages.id, messageIds));
              
              relevantMessages = vectorMessages;
              console.log("[API] Retrieved", relevantMessages.length, "messages from vector search");
            }
          }
        }
      } catch (vectorError) {
        console.warn("[API] Vector search failed, falling back to text search:", vectorError.message);
        console.warn("[API] Vector search error details:", vectorError);
      }
      
      // Fallback to traditional text search if vector search didn't work or found no results
      if (relevantMessages.length === 0) {
        console.log("[API] Using traditional text search");
        try {
          relevantMessages = await storage.searchMessages(query);
          console.log("[API] Found", relevantMessages.length, "text search results");
        } catch (textSearchError) {
          console.error("[API] Text search also failed:", textSearchError);
          return res.status(500).json({
            message: "Both vector and text search failed",
            details: "Unable to search organizational memory"
          });
        }
      }
      
      if (relevantMessages.length === 0) {
        console.warn("[API] No messages found for query, returning empty result");
        return res.json({
          query,
          summary: "No relevant messages found for your query. This could mean: 1) The search terms don't match any existing messages, 2) There are no messages in the database yet, or 3) All messages are in private channels or direct messages.",
          sources: [],
          keyPoints: ["Try using different keywords", "Check if there are any messages in public channels", "Verify that the database has been seeded with sample data", "Make sure OPENAI_API_KEY is set for semantic search"]
        });
      }

      const formattedMessages = relevantMessages.map(msg => ({
        content: msg.content,
        channelName: msg.channel?.name || "Direct Message",
        authorName: msg.author.displayName,
        timestamp: msg.createdAt.toISOString()
      }));

      console.log("[API] Formatted messages for AI:", formattedMessages.slice(0, 2));

      const result = await queryOrgMemory(query, formattedMessages);
      console.log("[API] Successfully processed org memory query");
      
      res.json(result);
    } catch (error) {
      console.error("[API] Org memory error:", error);
      res.status(500).json({ 
        message: "Failed to query organizational memory",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.post("/api/ai/generate-notes", aiRateLimit, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { channelId } = req.body;
      
      if (!channelId || typeof channelId !== 'number') {
        return res.status(400).json({ 
          message: "Invalid channel ID",
          details: "Channel ID must be a number"
        });
      }

      console.log("[API] Generating meeting notes for channel:", channelId);
      
      // Get channel info
      const channel = await storage.getChannel(channelId);
      if (!channel) {
        return res.status(404).json({ 
          message: "Channel not found",
          details: "The specified channel does not exist"
        });
      }

      // Get recent messages (last 50)
      const messages = await storage.getChannelMessages(channelId, 50);
      if (!messages.length) {
        return res.status(400).json({
          message: "No messages found",
          details: "The channel has no messages to generate notes from"
        });
      }
      
      console.log("[API] Found", messages.length, "messages for meeting notes");

      // Format messages for the AI
      const formattedMessages = messages.map(msg => ({
        content: msg.content,
        authorName: msg.author.displayName,
        timestamp: msg.createdAt.toISOString()
      }));

      // Generate notes
      const notes = await generateMeetingNotes(formattedMessages, channel.name);
      
      // Save the notes
      const savedNotes = await storage.createMeetingNotes({
        title: notes.title,
        content: JSON.stringify(notes),
        channelId,
        startMessageId: messages[0].id,
        endMessageId: messages[messages.length - 1].id,
        generatedBy: req.user!.id
      });

      console.log("[API] Successfully generated and saved meeting notes");
      res.json({ ...notes, id: savedNotes.id });

    } catch (error) {
      console.error("[API] Meeting notes generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate meeting notes",
        details: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  app.get("/api/channels/:id/notes", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const channelId = parseInt(req.params.id);
      const notes = await storage.getMeetingNotes(channelId);
      res.json(notes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch meeting notes" });
    }
  });

  // Search
  app.get("/api/search", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    try {
      const { q: query, channelId } = req.query;
      if (!query) return res.json([]);
      
      const results = await storage.searchMessages(
        query as string, 
        channelId ? parseInt(channelId as string) : undefined
      );
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Test route for complete message embedding flow
  app.post("/test-message", async (req, res) => {
    try {
      console.log("[TestRoute] Starting complete message embedding flow test...");
      
      // Sample messages to test with
      const sampleMessages = [
        "The Atlas Project kickoff meeting is scheduled for next Tuesday at 2:00 PM. We'll discuss the new AI integration features and roadmap.",
        "User research findings show that 78% of users want better search functionality and 65% need improved collaboration tools.",
        "Great work on the Atlas Project demo today! The stakeholders were impressed. Beta release target is end of month.",
        "Anyone up for a coffee chat at 3 PM? Let's discuss the new project requirements and technical specifications.",
        "Important: All hands meeting tomorrow at 10 AM. We'll cover Q4 goals, budget planning, and project timelines."
      ];
      
      const randomMessage = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
      console.log("[TestRoute] Sample message:", randomMessage);
      
      // Step 1: Save message to PostgreSQL (simulate authenticated user)
      const testUser = await storage.getUserByUsername('testuser') || 
                       await storage.getUserByUsername('alice');
      
      if (!testUser) {
        return res.status(500).json({ 
          error: "No test user found. Please run 'npm run seed' first." 
        });
      }
      
      const testChannel = await storage.getChannelByName('general');
      if (!testChannel) {
        return res.status(500).json({ 
          error: "No test channel found. Please run 'npm run seed' first." 
        });
      }
      
      const messageData = {
        content: randomMessage,
        authorId: testUser.id,
        channelId: testChannel.id,
      };
      
      const savedMessage = await storage.createMessage(messageData);
      console.log(`[TestRoute] ✅ Message saved to PostgreSQL with ID: ${savedMessage.id}`);
      
      // Step 2: Generate embedding
      const embeddingResult = await generateEmbedding(randomMessage);
      if (!embeddingResult) {
        return res.status(500).json({ 
          error: "Failed to generate embedding. Check OPENAI_API_KEY." 
        });
      }
      
      console.log(`[TestRoute] ✅ Generated embedding: ${embeddingResult.embedding.length} dimensions`);
      
      // Step 3: Insert vector into OpenSearch
      const metadata = {
        messageId: savedMessage.id,
        content: randomMessage,
        authorId: savedMessage.authorId,
        authorName: savedMessage.author.displayName,
        authorUsername: savedMessage.author.username,
        channelId: savedMessage.channelId,
        createdAt: savedMessage.createdAt?.toISOString() || new Date().toISOString(),
        type: 'channel_message',
        tokenCount: embeddingResult.tokenCount,
        embeddingModel: embeddingResult.model,
      };
      
      const vectorId = `message_${savedMessage.id}`;
      await insertVector(vectorId, embeddingResult.embedding, metadata);
      console.log(`[TestRoute] ✅ Vector inserted into OpenSearch with ID: ${vectorId}`);
      
      // Step 4: Search for similar vectors
      const searchResults = await searchVector(embeddingResult.embedding, 3);
      console.log(`[TestRoute] ✅ Found ${searchResults.length} similar vectors`);
      
      // Step 5: Return comprehensive results
      const response = {
        success: true,
        timestamp: new Date().toISOString(),
        steps: {
          "1_message_saved": {
            id: savedMessage.id,
            content: savedMessage.content,
            author: savedMessage.author.displayName,
            channel: testChannel.name,
          },
          "2_embedding_generated": {
            model: embeddingResult.model,
            dimensions: embeddingResult.embedding.length,
            tokens: embeddingResult.tokenCount,
            preview: embeddingResult.embedding.slice(0, 5), // First 5 values
          },
          "3_vector_stored": {
            vectorId: vectorId,
            metadata: {
              messageId: metadata.messageId,
              authorName: metadata.authorName,
              type: metadata.type,
            }
          },
          "4_similarity_search": {
            query: "Same embedding as inserted message",
            resultsCount: searchResults.length,
            topResults: searchResults.map(result => ({
              id: result.id,
              score: Math.round(result.score * 10000) / 10000, // Round to 4 decimal places
              messageId: result.metadata.messageId,
              content: result.metadata.content?.substring(0, 100) + "...",
              author: result.metadata.authorName,
            }))
          }
        },
        summary: {
          message: "Message embedding flow completed successfully!",
          postgresql: "✅ Message stored",
          openai: "✅ Embedding generated", 
          opensearch: "✅ Vector indexed",
          search: `✅ Found ${searchResults.length} similar results`,
        }
      };
      
      res.json(response);
      
    } catch (error: any) {
      console.error("[TestRoute] ❌ Test failed:", error);
      
      let errorMessage = error.message;
      let suggestions = [];
      
      if (error.message.includes('OPENAI_API_KEY')) {
        suggestions.push("Add OPENAI_API_KEY to your .env file");
      }
      
      if (error.message.includes('OPENSEARCH_ENDPOINT')) {
        suggestions.push("Add OPENSEARCH_ENDPOINT to your .env file");
      }
      
      if (error.message.includes('authentication')) {
        suggestions.push("Check your AWS credentials and OpenSearch permissions");
      }
      
      res.status(500).json({
        success: false,
        error: errorMessage,
        suggestions,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Quick test endpoint for org memory functionality
  app.get("/test-org-memory", async (req, res) => {
    try {
      const testQuery = req.query.q as string || "Atlas Project";
      console.log("[TestOrgMemory] Testing with query:", testQuery);
      
      // Test basic text search
      const textResults = await storage.searchMessages(testQuery);
      console.log("[TestOrgMemory] Text search found:", textResults.length, "messages");
      
      // Test vector search if available
      let vectorResults = [];
      try {
        const queryEmbedding = await generateQueryEmbedding(testQuery);
        if (queryEmbedding) {
          const vectorSearchResults = await searchVector(queryEmbedding, 5);
          vectorResults = vectorSearchResults;
          console.log("[TestOrgMemory] Vector search found:", vectorResults.length, "results");
        }
      } catch (vectorError) {
        console.log("[TestOrgMemory] Vector search not available:", vectorError.message);
      }
      
      // Sample messages in database
      const sampleMessages = await db
        .select({
          id: messages.id,
          content: messages.content,
          channelId: messages.channelId,
        })
        .from(messages)
        .limit(5);
      
      res.json({
        query: testQuery,
        textSearchResults: textResults.length,
        vectorSearchResults: vectorResults.length,
        sampleMessages: sampleMessages,
        textResults: textResults.slice(0, 3).map(msg => ({
          content: msg.content?.substring(0, 100) + "...",
          author: msg.author.displayName,
          channel: msg.channel?.name
        })),
        vectorResults: vectorResults.slice(0, 3).map(result => ({
          score: result.score,
          content: result.metadata.content?.substring(0, 100) + "...",
          author: result.metadata.authorName
        })),
        status: {
          database: sampleMessages.length > 0 ? "✅ Has messages" : "❌ No messages",
          textSearch: textResults.length > 0 ? "✅ Working" : "❌ No results",
          vectorSearch: vectorResults.length > 0 ? "✅ Working" : "❌ No results or not configured"
        }
      });
      
    } catch (error) {
      console.error("[TestOrgMemory] Error:", error);
      res.status(500).json({ 
        error: error.message,
        suggestion: "Check database connection and API keys"
      });
    }
  });

  const httpServer = createServer(app);

  // WebSocket setup for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  const clients = new Map<WebSocket, { userId: number; channels: Set<number> }>();

  wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'auth':
            // In a real app, verify the token/session
            clients.set(ws, { userId: message.userId, channels: new Set() });
            break;
            
          case 'join_channel':
            const clientData = clients.get(ws);
            if (clientData) {
              clientData.channels.add(message.channelId);
            }
            break;
            
          case 'leave_channel':
            const client = clients.get(ws);
            if (client) {
              client.channels.delete(message.channelId);
            }
            break;
            
          case 'new_message':
            // Handle both channel messages and DMs
            if (message.channelId) {
              // Broadcast to channel members
              clients.forEach((clientInfo, clientWs) => {
                if (clientWs !== ws && 
                    clientInfo.channels.has(message.channelId) &&
                    clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({
                    type: 'new_message',
                    message: message.data
                  }));
                }
              });
            } else if (message.recipientId) {
              // Send to specific recipient for DMs
              clients.forEach((clientInfo, clientWs) => {
                if ((clientInfo.userId === message.recipientId || 
                     clientInfo.userId === message.data.authorId) && 
                    clientWs.readyState === WebSocket.OPEN && 
                    clientWs !== ws) {
                  clientWs.send(JSON.stringify({
                    type: 'new_message',
                    message: message.data
                  }));
                }
              });
            }
            break;
            
          case 'typing':
            // Broadcast typing indicator
            clients.forEach((clientInfo, clientWs) => {
              if (clientWs !== ws && 
                  clientInfo.channels.has(message.channelId) &&
                  clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  type: 'typing',
                  userId: message.userId,
                  channelId: message.channelId,
                  isTyping: message.isTyping
                }));
              }
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket connection closed');
    });
  });

  return httpServer;
}
