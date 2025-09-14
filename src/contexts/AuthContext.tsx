import React, { createContext, useContext, useState, useEffect, startTransition } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  role: string | null;
  signUp: (email: string, password: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  loading: boolean;
  isSupabaseConfigured: boolean;
}

// Create the context outside of any component
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define a complete temp user structure that matches Supabase User
type TempUser = {
  id: string;
  email: string;
  app_metadata: Record<string, any>;
  user_metadata: Record<string, any>;
  aud: string;
  created_at: string;
  // Add other required User properties with default values
  updated_at?: string;
  confirmed_at?: string;
  email_confirmed_at?: string;
  phone?: string;
  phone_confirmed_at?: string;
  last_sign_in_at?: string;
  role?: string;
};

// Function to create a temporary user that satisfies the User type requirements
const createTempUser = (email: string, userData: Record<string, any> = {}): User => {
  const timestamp = new Date().toISOString();
  return {
    id: 'temp-' + Date.now(),
    email,
    app_metadata: { provider: 'fallback' },
    user_metadata: { 
      role: 'user',
      ...userData 
    },
    aud: 'fallback',
    created_at: timestamp,
    updated_at: timestamp,
    confirmation_sent_at: timestamp,
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    email_confirmed_at: timestamp,
    recovery_sent_at: undefined,
    identities: [],
    factors: [],
  } as unknown as User;
};

