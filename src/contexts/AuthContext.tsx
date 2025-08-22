import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/lib/types';
import { AuthService } from '@/lib/services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, userData: Partial<User>) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize Firebase Auth with permanent persistence
    AuthService.initializeAuth();

    const unsubscribe = AuthService.onAuthStateChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get user data from Firestore
          const userData = await AuthService.getUserData(firebaseUser.uid);
          setUser(userData);
        } catch (error) {
          console.error('Error getting user data:', error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const userData = await AuthService.signIn(username, password);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const signUp = async (username: string, password: string, userData: Partial<User>) => {
    try {
      const newUser = await AuthService.signUp(username, password, userData);
      setUser(newUser);
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await AuthService.signOut();
      setUser(null);
    } catch (error) {
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};


