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
  USER: '/api/user',
  LOGIN: '/api/login',
  LOGOUT: '/api/logout',
  REGISTER: '/api/register',
  CHANNELS: '/api/channels',
  MESSAGES: '/api/messages',
  DIRECT_MESSAGES: '/api/direct-messages',
  DIRECT_MESSAGE_USERS: '/api/direct-message-users',
  SEARCH: '/api/search',
  AI_SUGGESTIONS: '/api/ai/suggest-reply',
  AI_TONE_ANALYSIS: '/api/ai/analyze-tone',
  AI_MEETING_NOTES: '/api/ai/generate-notes',
  HEALTH: '/api/health',
} as const; 