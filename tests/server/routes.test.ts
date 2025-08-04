import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import express, { type Express } from 'express';
import { registerRoutes } from '../../server/routes';

// Mock dependencies
jest.mock('../../server/auth', () => ({
  setupAuth: jest.fn(),
}));

jest.mock('../../server/storage', () => ({
  storage: {
    getChannels: jest.fn(),
    getChannel: jest.fn(),
    createChannel: jest.fn(),
    getChannelMessages: jest.fn(),
    getChannelMembers: jest.fn(),
    addChannelMember: jest.fn(),
    createMessage: jest.fn(),
    getMessageThread: jest.fn(),
    getDirectMessages: jest.fn(),
    getDirectMessageUsers: jest.fn(),
    getUser: jest.fn(),
    createAiSuggestion: jest.fn(),
    searchMessages: jest.fn(),
    createMeetingNotes: jest.fn(),
    getMeetingNotes: jest.fn(),
  },
}));

jest.mock('../../server/ai', () => ({
  analyzeTone: jest.fn(),
  generateReply: jest.fn(),
  queryOrgMemory: jest.fn(),
  generateMeetingNotes: jest.fn(),
}));

describe('API Routes', () => {
  let app: express.Application;
  let server: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Mock authentication middleware
    app.use((req: any, res: any, next: any) => {
      req.isAuthenticated = () => true;
      req.user = { id: 1, username: 'testuser', displayName: 'Test User' };
      next();
    });

    server = registerRoutes(app as Express);
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  describe('Channels API', () => {
    test('GET /api/channels should return channels list', async () => {
      const mockChannels = [
        { id: 1, name: 'general', description: 'General discussion' },
        { id: 2, name: 'random', description: 'Random chat' },
      ];

      const { storage } = require('../../server/storage');
      storage.getChannels.mockResolvedValue(mockChannels);

      const response = await request(app).get('/api/channels');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockChannels);
      expect(storage.getChannels).toHaveBeenCalledTimes(1);
    });

    test('GET /api/channels/:id should return specific channel', async () => {
      const mockChannel = { id: 1, name: 'general', description: 'General discussion' };

      const { storage } = require('../../server/storage');
      storage.getChannel.mockResolvedValue(mockChannel);

      const response = await request(app).get('/api/channels/1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockChannel);
      expect(storage.getChannel).toHaveBeenCalledWith(1);
    });

    test('GET /api/channels/:id should return 404 for non-existent channel', async () => {
      const { storage } = require('../../server/storage');
      storage.getChannel.mockResolvedValue(null);

      const response = await request(app).get('/api/channels/999');

      expect(response.status).toBe(404);
    });

    test('POST /api/channels should create new channel', async () => {
      const newChannel = { name: 'test-channel', description: 'Test channel' };
      const createdChannel = { id: 3, ...newChannel, createdBy: 1 };

      const { storage } = require('../../server/storage');
      storage.createChannel.mockResolvedValue(createdChannel);

      const response = await request(app)
        .post('/api/channels')
        .send(newChannel);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(createdChannel);
      expect(storage.createChannel).toHaveBeenCalledWith({
        ...newChannel,
        createdBy: 1,
      });
    });

    test('GET /api/channels/:id/messages should return channel messages', async () => {
      const mockMessages = [
        { id: 1, content: 'Hello world', authorId: 1 },
        { id: 2, content: 'How are you?', authorId: 2 },
      ];

      const { storage } = require('../../server/storage');
      storage.getChannelMessages.mockResolvedValue(mockMessages);

      const response = await request(app).get('/api/channels/1/messages');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockMessages);
      expect(storage.getChannelMessages).toHaveBeenCalledWith(1);
    });

    test('POST /api/channels/:id/join should add user to channel', async () => {
      const { storage } = require('../../server/storage');
      storage.addChannelMember.mockResolvedValue(undefined);

      const response = await request(app).post('/api/channels/1/join');

      expect(response.status).toBe(200);
      expect(storage.addChannelMember).toHaveBeenCalledWith(1, 1);
    });
  });

  describe('Messages API', () => {
    test('POST /api/messages should create new message', async () => {
      const messageData = {
        content: 'Hello world',
        channelId: 1,
      };
      const createdMessage = { id: 1, ...messageData, authorId: 1 };

      const { storage } = require('../../server/storage');
      storage.createMessage.mockResolvedValue(createdMessage);

      const response = await request(app)
        .post('/api/messages')
        .send(messageData);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(createdMessage);
      expect(storage.createMessage).toHaveBeenCalledWith({
        ...messageData,
        authorId: 1,
      });
    });

    test('GET /api/messages/:id/thread should return message thread', async () => {
      const mockThread = [
        { id: 1, content: 'Original message', authorId: 1 },
        { id: 2, content: 'Reply 1', authorId: 2, parentMessageId: 1 },
        { id: 3, content: 'Reply 2', authorId: 1, parentMessageId: 1 },
      ];

      const { storage } = require('../../server/storage');
      storage.getMessageThread.mockResolvedValue(mockThread);

      const response = await request(app).get('/api/messages/1/thread');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockThread);
      expect(storage.getMessageThread).toHaveBeenCalledWith(1);
    });

    test('GET /api/direct-messages/:userId should return DM conversation', async () => {
      const mockDMs = [
        { id: 1, content: 'Hi there', authorId: 1, recipientId: 2 },
        { id: 2, content: 'Hello back', authorId: 2, recipientId: 1 },
      ];

      const { storage } = require('../../server/storage');
      storage.getDirectMessages.mockResolvedValue(mockDMs);

      const response = await request(app).get('/api/direct-messages/2');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockDMs);
      expect(storage.getDirectMessages).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('AI Features API', () => {
    test('POST /api/ai/suggest-reply should generate reply suggestions', async () => {
      const requestData = {
        messageContent: 'How is the project going?',
        threadContext: ['We started last week'],
        orgContext: 'Channel: project-updates',
      };

      const mockSuggestion = {
        suggestions: [{
          suggestedReply: 'The project is progressing well. We completed phase 1.',
          confidence: 85,
          reasoning: 'Provides a positive update with specific details.',
        }],
      };

      const { generateReply } = require('../../server/ai');
      generateReply.mockResolvedValue(mockSuggestion);

      const response = await request(app)
        .post('/api/ai/suggest-reply')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockSuggestion);
      expect(generateReply).toHaveBeenCalledWith(
        requestData.messageContent,
        requestData.threadContext,
        requestData.orgContext,
        false
      );
    });

    test('POST /api/ai/analyze-tone should analyze message tone', async () => {
      const requestData = { content: 'This is unacceptable!' };
      const mockAnalysis = {
        tone: 'aggressive',
        impact: 'high',
        clarity: 'clear',
        confidence: 90,
        suggestions: ['Consider using a more professional tone'],
        suggestedTones: ['professional', 'assertive'],
        explanation: 'The message conveys frustration but could be more constructive',
      };

      const { analyzeTone } = require('../../server/ai');
      analyzeTone.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/ai/analyze-tone')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockAnalysis);
      expect(analyzeTone).toHaveBeenCalledWith(requestData.content);
    });

    test('POST /api/ai/org-memory should query organizational memory', async () => {
      const requestData = { query: 'project status' };
      const mockMessages = [
        {
          content: 'Project is on track',
          channel: { name: 'project-updates' },
          author: { displayName: 'John Doe' },
          createdAt: new Date('2025-01-09'),
        },
      ];
      const mockResult = {
        query: 'project status',
        summary: 'Projects are generally on track',
        sources: [{ channelName: 'project-updates', messageCount: 1, lastUpdate: '2025-01-09' }],
        keyPoints: ['All projects on schedule'],
      };

      const { storage } = require('../../server/storage');
      const { queryOrgMemory } = require('../../server/ai');
      
      storage.searchMessages.mockResolvedValue(mockMessages);
      queryOrgMemory.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/ai/org-memory')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
    });

    test('POST /api/ai/generate-notes should create meeting notes', async () => {
      const requestData = { channelId: 1 };
      const mockChannel = { id: 1, name: 'team-standup' };
      const mockMessages = [
        {
          id: 1,
          content: 'Let\'s start the standup',
          author: { displayName: 'Manager' },
          createdAt: new Date('2025-01-09T09:00:00Z'),
        },
      ];
      const mockNotes = {
        title: 'Team Standup - January 9, 2025',
        summary: 'Daily standup meeting',
        keyPoints: ['Discussed project progress'],
        actionItems: ['Complete task A'],
        participants: ['Manager'],
        decisions: ['Approved timeline'],
      };
      const savedNotes = { id: 1, ...mockNotes };

      const { storage } = require('../../server/storage');
      const { generateMeetingNotes } = require('../../server/ai');

      storage.getChannel.mockResolvedValue(mockChannel);
      storage.getChannelMessages.mockResolvedValue(mockMessages);
      generateMeetingNotes.mockResolvedValue(mockNotes);
      storage.createMeetingNotes.mockResolvedValue(savedNotes);

      const response = await request(app)
        .post('/api/ai/generate-notes')
        .send(requestData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(mockNotes);
      expect(response.body.id).toBe(1);
    });
  });

  describe('Search API', () => {
    test('GET /api/search should return search results', async () => {
      const mockResults = [
        { id: 1, content: 'Search result 1', authorId: 1 },
        { id: 2, content: 'Search result 2', authorId: 2 },
      ];

      const { storage } = require('../../server/storage');
      storage.searchMessages.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test query' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResults);
      expect(storage.searchMessages).toHaveBeenCalledWith('test query', undefined);
    });

    test('GET /api/search with channelId should search in specific channel', async () => {
      const { storage } = require('../../server/storage');
      storage.searchMessages.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/search')
        .query({ q: 'test', channelId: '1' });

      expect(response.status).toBe(200);
      expect(storage.searchMessages).toHaveBeenCalledWith('test', 1);
    });

    test('GET /api/search without query should return empty results', async () => {
      const response = await request(app).get('/api/search');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('Authentication Required', () => {
    test('should return 401 when not authenticated', async () => {
      // Create app without authentication middleware
      const unauthApp = express();
      unauthApp.use(express.json());
      unauthApp.use((req: any, res: any, next: any) => {
        req.isAuthenticated = () => false;
        next();
      });
      registerRoutes(unauthApp);

      const response = await request(unauthApp).get('/api/channels');

      expect(response.status).toBe(401);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const { storage } = require('../../server/storage');
      storage.getChannels.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app).get('/api/channels');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Failed to fetch channels');
    });

    test('should handle AI service errors gracefully', async () => {
      const { analyzeTone } = require('../../server/ai');
      analyzeTone.mockRejectedValue(new Error('OpenAI API error'));

      const response = await request(app)
        .post('/api/ai/analyze-tone')
        .send({ content: 'Test message' });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('message', 'Failed to analyze tone');
    });
  });
});
