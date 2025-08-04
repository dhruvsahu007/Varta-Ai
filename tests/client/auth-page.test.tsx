import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../client/src/hooks/use-auth';
import { AuthContext } from '../../client/src/hooks/use-auth';
import AuthPage from '../../client/src/pages/auth-page-fixed';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import type { User } from '../../shared/schema';

// Mock the API
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

// Mock wouter
jest.mock('wouter', () => ({
  useLocation: () => ['/auth', jest.fn()],
  Redirect: ({ to }: { to: string }) => <div data-testid="redirect">{to}</div>,
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {component}
      </AuthProvider>
    </QueryClientProvider>
  );
};

describe('AuthPage', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  test('renders login form by default', () => {
    renderWithProviders(<AuthPage />);
    
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  test('switches to registration form when clicking register link', () => {
    renderWithProviders(<AuthPage />);
    
    const registerLink = screen.getByText(/don't have an account/i).closest('button');
    fireEvent.click(registerLink!);
    
    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Display Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm Password')).toBeInTheDocument();
  });

  test('handles login form submission', async () => {
    const mockUser: User = {
      id: 1,
      username: 'testuser',
      displayName: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      avatar: null,
      status: 'available',
      title: null,
      createdAt: new Date(),
    };
    (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    } as Response);

    renderWithProviders(<AuthPage />);
    
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'password123' }),
      });
    });
  });

  test('handles registration form submission', async () => {
    const mockUser = { id: 1, username: 'newuser', displayName: 'New User' };
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockUser,
    });

    renderWithProviders(<AuthPage />);
    
    // Switch to registration form
    const registerLink = screen.getByText(/don't have an account/i).closest('button');
    fireEvent.click(registerLink!);
    
    // Fill registration form
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Display Name'), {
      target: { value: 'New User' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'newuser',
          displayName: 'New User',
          email: 'newuser@example.com',
          password: 'password123',
          confirmPassword: 'password123',
          status: 'available',
          title: '',
        }),
      });
    });
  });

  test('shows validation errors for invalid input', async () => {
    renderWithProviders(<AuthPage />);
    
    // Try to submit empty form
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    
    await waitFor(() => {
      expect(screen.getByText(/username is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
  });

  test('handles login API error', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Invalid credentials'));

    renderWithProviders(<AuthPage />);
    
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'wrongpassword' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  test('validates password confirmation in registration', async () => {
    renderWithProviders(<AuthPage />);
    
    // Switch to registration form
    const registerLink = screen.getByText(/don't have an account/i).closest('button');
    fireEvent.click(registerLink!);
    
    // Fill form with mismatched passwords
    fireEvent.change(screen.getByPlaceholderText('Username'), {
      target: { value: 'newuser' },
    });
    fireEvent.change(screen.getByPlaceholderText('Display Name'), {
      target: { value: 'New User' },
    });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'newuser@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), {
      target: { value: 'differentpassword' },
    });
    
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
  });

  test('redirects when user is already authenticated', () => {
    const mockUser = { id: 1, username: 'testuser', displayName: 'Test User' };
    const mockAuthContext = {
      user: mockUser,
      isLoading: false,
      error: null,
      loginMutation: {} as any,
      logoutMutation: {} as any,
      registerMutation: {} as any,
    };

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthContext}>
          <AuthPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('redirect')).toHaveTextContent('/');
  });

  test('shows loading state during authentication', () => {
    const mockAuthContext = {
      user: null,
      isLoading: true,
      error: null,
      loginMutation: {} as any,
      logoutMutation: {} as any,
      registerMutation: {} as any,
    };

    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={mockAuthContext}>
          <AuthPage />
        </AuthContext.Provider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
