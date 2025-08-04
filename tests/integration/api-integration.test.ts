import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { type Application } from 'express';
import { registerRoutes } from '../../server/routes';

// Mock WebSocket for integration tests
const mockWebSocketServer = {
  on: jest.fn(),
  clients: new Map(),
};

jest.mock('ws', () => ({
  WebSocketServer: jest.fn(() => mockWebSocketServer),
  WebSocket: {
    OPEN: 1,
    CLOSED: 3,
  },
}));

// Mock database with in-memory storage for integration tests
const mockData = {
  users: [
    { id: 1, username: 'testuser', displayName: 'Test User', email: 'test@example.com' },
    { id: 2, username: 'manager', displayName: 'Manager User', email: 'manager@example.com' },
  ],
  channels: [
    { id: 1, name: 'general', description: 'General discussion', createdBy: 1 },
    { id: 2, name: 'random', description: 'Random chat', createdBy: 1 },
  ],
  messages: [
    { 
      id: 1, 
      content: 'Welcome to the team!', 
      authorId: 2, 
      channelId: 1, 
      createdAt: new Date('2025-01-09T09:00:00Z'),
      author: { id: 2, displayName: 'Manager User' }
    },
    { 
      id: 2, 
      content: 'Thanks for the welcome!', 
      authorId: 1, 
      channelId: 1, 
      createdAt: new Date('2025-01-09T09:05:00Z'),
      author: { id: 1, displayName: 'Test User' }
    },
  ],
  channelMembers: [
    { channelId: 1, userId: 1 },
    { channelId: 1, userId: 2 },
    { channelId: 2, userId: 1 },
  ],
};

// Mock storage with realistic implementation
jest.mock('../../server/storage', () => ({
  storage: {
    getChannels: jest.fn(() => Promise.resolve(mockData.channels)),
    getChannel: jest.fn((id: number) => Promise.resolve(
      mockData.channels.find(c => c.id === id) || null
    )),
    createChannel: jest.fn((data: any) => {
      const newChannel = { 
        id: mockData.channels.length + 1, 
        ...data, 
        createdAt: new Date() 
      };
      mockData.channels.push(newChannel);
      return Promise.resolve(newChannel);
    }),
    getChannelMessages: jest.fn((channelId: number) => Promise.resolve(
      mockData.messages.filter(m => m.channelId === channelId)
    )),
    getChannelMembers: jest.fn((channelId: number) => Promise.resolve(
      mockData.channelMembers
        .filter(cm => cm.channelId === channelId)
        .map(cm => mockData.users.find(u => u.id === cm.userId))
    )),
    addChannelMember: jest.fn((channelId: number, userId: number) => {
      mockData.channelMembers.push({ channelId, userId });
      return Promise.resolve();
    }),
    createMessage: jest.fn((data: any) => {
      const newMessage = { 
        id: mockData.messages.length + 1, 
        ...data, 
        createdAt: new Date(),
        author: mockData.users.find(u => u.id === data.authorId)
      };
      mockData.messages.push(newMessage);
      return Promise.resolve(newMessage);
    }),
    getUser: jest.fn((id: number) => Promise.resolve(
      mockData.users.find(u => u.id === id) || null
    )),
    searchMessages: jest.fn((query: string) => Promise.resolve(
      mockData.messages.filter(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
      )
    )),
    createAiSuggestion: jest.fn(() => Promise.resolve({ id: 1 })),
    createMeetingNotes: jest.fn((data: any) => Promise.resolve({ 
      id: 1, 
      ...data, 
      createdAt: new Date() 
    })),
    getMeetingNotes: jest.fn(() => Promise.resolve([])),
    getDirectMessages: jest.fn(() => Promise.resolve([])),
    getDirectMessageUsers: jest.fn(() => Promise.resolve([])),
    getMessageThread: jest.fn(() => Promise.resolve([])),
  },
}));

// Mock AI services
jest.mock('../../server/ai', () => ({
  analyzeTone: jest.fn(() => Promise.resolve({
    tone: 'professional',
    impact: 'medium',
    clarity: 'clear',
    confidence: 80,
    suggestions: ['Consider being more specific'],
    suggestedTones: ['friendly', 'casual'],
    explanation: 'Message is clear and professional',
  })),
  generateReply: jest.fn(() => Promise.resolve({
    suggestions: [{
      suggestedReply: 'Thank you for the update. This looks great!',
      confidence: 85,
      reasoning: 'Positive acknowledgment with appreciation',
    }],
  })),
  queryOrgMemory: jest.fn(() => Promise.resolve({
    query: 'project status',
    summary: 'Projects are on track with good progress',
    sources: [{ channelName: 'general', messageCount: 2, lastUpdate: '2025-01-09' }],
    keyPoints: ['Team collaboration is strong', 'All deadlines being met'],
  })),
  generateMeetingNotes: jest.fn(() => Promise.resolve({
    title: 'Team Meeting - January 9, 2025',
    summary: 'Productive team discussion about project progress',
    keyPoints: ['Discussed current sprint', 'Reviewed blockers'],
    actionItems: ['Complete code review', 'Update documentation'],
    participants: ['Test User', 'Manager User'],
    decisions: ['Approved next sprint plan'],
  })),
}));

