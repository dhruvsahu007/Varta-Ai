import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatArea } from '../../client/src/components/chat-area';

// Mock hooks and dependencies
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', displayName: 'Test User' },
  }),
}));

jest.mock('../../client/src/hooks/use-websocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    lastMessage: null,
    joinChannel: jest.fn(),
    leaveChannel: jest.fn(),
    sendTyping: jest.fn(),
    broadcastMessage: jest.fn(),
  }),
}));

// Mock the API
global.fetch = jest.fn();

describe('ChatArea Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    (global.fetch as jest.Mock).mockClear();
  });

  const renderWithProviders = (props: any) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChatArea {...props} />
      </QueryClientProvider>
    );
  };

  test('renders empty state when no channel or DM is selected', () => {
    renderWithProviders({ 
      selectedChannel: null, 
      selectedDmUser: null 
    });

    expect(screen.getByText(/select a channel or start a conversation/i))
      .toBeInTheDocument();
  });

  test('loads and displays channel messages', async () => {
    const mockMessages = [
      {
        id: 1,
        content: 'Hello everyone!',
        author: { id: 2, displayName: 'John Doe', avatar: null },
        createdAt: new Date('2025-01-09T10:00:00Z'),
      },
      {
        id: 2,
        content: 'How is everyone doing?',
        author: { id: 3, displayName: 'Jane Smith', avatar: null },
        createdAt: new Date('2025-01-09T10:05:00Z'),
      },
    ];

    const mockChannel = {
      id: 1,
      name: 'general',
      description: 'General discussion',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMessages,
      });

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    await waitFor(() => {
      expect(screen.getByText('Hello everyone!')).toBeInTheDocument();
      expect(screen.getByText('How is everyone doing?')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  test('loads and displays direct messages', async () => {
    const mockDMs = [
      {
        id: 1,
        content: 'Hey there!',
        author: { id: 2, displayName: 'Bob Wilson', avatar: null },
        createdAt: new Date('2025-01-09T10:00:00Z'),
        recipientId: 1,
      },
      {
        id: 2,
        content: 'Hi Bob, how are you?',
        author: { id: 1, displayName: 'Test User', avatar: null },
        createdAt: new Date('2025-01-09T10:01:00Z'),
        recipientId: 2,
      },
    ];

    const mockUser = {
      id: 2,
      displayName: 'Bob Wilson',
      username: 'bobwilson',
      avatar: null,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDMs,
      });

    renderWithProviders({ 
      selectedChannel: null, 
      selectedDmUser: 2 
    });

    await waitFor(() => {
      expect(screen.getByText('Hey there!')).toBeInTheDocument();
      expect(screen.getByText('Hi Bob, how are you?')).toBeInTheDocument();
      expect(screen.getByText('Bob Wilson')).toBeInTheDocument();
    });
  });

  test('sends new message successfully', async () => {
    const mockChannel = {
      id: 1,
      name: 'general',
      description: 'General discussion',
    };

    const mockNewMessage = {
      id: 3,
      content: 'New test message',
      author: { id: 1, displayName: 'Test User', avatar: null },
      createdAt: new Date(),
      channelId: 1,
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNewMessage,
      });

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    });

    // Type and send message
    const messageInput = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(messageInput, { target: { value: 'New test message' } });
    fireEvent.submit(messageInput.closest('form')!);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'New test message',
          channelId: 1,
          recipientId: null,
        }),
      });
    });
  });

  test('handles AI reply suggestion', async () => {
    const mockChannel = {
      id: 1,
      name: 'general',
      description: 'General discussion',
    };

    const mockMessage = {
      id: 1,
      content: 'How is the project going?',
      author: { id: 2, displayName: 'Manager', avatar: null },
      createdAt: new Date('2025-01-09T10:00:00Z'),
    };

    const mockSuggestion = {
      suggestions: [{
        suggestedReply: 'The project is going well. We completed phase 1.',
        confidence: 85,
        reasoning: 'Professional update with specific progress details.',
      }],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMessage],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSuggestion,
      });

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    await waitFor(() => {
      expect(screen.getByText('How is the project going?')).toBeInTheDocument();
    });

    // Click suggest reply button
    const suggestButton = screen.getByRole('button', { name: /suggest reply/i });
    fireEvent.click(suggestButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/suggest-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageContent: 'How is the project going?',
          threadContext: [],
          orgContext: 'Channel: 1',
          messageId: 1,
          generateMultiple: false,
        }),
      });
    });

    // Check if suggestion is displayed
    await waitFor(() => {
      expect(screen.getByText(/the project is going well/i)).toBeInTheDocument();
    });
  });

  test('handles tone analysis', async () => {
    const mockChannel = {
      id: 1,
      name: 'general',
      description: 'General discussion',
    };

    const mockAnalysis = {
      tone: 'professional',
      impact: 'high',
      clarity: 'clear',
      confidence: 90,
      suggestions: ['Consider adding more context'],
      suggestedTones: ['friendly', 'casual'],
      explanation: 'Message is clear and professional',
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockAnalysis,
      });

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
    });

    // Type message and analyze tone
    const messageInput = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(messageInput, { target: { value: 'This is urgent!' } });

    const analyzeButton = screen.getByRole('button', { name: /analyze tone/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/analyze-tone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'This is urgent!' }),
      });
    });
  });

  test('generates meeting notes', async () => {
    const mockChannel = {
      id: 1,
      name: 'team-standup',
      description: 'Daily standup meetings',
    };

    const mockNotes = {
      id: 1,
      title: 'Team Standup - January 9, 2025',
      summary: 'Daily standup meeting discussion',
      keyPoints: ['Discussed project progress', 'Reviewed blockers'],
      actionItems: ['Complete feature X', 'Review PR #123'],
      participants: ['Alice', 'Bob', 'Charlie'],
      decisions: ['Approved new timeline'],
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotes,
      });

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    await waitFor(() => {
      expect(screen.getByText('team-standup')).toBeInTheDocument();
    });

    // Click generate notes button
    const notesButton = screen.getByRole('button', { name: /generate notes/i });
    fireEvent.click(notesButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/ai/generate-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: 1 }),
      });
    });

    // Check if notes are displayed
    await waitFor(() => {
      expect(screen.getByText('Team Standup - January 9, 2025')).toBeInTheDocument();
      expect(screen.getByText('Discussed project progress')).toBeInTheDocument();
      expect(screen.getByText('Complete feature X')).toBeInTheDocument();
    });
  });

  test('handles error states gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    await waitFor(() => {
      expect(screen.getByText(/error loading/i)).toBeInTheDocument();
    });
  });

  test('formats message timestamps correctly', async () => {
    const mockChannel = {
      id: 1,
      name: 'general',
      description: 'General discussion',
    };

    const mockMessage = {
      id: 1,
      content: 'Test message',
      author: { id: 2, displayName: 'John Doe', avatar: null },
      createdAt: new Date('2025-01-09T10:00:00Z'),
    };

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockChannel,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [mockMessage],
      });

    renderWithProviders({ 
      selectedChannel: 1, 
      selectedDmUser: null 
    });

    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      // Should show relative timestamp like "X minutes ago"
      expect(screen.getByText(/ago$/)).toBeInTheDocument();
    });
  });
});
