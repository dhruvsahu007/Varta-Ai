import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Add Node.js globals for browser environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'test-key';
process.env.DATABASE_URL = 'test-db-url';
process.env.SESSION_SECRET = 'test-secret';

// Mock OpenAI before any imports
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{
              message: {
                content: JSON.stringify({
                  tone: 'professional',
                  impact: 'high',
                  clarity: 'clear',
                  confidence: 85,
                  explanation: 'The message is clear but could be more engaging',
                  suggestions: ['Consider being more direct'],
                  suggestedTones: ['friendly', 'casual']
                })
              }
            }]
          })
        }
      }
    }))
  };
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:5000',
    href: 'http://localhost:5000',
    origin: 'http://localhost:5000',
  },
  writable: true,
});

// Mock fetch
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
  })
) as jest.Mock;

// Mock WebSocket
global.WebSocket = jest.fn(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1,
  OPEN: 1,
  CLOSED: 3,
})) as any;

// Mock console methods for cleaner test output
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock database operations
jest.mock('../server/db', () => ({
  db: {
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 1 }]),
    execute: jest.fn().mockResolvedValue([]),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  }
}));

// Mock storage operations
jest.mock('../server/storage', () => ({
  storage: {
    getUser: jest.fn(),
    getUserByUsername: jest.fn(),
    createUser: jest.fn(),
    getChannels: jest.fn(),
    createChannel: jest.fn(),
    getMessages: jest.fn(),
    createMessage: jest.fn(),
    getDMMessages: jest.fn(),
    findMessages: jest.fn(),
    sessionStore: {
      get: jest.fn(),
      set: jest.fn(),
      destroy: jest.fn(),
    }
  }
}));

// Setup test helpers
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up after each test
afterEach(() => {
  jest.restoreAllMocks();
});