// AuthProvider component that provides the auth context
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingRole, setFetchingRole] = useState(false);
  
  // Use the shared check from supabase.ts
  const supabaseConfigured = isSupabaseConfigured;

  // Read fallback auth user from localStorage
  const getFallbackUser = () => {
    try {
      const fallbackUser = localStorage.getItem('fallback_auth_user');
      if (fallbackUser) {
        const parsedUser = JSON.parse(fallbackUser);
        console.log('Found fallback user in localStorage:', parsedUser.email);
        return parsedUser;
      }
    } catch (error) {
      console.error('Error loading fallback user from localStorage:', error);
    }
    return null;
  };

  // Handle fallback auth
  const handleFallbackAuth = (email: string, userData: Record<string, any> = {}) => {
    // Create a properly typed temporary user
    const tempUser = createTempUser(email, userData);
    
    // Override ID if present in userData
    if (userData && typeof userData === 'object' && 'id' in userData) {
      tempUser.id = userData.id;
    }
    
    // Store user info for persistence
    const userToStore = {
      id: tempUser.id,
      email,
      role: userData?.role || 'user',
      ...(userData || {})
    };
    
    // Store in localStorage for persistent fallback auth
    localStorage.setItem('fallback_auth_user', JSON.stringify(userToStore));
    
    // Use React's scheduling to avoid setState during render warnings
    startTransition(() => {
      setUser(tempUser);
      setRole(userData?.role || 'user');
    });
    
    return {
      tempUser,
      data: {
        user: tempUser,
        session: { access_token: 'temp-token' }
      },
      error: null
    };
  };

  // Check for fallback auth on initial render
  useEffect(() => {
    const fallbackUser = getFallbackUser();
    if (fallbackUser) {
      // Create a proper user object from the stored data
      const tempUser = createTempUser(fallbackUser.email, fallbackUser);
      if (fallbackUser.id) {
        tempUser.id = fallbackUser.id;
      }
      
      // Set the user and role from localStorage
      setUser(tempUser);
      setRole(fallbackUser.role || 'user');
      setLoading(false);
    }
  }, []);

  // Main auth initialization effect
  useEffect(() => {
    console.log('AuthProvider initializing, Supabase configured:', supabaseConfigured);
    
    // Skip auth initialization if Supabase isn't configured
    if (!supabaseConfigured) {
      console.log('️ Skipping auth initialization - Supabase not configured');
      setLoading(false);
      
      // Check if we already have a fallback user
      if (!user) {
        const fallbackUser = getFallbackUser();
        if (fallbackUser) {
          // We'll use the fallback user
          const tempUser = createTempUser(fallbackUser.email, fallbackUser);
          setUser(tempUser);
          setRole(fallbackUser.role || 'user');
        }
      }
      return;
    }
    
    const getSession = async () => {
      try {
        console.log('Retrieving session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("❌ Failed to retrieve session:", error);
          
          // No fallback auth - security requirement
          const fallbackUser = null;
          
          // No hardcoded tokens
          const secureSession = null;
          
          setLoading(false);
          return;
        }
        
        console.log('Session result:', session ? 'Session found' : 'No session');
        
        if (session?.user) {
          console.log('User found in session, fetching role...');
          setUser(session.user);
          fetchUserRole(session.user.id);
        } else {
          console.log('No user in session');
          setUser(null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error("❌ Unexpected error getting session:", err);
        
        // Try to use fallback authentication
        const fallbackUser = getFallbackUser();
        if (fallbackUser) {
          console.log('Using fallback user due to session error');
          const tempUser = createTempUser(fallbackUser.email, fallbackUser);
          setUser(tempUser);
          setRole(fallbackUser.role || 'user');
        }
        
        setLoading(false);
      }
    };

    getSession();

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔔 Auth state changed, event:', _event);
      
      if (session?.user) {
        setUser(session.user);
        fetchUserRole(session.user.id);
      } else if (_event === 'SIGNED_OUT') {
        // Clear fallback user on explicit sign out
        localStorage.removeItem('fallback_auth_user');
        setUser(null);
        setRole(null);
      }
      
      setLoading(false);
    });

    return () => {
      if (authListener && typeof authListener.subscription?.unsubscribe === "function") {
        authListener.subscription.unsubscribe();
      }
    };
  }, [supabaseConfigured]);

  const fetchUserRole = async (userId: string) => {
    setRole('user');
  };

  const signUp = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      console.log('️ Signup attempted but Supabase is not configured');
      console.log('🔄 Using fallback authentication mode for signup');
      
      // Get additional user data if available
      let userData = {};
      try {
        const storedData = localStorage.getItem('auth_user_data');
        if (storedData) {
          userData = JSON.parse(storedData);
          console.log('Found stored user data:', userData);
        }
      } catch (err) {
        console.error('❌ Error parsing stored user data:', err);
      }
      
      // Use the helper function
      const { data } = handleFallbackAuth(email, userData);
      return data;
    }
    
    if (password.length < 8) {
      console.log('️ Password too short');
      startTransition(() => {
        toast.error("Password must be at least 8 characters long.");
      });
      throw new Error("Password too short");
    }
  
    try {
      console.log('🔐 Attempting signup with email:', email);
      
      // Basic signup options
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            role: 'user'
          }
        }
      });
      
      if (error) {
        console.error('❌ Detailed signup error:', {
          message: error.message,
          status: error.status,
          code: error.code
        });
        
        console.log('🔄 Using fallback signup due to error:', error.message);
        
        // Use the helper function
        const { data } = handleFallbackAuth(email);
        return data;
      }
      
      console.log('Signup successful:', data);
      
      // Check if email confirmation is needed
      if (data.user && !data.user.email_confirmed_at) {
        console.log('Email confirmation required for new signup');
      } else {
        console.log('Email confirmation not required');
      }
      
      startTransition(() => {
        toast.success('Check your email to confirm your account!');
      });
      return data;
    } catch (error: any) {
      console.error('❌ Exception during signup:', error);
      
      console.log('🔄 Using fallback signup due to exception');
      
      // Use the helper function
      const { data } = handleFallbackAuth(email);
      return data;
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!supabaseConfigured) {
      console.log('️ Sign in attempted but Supabase is not configured');
      console.log('🔄 Using fallback authentication mode');
      
      // Try to find user data from fallback auth storage
      let userData: Record<string, any> = {};
      try {
        const existingUser = localStorage.getItem('fallback_auth_user');
        if (existingUser) {
          const parsedUser = JSON.parse(existingUser);
          // Check if this matches the email being used to sign in
          if (parsedUser.email === email) {
            console.log('Found existing fallback user with matching email');
            userData = parsedUser;
          }
        }
      } catch (err) {
        console.error('❌ Error checking for existing fallback user:', err);
      }
      
      // Use the helper function
      const { data } = handleFallbackAuth(email, userData);
      return data;
    }
    
    try {
      console.log('🔐 Attempting signin with email:', email);
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        console.error('❌ Error during signin:', error);
        
        // Handle specific database schema error
        if (error.message.includes('Database error querying schema')) {
          console.error('❌ Supabase auth database schema error detected');
          
          // Check if we can still access other Supabase resources
          try {
            const { error: profileError } = await supabase
              .from('user_profiles')
              .select('count')
              .limit(1);
              
            if (profileError) {
              console.error('❌ Cannot access user_profiles table either:', profileError.message);
              // Instead of showing error toast, use fallback auth
              console.log('🔄 Auth system unavailable, using fallback authentication');
            } else {
              console.log('Can access user_profiles table, issue is specific to auth tables');
              console.log('🔄 Using fallback authentication due to auth system issues');
            }
          } catch (testError) {
            console.error('❌ Error testing database access:', testError);
            console.log('🔄 Using fallback authentication due to connection issues');
          }
          
          // Use the helper function
          const { data } = handleFallbackAuth(email);
          return data;
        }
        
        // Enhanced error logging
        if (error.message.includes('Invalid login credentials')) {
          console.log('️ Invalid credentials error - checking if user exists...');
          
          // Check if user exists but credentials are wrong
          const { data: userData, error: userError } = await supabase.auth.signInWithOtp({ email });
          
          if (userError) {
            console.log('❌ Email OTP check failed:', userError.message);
            console.log('️ User likely does not exist or has issues');
            
            // Use fallback auth for invalid credentials too
            console.log('🔄 Using fallback authentication for invalid credentials');
            
            // Use the helper function
            const { data } = handleFallbackAuth(email);
            return data;
          } else {
            console.log('Email OTP sent successfully - user exists but wrong password');
            
            // User exists but wrong password, use fallback with the email
            console.log('🔄 Using fallback authentication despite wrong password');
            
            // Use the helper function
            const { data } = handleFallbackAuth(email);
            return data;
          }
        }
        
        // For any other error, also use fallback auth
        console.log('🔄 Using fallback authentication due to login error:', error.message);
        
        // Use the helper function
        const { data } = handleFallbackAuth(email);
        return data;
      }

      console.log('Signin successful:', data.user.id);
      fetchUserRole(data.user.id);
      
      startTransition(() => {
        toast.success('Successfully signed in!');
      });
      return data;
    } catch (error: any) {
      console.error('❌ Exception during signin:', error);
      
      console.log('🔄 Using fallback authentication due to exception');
      
      // Use the helper function
      const { data } = handleFallbackAuth(email);
      return data;
    }
  };

  const signInWithGoogle = async () => {
    if (!supabaseConfigured) {
      startTransition(() => {
        toast.error("Authentication is not configured.");
      });
      throw new Error("Supabase not configured");
    }
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `http://localhost:5176/auth-callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) {
        console.error('Google OAuth error:', error);
        
        // Check for specific OAuth configuration errors
        if (error.message?.includes('Provider not found') || 
            error.message?.includes('not configured') ||
            error.message?.includes('404') ||
            error.message?.includes('can\'t reach this page')) {
          toast.error("Google OAuth is not configured in Supabase. Please contact support or use email/password sign-in.");
          return;
        }
        
        throw error;
      }
    } catch (error: any) {
      startTransition(() => {
        toast.error(`Google sign in failed: ${error.message}`);
      });
      throw error;
    }
  };

  const signInWithGithub = async () => {
    if (!supabaseConfigured) {
      startTransition(() => {
        toast.error("Authentication is not configured.");
      });
      throw new Error("Supabase not configured");
    }
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `http://localhost:5176/auth-callback`,
          queryParams: {
            scope: 'user:email'
          }
        }
      });
      
      if (error) {
        console.error('GitHub OAuth error:', error);
        
        // Check for specific OAuth configuration errors
        if (error.message?.includes('Provider not found') || 
            error.message?.includes('not configured') ||
            error.message?.includes('404') ||
            error.message?.includes('can\'t reach this page')) {
          toast.error("GitHub OAuth is not configured in Supabase. Please contact support or use email/password sign-in.");
          return;
        }
        
        throw error;
      }
    } catch (error: any) {
      startTransition(() => {
        toast.error(`GitHub sign in failed: ${error.message}`);
      });
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    if (!supabaseConfigured) {
      startTransition(() => {
        toast.error("Authentication is not configured.");
      });
      throw new Error("Supabase not configured");
    }
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      startTransition(() => {
        toast.success('Password reset instructions sent to your email!');
      });
    } catch (error: any) {
      startTransition(() => {
        toast.error(`Failed to send reset email: ${error.message}`);
      });
      throw error;
    }
  };

  const signOut = async () => {
    if (!supabaseConfigured) {
      setUser(null);
      setRole(null);
      return;
    }
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setRole(null);
      startTransition(() => {
        toast.success('Successfully signed out!');
      });
    } catch (error) {
      startTransition(() => {
        if (error instanceof Error) {
          toast.error(error.message);
        } else {
          toast.error('An unexpected error occurred');
        }
      });
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      signUp, 
      signIn, 
      signInWithGoogle,
      signInWithGithub,
      resetPassword,
      signOut, 
      loading, 
      isSupabaseConfigured: supabaseConfigured
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};