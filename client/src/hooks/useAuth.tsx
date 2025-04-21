import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { apiRequest } from '../lib/queryClient';

// Define user type
export type User = {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  avatar?: string;
  isAdmin?: boolean;
};

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  login: () => void;
  logout: () => Promise<void>;
  checkAuthStatus: () => Promise<void>;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  login: () => {},
  logout: async () => {},
  checkAuthStatus: async () => {},
});

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Check if user is authenticated
  const checkAuthStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiRequest('GET', '/auth/status');
      const data = await response.json();
      
      if (data.isAuthenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err as Error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Login function - redirect to GitHub authentication
  const login = () => {
    window.location.href = '/auth/github';
  };
  
  // Logout function
  const logout = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/auth/logout');
      await response.json();
      setUser(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check authentication status on component mount
  useEffect(() => {
    checkAuthStatus();
  }, []);
  
  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    logout,
    checkAuthStatus,
  };
  
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);