import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/components/ui/use-toast";
import { API_ENDPOINTS } from "@/config";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema } from "@/lib/validations";
import { Redirect } from "wouter";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = {
  username: string;
  password: string;
};

type RegisterData = LoginData & {
  email: string;
  displayName: string;
  confirmPassword: string;
  status: string;
  title: string;
};

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: [API_ENDPOINTS.USER],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", API_ENDPOINTS.LOGIN, credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData([API_ENDPOINTS.USER], user);
      toast({
        title: "Login successful",
      });
    },
    onError: (error: Error) => {
      console.error("Login error:", error);
      const errorMessage = error.message.includes(':') 
        ? error.message.split(':').slice(1).join(':').trim()
        : error.message;
      toast({
        title: "Login failed",
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log('[Auth] Attempting registration with:', credentials);
      const res = await apiRequest("POST", API_ENDPOINTS.REGISTER, credentials);
      const result = await res.json();
      console.log('[Auth] Registration successful:', result);
      return result;
    },
    onSuccess: (user: SelectUser) => {
      console.log('[Auth] Registration onSuccess called with:', user);
      queryClient.setQueryData([API_ENDPOINTS.USER], user);
      toast({
        title: "Registration successful",
      });
    },
    onError: (error: Error) => {
      console.error("[Auth] Registration error:", error);
      const errorMessage = error.message.includes(':') 
        ? error.message.split(':').slice(1).join(':').trim()
        : error.message;
      toast({
        title: "Registration failed",
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", API_ENDPOINTS.LOGOUT);
    },
    onSuccess: () => {
      queryClient.setQueryData([API_ENDPOINTS.USER], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