// Mock authentication
jest.mock('../../server/auth', () => ({
  setupAuth: jest.fn(),
}));

describe('End-to-End API Integration Tests', () => {
  let app: Application;
  let server: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    
    // Mock authenticated user
    app.use((req: any, res: any, next: any) => {
      req.isAuthenticated = () => true;
      req.user = mockData.users[0]; // Test user
      next();
    });

    server = registerRoutes(app as any);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete User Workflow', () => {
    test('user can view channels, send messages, and get AI suggestions', async () => {
      // 1. Get channels list
      const channelsResponse = await request(app).get('/api/channels');
      expect(channelsResponse.status).toBe(200);
      expect(channelsResponse.body).toHaveLength(2);
      expect(channelsResponse.body[0].name).toBe('general');

      // 2. Get messages for a channel
      const messagesResponse = await request(app).get('/api/channels/1/messages');
      expect(messagesResponse.status).toBe(200);
      expect(messagesResponse.body).toHaveLength(2);
      expect(messagesResponse.body[0].content).toBe('Welcome to the team!');

      // 3. Send a new message
      const newMessageResponse = await request(app)
        .post('/api/messages')
        .send({
          content: 'Looking forward to working with everyone!',
          channelId: 1,
        });
      expect(newMessageResponse.status).toBe(201);
      expect(newMessageResponse.body.content).toBe('Looking forward to working with everyone!');

      // 4. Get AI reply suggestion
      const suggestionResponse = await request(app)
        .post('/api/ai/suggest-reply')
        .send({
          messageContent: 'Looking forward to working with everyone!',
          threadContext: ['Welcome to the team!', 'Thanks for the welcome!'],
          orgContext: 'Channel: 1',
        });
      expect(suggestionResponse.status).toBe(200);
      expect(suggestionResponse.body.suggestions).toHaveLength(1);
      expect(suggestionResponse.body.suggestions[0].suggestedReply)
        .toBe('Thank you for the update. This looks great!');
    });

    test('user can create channel and manage membership', async () => {
      // 1. Create new channel
      const newChannelResponse = await request(app)
        .post('/api/channels')
        .send({
          name: 'project-alpha',
          description: 'Discussion for Project Alpha',
          isPrivate: false,
        });
      expect(newChannelResponse.status).toBe(201);
      expect(newChannelResponse.body.name).toBe('project-alpha');

      const channelId = newChannelResponse.body.id;

      // 2. Join the channel
      const joinResponse = await request(app).post(`/api/channels/${channelId}/join`);
      expect(joinResponse.status).toBe(200);

      // 3. Check channel members
      const membersResponse = await request(app).get(`/api/channels/${channelId}/members`);
      expect(membersResponse.status).toBe(200);
      expect(membersResponse.body).toHaveLength(1);
    });

    test('user can search messages and query org memory', async () => {
      // 1. Search for messages
      const searchResponse = await request(app)
        .get('/api/search')
        .query({ q: 'welcome' });
      expect(searchResponse.status).toBe(200);
      expect(searchResponse.body).toHaveLength(2); // Both messages contain "welcome"
      const messages = searchResponse.body;
      expect(messages.some((msg: any) => msg.content === 'Welcome to the team!')).toBe(true);
      expect(messages.some((msg: any) => msg.content === 'Thanks for the welcome!')).toBe(true);

      // 2. Query organizational memory
      const orgMemoryResponse = await request(app)
        .post('/api/ai/org-memory')
        .send({ query: 'team welcome' });
      expect(orgMemoryResponse.status).toBe(200);
      expect(orgMemoryResponse.body.summary).toContain('Projects are on track');
      expect(orgMemoryResponse.body.keyPoints).toContain('Team collaboration is strong');
    });

    test('user can generate and view meeting notes', async () => {
      // 1. Generate meeting notes for a channel
      const notesResponse = await request(app)
        .post('/api/ai/generate-notes')
        .send({ channelId: 1 });
      expect(notesResponse.status).toBe(200);
      expect(notesResponse.body.title).toBe('Team Meeting - January 9, 2025');
      expect(notesResponse.body.participants).toContain('Test User');
      expect(notesResponse.body.actionItems).toContain('Complete code review');

      // 2. Get meeting notes for the channel
      const getNotesResponse = await request(app).get('/api/channels/1/notes');
      expect(getNotesResponse.status).toBe(200);
    });

    test('user can analyze tone of messages', async () => {
      const toneResponse = await request(app)
        .post('/api/ai/analyze-tone')
        .send({ content: 'This project is taking too long and needs immediate attention!' });
      
      expect(toneResponse.status).toBe(200);
      expect(toneResponse.body.tone).toBe('professional');
      expect(toneResponse.body.confidence).toBe(80);
      expect(toneResponse.body.suggestions).toContain('Consider being more specific');
    });
  });

  describe('Error Handling Integration', () => {
    test('handles non-existent channel gracefully', async () => {
      const response = await request(app).get('/api/channels/999');
      expect(response.status).toBe(404);
    });

    test('handles invalid message data', async () => {
      const response = await request(app)
        .post('/api/messages')
        .send({
          // Missing required content field
          channelId: 1,
        });
      expect(response.status).toBe(400);
    });

    test('handles invalid AI request data', async () => {
      const response = await request(app)
        .post('/api/ai/suggest-reply')
        .send({
          // Missing required messageContent field
          threadContext: [],
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid message content');
    });

    test('handles invalid meeting notes generation', async () => {
      const response = await request(app)
        .post('/api/ai/generate-notes')
        .send({
          channelId: 'invalid', // Should be number
        });
      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Invalid channel ID');
    });
  });

  describe('Data Consistency Tests', () => {
    test('message creation updates channel message list', async () => {
      // Get initial message count
      const initialMessages = await request(app).get('/api/channels/1/messages');
      const initialCount = initialMessages.body.length;

      // Create new message
      await request(app)
        .post('/api/messages')
        .send({
          content: 'New test message for consistency check',
          channelId: 1,
        });

      // Verify message count increased
      const updatedMessages = await request(app).get('/api/channels/1/messages');
      expect(updatedMessages.body.length).toBe(initialCount + 1);
      expect(updatedMessages.body.some((msg: any) => 
        msg.content === 'New test message for consistency check'
      )).toBe(true);
    });

    test('channel creation appears in channels list', async () => {
      // Get initial channel count
      const initialChannels = await request(app).get('/api/channels');
      const initialCount = initialChannels.body.length;

      // Create new channel
      await request(app)
        .post('/api/channels')
        .send({
          name: 'consistency-test',
          description: 'Channel for testing data consistency',
        });

      // Verify channel appears in list
      const updatedChannels = await request(app).get('/api/channels');
      expect(updatedChannels.body.length).toBe(initialCount + 1);
      expect(updatedChannels.body.some((channel: any) => 
        channel.name === 'consistency-test'
      )).toBe(true);
    });
  });

  describe('AI Integration Workflow', () => {
    test('complete AI workflow: message → analysis → suggestion → notes', async () => {
      // 1. Send message that needs analysis
      const messageResponse = await request(app)
        .post('/api/messages')
        .send({
          content: 'We need to discuss the budget allocation urgently!',
          channelId: 1,
        });
      expect(messageResponse.status).toBe(201);

      // 2. Analyze tone of the message
      const toneResponse = await request(app)
        .post('/api/ai/analyze-tone')
        .send({ content: 'We need to discuss the budget allocation urgently!' });
      expect(toneResponse.status).toBe(200);
      expect(toneResponse.body.tone).toBe('professional');

      // 3. Get reply suggestion
      const suggestionResponse = await request(app)
        .post('/api/ai/suggest-reply')
        .send({
          messageContent: 'We need to discuss the budget allocation urgently!',
          threadContext: ['Welcome to the team!', 'Thanks for the welcome!'],
          orgContext: 'Channel: 1',
          messageId: messageResponse.body.id,
        });
      expect(suggestionResponse.status).toBe(200);
      expect(suggestionResponse.body.suggestions[0].suggestedReply)
        .toBe('Thank you for the update. This looks great!');

      // 4. Generate meeting notes
      const notesResponse = await request(app)
        .post('/api/ai/generate-notes')
        .send({ channelId: 1 });
      expect(notesResponse.status).toBe(200);
      expect(notesResponse.body.title).toBe('Team Meeting - January 9, 2025');
    });
  });
});
