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
import { eq } from "drizzle-orm";

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
      
      // Analyze tone in background
      if (messageData.content) {
        try {
          const contentStr = Array.isArray(messageData.content) ? messageData.content.join(' ') : String(messageData.content);
          analyzeTone(contentStr).then(analysis => {
            console.log("Tone analysis:", analysis);
          }).catch(console.error);
        } catch (err) {
          console.error("Tone analysis error:", err);
        }
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
      
      // Search relevant messages across channels (simplified)
      const relevantMessages = await storage.searchMessages(query);
      
      console.log("[API] Found", relevantMessages.length, "relevant messages");
      
      if (relevantMessages.length === 0) {
        console.warn("[API] No messages found for query, returning empty result");
        return res.json({
          query,
          summary: "No relevant messages found for your query. This could mean: 1) The search terms don't match any existing messages, 2) There are no messages in the database yet, or 3) All messages are in private channels or direct messages.",
          sources: [],
          keyPoints: ["Try using different keywords", "Check if there are any messages in public channels", "Verify that the database has been seeded with sample data"]
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
