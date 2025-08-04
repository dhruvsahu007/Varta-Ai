import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useWebSocket } from '../../client/src/hooks/use-websocket';

// Mock the useAuth hook
jest.mock('../../client/src/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 1, username: 'testuser', displayName: 'Test User' },
  }),
}));

// Create a test component that uses the WebSocket hook
const TestWebSocketComponent = () => {
  const { 
    isConnected, 
    lastMessage, 
    sendMessage, 
    joinChannel, 
    leaveChannel, 
    sendTyping, 
    broadcastMessage 
  } = useWebSocket();

  return (
    <div>
      <div data-testid="connection-status">
        {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      {lastMessage && (
        <div data-testid="last-message">
          {JSON.stringify(lastMessage)}
        </div>
      )}
      <button onClick={() => joinChannel(1)} data-testid="join-channel">
        Join Channel
      </button>
      <button onClick={() => leaveChannel(1)} data-testid="leave-channel">
        Leave Channel
      </button>
      <button onClick={() => sendTyping(1, true)} data-testid="start-typing">
        Start Typing
      </button>
      <button onClick={() => broadcastMessage(1, { content: 'test' })} data-testid="send-message">
        Send Message
      </button>
    </div>
  );
};

describe('useWebSocket Hook', () => {
  let mockWebSocket: any;
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock WebSocket
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };

    const mockWebSocketConstructor = jest.fn().mockImplementation(() => mockWebSocket);
    Object.assign(mockWebSocketConstructor, {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    });

    global.WebSocket = mockWebSocketConstructor as any;
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  test('establishes WebSocket connection on mount', () => {
    renderWithProviders(<TestWebSocketComponent />);

    expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:5000/ws');
  });

  test('sends authentication message on connection open', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection open
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'auth', userId: 1 })
    );
  });

  test('updates connection status correctly', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Initially disconnected
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');

    // Simulate connection open
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
  });

  test('handles incoming messages', () => {
    renderWithProviders(<TestWebSocketComponent />);

    const testMessage = { type: 'new_message', content: 'Hello' };

    // Simulate incoming message
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage({
        data: JSON.stringify(testMessage),
      });
    }

    expect(screen.getByTestId('last-message')).toHaveTextContent(
      JSON.stringify(testMessage)
    );
  });

  test('sends join channel message', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection open
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }

    fireEvent.click(screen.getByTestId('join-channel'));

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'join_channel', channelId: 1 })
    );
  });

  test('sends leave channel message', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection open
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }

    fireEvent.click(screen.getByTestId('leave-channel'));

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: 'leave_channel', channelId: 1 })
    );
  });

  test('sends typing indicator', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection open
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }

    fireEvent.click(screen.getByTestId('start-typing'));

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ 
        type: 'typing', 
        channelId: 1, 
        userId: 1, 
        isTyping: true 
      })
    );
  });

  test('broadcasts message', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection open
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }

    fireEvent.click(screen.getByTestId('send-message'));

    expect(mockWebSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'new_message',
        channelId: 1,
        recipientId: null,
        data: { content: 'test' }
      })
    );
  });

  test('handles connection close', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection open then close
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen();
    }
    if (mockWebSocket.onclose) {
      mockWebSocket.onclose();
    }

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
  });

  test('handles connection error', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate connection error
    if (mockWebSocket.onerror) {
      mockWebSocket.onerror(new Event('error'));
    }

    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    
    consoleSpy.mockRestore();
  });

  test('handles malformed incoming messages', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    renderWithProviders(<TestWebSocketComponent />);

    // Simulate malformed message
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage({
        data: 'invalid json',
      });
    }

    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse WebSocket message:',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  test('does not send messages when connection is closed', () => {
    renderWithProviders(<TestWebSocketComponent />);

    // Keep connection closed
    mockWebSocket.readyState = WebSocket.CLOSED;

    fireEvent.click(screen.getByTestId('join-channel'));

    // Should not send message when connection is closed
    expect(mockWebSocket.send).not.toHaveBeenCalled();
  });

  test('closes WebSocket on unmount', () => {
    const { unmount } = renderWithProviders(<TestWebSocketComponent />);

    unmount();

    expect(mockWebSocket.close).toHaveBeenCalled();
  });
});
