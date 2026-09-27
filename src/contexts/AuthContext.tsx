import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getProfile } from '../lib/profiles';
import type { Profile, UserRole } from '../types/database';
import { AuthContext } from './authContextDef';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isConfigured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  // Helper to fetch profile with fallbacks
  const fetchUserProfile = useCallback(async (currentUserId: string, currentUser?: User | null) => {
    try {
      const { profile: userProfile, error } = await getProfile(currentUserId);
      if (userProfile && !error) {
        setProfile(userProfile);
        return userProfile;
      }

      // Fallback: extract from user metadata if trigger has slight latency
      if (currentUser?.user_metadata) {
        const metaRole = (currentUser.user_metadata.role as UserRole) || 'student';
        const fallbackProfile: Profile = {
          id: currentUserId,
          full_name: currentUser.user_metadata.full_name || 'Academic Scholar',
          email: currentUser.email || '',
          role: metaRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(fallbackProfile);
        return fallbackProfile;
      }
    } catch {
      // Keep silent on transient network errors
    }
    return null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchUserProfile(user.id, user);
    }
  }, [user, fetchUserProfile]);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    // 1. Initial session load
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        fetchUserProfile(initialSession.user.id, initialSession.user).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        await fetchUserProfile(newSession.user.id, newSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, fetchUserProfile]);

  const signIn = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ error: Error | null; role?: UserRole }> => {
      if (!isConfigured) {
        return {
          error: new Error(
            'Supabase credentials are not configured yet in .env.local. Please provide valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          ),
        };
      }

      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { error };
        }

        if (data.user) {
          const loadedProfile = await fetchUserProfile(data.user.id, data.user);
          const resolvedRole =
            loadedProfile?.role || (data.user.user_metadata?.role as UserRole) || 'student';
          return { error: null, role: resolvedRole };
        }

        return { error: null };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { error };
      }
    },
    [isConfigured, fetchUserProfile]
  );

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: UserRole
    ): Promise<{ error: Error | null; role?: UserRole }> => {
      if (!isConfigured) {
        return {
          error: new Error(
            'Supabase credentials are not configured yet in .env.local. Please provide valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          ),
        };
      }

      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
          },
        });

        if (error) {
          return { error };
        }

        if (data.user) {
          await fetchUserProfile(data.user.id, data.user);
          return { error: null, role };
        }

        return { error: null, role };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { error };
      }
    },
    [isConfigured, fetchUserProfile]
  );

  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    if (!isConfigured) {
      return {
        error: new Error(
          'Supabase credentials are not configured yet in .env.local. Please provide valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
        ),
      };
    }

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        return { error };
      }

      return { error: null };
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { error };
    }
  }, [isConfigured]);

  const resetPassword = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return {
          error: new Error(
            'Supabase credentials are not configured yet in .env.local. Please provide valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
          ),
        };
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login?reset=true`,
        });

        if (error) {
          return { error };
        }

        return { error: null };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { error };
      }
    },
    [isConfigured]
  );

  const signOut = useCallback(async (): Promise<void> => {
    if (isConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, [isConfigured]);

  const role = useMemo(() => {
    return profile?.role || (user?.user_metadata?.role as UserRole) || null;
  }, [profile, user]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      role,
      loading,
      isConfigured,
      signIn,
      signInWithGoogle,
      resetPassword,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      role,
      loading,
      isConfigured,
      signIn,
      signInWithGoogle,
      resetPassword,
      signUp,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
