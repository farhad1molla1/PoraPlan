import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getProfile,
  resolvePoraPlanIdLogin,
  checkGoogleAccountLinked,
  connectPersonalEmail,
} from '../lib/profiles';
import type { Profile, UserRole, AccountStatus } from '../types/database';
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
          poraplan_id: currentUser.user_metadata.poraplan_id || null,
          full_name: currentUser.user_metadata.full_name || 'Academic Scholar',
          email: currentUser.email || '',
          linked_email: currentUser.user_metadata.linked_email || null,
          role: metaRole,
          status: 'active',
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
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (initialSession?.user) {
        // If Google provider, verify that the email is linked to an authorized PoraPlan account
        const isGoogleUser =
          initialSession.user.app_metadata?.provider === 'google' ||
          initialSession.user.identities?.some((id) => id.provider === 'google');

        if (isGoogleUser && initialSession.user.email) {
          const { isLinked } = await checkGoogleAccountLinked(initialSession.user.email);
          if (!isLinked) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            if (!window.location.pathname.includes('/login')) {
              window.location.href = '/login?error=google_not_linked';
            }
            return;
          }
        }

        setSession(initialSession);
        setUser(initialSession.user);
        await fetchUserProfile(initialSession.user.id, initialSession.user);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    // 2. Real-time auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (newSession?.user) {
        const isGoogleUser =
          newSession.user.app_metadata?.provider === 'google' ||
          newSession.user.identities?.some((id) => id.provider === 'google');

        if (isGoogleUser && newSession.user.email && event === 'SIGNED_IN') {
          const { isLinked } = await checkGoogleAccountLinked(newSession.user.email);
          if (!isLinked) {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            setLoading(false);
            window.location.href = '/login?error=google_not_linked';
            return;
          }
        }

        setSession(newSession);
        setUser(newSession.user);
        await fetchUserProfile(newSession.user.id, newSession.user);
      } else {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, fetchUserProfile]);

  /**
   * PRIMARY LOGIN METHOD: PoraPlan ID + Password
   * Allows students/mentors to authenticate using their unique PoraPlan ID (e.g. PP001, PPM001)
   */
  const signInWithPoraPlanId = useCallback(
    async (
      poraplanId: string,
      password: string
    ): Promise<{ error: Error | null; role?: UserRole }> => {
      const cleanId = poraplanId.trim();
      if (!cleanId) {
        return { error: new Error('Please enter your PoraPlan ID.') };
      }
      if (!password) {
        return { error: new Error('Please enter your password.') };
      }

      if (!isConfigured) {
        // Demo / unconfigured mode fallback
        const upperId = cleanId.toUpperCase();
        const isMentor = upperId.startsWith('PPM');
        const isAdmin = upperId.startsWith('PPA');
        const resolvedRole: UserRole = isAdmin ? 'admin' : isMentor ? 'mentor' : 'student';

        const mockProfile: Profile = {
          id: `mock-${cleanId.toLowerCase()}`,
          poraplan_id: upperId,
          full_name: `${upperId} Member`,
          email: `${cleanId.toLowerCase()}@poraplan.internal`,
          role: resolvedRole,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(mockProfile);
        return { error: null, role: resolvedRole };
      }

      try {
        // 1. Resolve PoraPlan ID to credentials and check registration status
        const { resolution, error: resolveError } = await resolvePoraPlanIdLogin(cleanId);
        if (resolveError || !resolution) {
          return {
            error: new Error(
              resolveError?.message ||
                'This PoraPlan ID is not recognized. Please verify your ID with your mentor.'
            ),
          };
        }

        if (resolution.status === 'suspended') {
          return {
            error: new Error(
              'This account is currently suspended. Please contact your mentor or administrator.'
            ),
          };
        }

        // 2. Authenticate against Supabase Auth
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: resolution.authEmail,
          password,
        });

        if (signInError) {
          return {
            error: new Error(
              'Incorrect password. Please verify and try again, or use password recovery if you have an associated email.'
            ),
          };
        }

        if (data.user) {
          // If first-time activation, update status to active
          if (resolution.status === 'not_activated') {
            await supabase
              .from('profiles')
              .update({ status: 'active' })
              .eq('id', data.user.id);
          }

          const loadedProfile = await fetchUserProfile(data.user.id, data.user);
          const finalRole = loadedProfile?.role || resolution.role;
          return { error: null, role: finalRole };
        }

        return { error: null, role: resolution.role };
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        return { error };
      }
    },
    [isConfigured, fetchUserProfile]
  );

  /**
   * Legacy email/password sign in for backward compatibility
   */
  const signIn = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{ error: Error | null; role?: UserRole }> => {
      if (!isConfigured) {
        return {
          error: new Error('Supabase client is not configured.'),
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

  /**
   * Internal / Admin sign up helper (public self-signup is disabled on user-facing UI)
   */
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      fullName: string,
      role: UserRole
    ): Promise<{ error: Error | null; role?: UserRole }> => {
      if (!isConfigured) {
        return { error: new Error('Supabase client is not configured.') };
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

  /**
   * SECONDARY LOGIN METHOD: Continue with Google
   * Only permitted for existing members whose Google email is pre-linked.
   */
  const signInWithGoogle = useCallback(async (): Promise<{ error: Error | null }> => {
    if (!isConfigured) {
      return {
        error: new Error('Supabase credentials are not configured yet in .env.local.'),
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

  /**
   * PASSWORD RECOVERY: Send secure reset link to associated email
   */
  const resetPassword = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: null };
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/reset-password`,
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

  /**
   * Update new password during recovery flow
   */
  const updateNewPassword = useCallback(
    async (newPassword: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: null };
      }

      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
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

  /**
   * Connect / link personal email address to active PoraPlan account
   */
  const connectEmail = useCallback(
    async (email: string): Promise<{ error: Error | null }> => {
      if (!user?.id) {
        return { error: new Error('You must be logged in to connect an email address.') };
      }

      const { success, error } = await connectPersonalEmail(user.id, email);
      if (!success || error) {
        return { error: error || new Error('Could not link email address.') };
      }

      await refreshProfile();
      return { error: null };
    },
    [user, refreshProfile]
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

  const poraplanId = useMemo(() => {
    return profile?.poraplan_id || (user?.user_metadata?.poraplan_id as string) || null;
  }, [profile, user]);

  const status = useMemo(() => {
    return profile?.status || (user?.user_metadata?.status as AccountStatus) || null;
  }, [profile, user]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      role,
      poraplanId,
      status,
      loading,
      isConfigured,
      signInWithPoraPlanId,
      signIn,
      signInWithGoogle,
      resetPassword,
      updateNewPassword,
      connectEmail,
      signUp,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      role,
      poraplanId,
      status,
      loading,
      isConfigured,
      signInWithPoraPlanId,
      signIn,
      signInWithGoogle,
      resetPassword,
      updateNewPassword,
      connectEmail,
      signUp,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
