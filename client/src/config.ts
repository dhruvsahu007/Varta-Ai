// Environment-based configuration
const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// API Base URL configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 
  (isDevelopment ? 'http://localhost:5000' : window.location.origin);

// WebSocket URL configuration  
export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 
  API_BASE_URL.replace(/^http/, 'ws');

export const API_ENDPOINTS = {
  // Authentication
  USER: '/api/user',
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  REGISTER: '/api/register',
  
  // Channels
  CHANNELS: '/api/channels',
  CHANNEL_BY_ID: (id: number) => `/api/channels/${id}`,
  CHANNEL_MESSAGES: (id: number) => `/api/channels/${id}/messages`,
  CHANNEL_MEMBERS: (id: number) => `/api/channels/${id}/members`,
  CHANNEL_JOIN: (id: number) => `/api/channels/${id}/join`,
  CHANNEL_NOTES: (id: number) => `/api/channels/${id}/notes`,
  
  // Messages
  MESSAGES: '/api/messages',
  MESSAGE_THREAD: (id: number) => `/api/messages/${id}/thread`,
  DIRECT_MESSAGES: (userId: number) => `/api/direct-messages/${userId}`,
  DIRECT_MESSAGE_USERS: '/api/direct-message-users',
  
  // Users
  USER_BY_ID: (id: number) => `/api/users/${id}`,
  
  // AI Features
  AI_SUGGESTIONS: '/api/ai/suggest-reply',
  AI_TONE_ANALYSIS: '/api/ai/analyze-tone',
  AI_ORG_MEMORY: '/api/ai/org-memory',
  AI_MEETING_NOTES: '/api/ai/generate-notes',
  
  // Utility
  SEARCH: '/api/search',
  HEALTH: '/api/health',
} as const;
