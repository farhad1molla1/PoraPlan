import React, { useEffect, useState, useCallback, useMemo } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  getProfile,
  resolvePoraPlanIdLogin,
  checkGoogleAccountLinked,
  connectPersonalEmail,
} from '../lib/profiles';
import {
  authenticateMockPoraPlanId,
  getMockProfile,
  resetMockPassword,
  getMockAccountById,
} from '../lib/mockAuthStore';
import { validatePasswordPolicy } from '../lib/passwordPolicy';
import type { Profile, UserRole, AccountStatus } from '../types/database';
import { AuthContext } from './authContextDef';

function getInitialMockState(isConfigured: boolean): {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
} {
  if (isConfigured || typeof window === 'undefined') {
    return { user: null, session: null, profile: null };
  }
  try {
    const cachedId = sessionStorage.getItem('poraplan_mock_session');
    if (cachedId) {
      const account = getMockAccountById(cachedId);
      if (account) {
        if (account.status === 'suspended') {
          try {
            sessionStorage.removeItem('poraplan_mock_session');
          } catch {
            // Storage access restricted
          }
          return { user: null, session: null, profile: null };
        }
        const mockProf = getMockProfile(account.id);
        if (mockProf?.status === 'suspended') {
          try {
            sessionStorage.removeItem('poraplan_mock_session');
          } catch {
            // Storage access restricted
          }
          return { user: null, session: null, profile: null };
        }
        const mockUsr = {
          id: account.id,
          email: account.authEmail,
          app_metadata: {},
          user_metadata: {
            full_name: account.fullName,
            poraplan_id: account.poraplanId,
            role: account.role,
            status: account.status,
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as unknown as User;
        const mockSess = {
          access_token: 'mock-session-token',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: { id: account.id } as User,
        } as unknown as Session;
        return { user: mockUsr, session: mockSess, profile: mockProf };
      }
    }
  } catch {
    // Storage access restricted
  }
  return { user: null, session: null, profile: null };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isConfigured = isSupabaseConfigured();
  const initialMock = getInitialMockState(isConfigured);

  const [user, setUser] = useState<User | null>(initialMock.user);
  const [session, setSession] = useState<Session | null>(initialMock.session);
  const [profile, setProfile] = useState<Profile | null>(initialMock.profile);
  const [loading, setLoading] = useState(isConfigured);

  // Helper to fetch profile with rigorous status and failure discrimination
  const fetchUserProfile = useCallback(
    async (currentUserId: string, currentUser?: User | null): Promise<Profile | null> => {
      if (!currentUserId) {
        return null;
      }

      // 1. If currentUser metadata explicitly marks account as suspended, fail-closed immediately
      if (currentUser?.user_metadata?.status === 'suspended') {
        if (isConfigured) {
          await supabase.auth.signOut();
        }
        setProfile(null);
        setUser(null);
        setSession(null);
        return null;
      }

      try {
        const { profile: userProfile, error } = await getProfile(currentUserId);

        // 2. Database profile returned successfully
        if (userProfile && !error) {
          if (userProfile.status === 'suspended') {
            // Immediately revoke session if user is suspended in database
            if (isConfigured) {
              await supabase.auth.signOut();
            }
            setProfile(null);
            setUser(null);
            setSession(null);
            return null;
          }

          // Valid profile (active, not_activated, etc.)
          setProfile(userProfile);
          return userProfile;
        }

        // 3. Database query returned an error
        if (error) {
          const errMsg = error.message ? error.message.toLowerCase() : '';
          const errCode = (error as { code?: string })?.code || '';

          // Check if error indicates permission denied / RLS blocking (e.g. suspended user attempting to query profiles)
          const isPermissionDenied =
            errCode === '42501' ||
            errMsg.includes('permission denied') ||
            errMsg.includes('row-level security');

          if (isPermissionDenied) {
            if (isConfigured) {
              await supabase.auth.signOut();
            }
            setProfile(null);
            setUser(null);
            setSession(null);
            return null;
          }

          // Check if error is a transient network failure
          const isNetworkFailure =
            errMsg.includes('failed to fetch') ||
            errMsg.includes('network') ||
            errMsg.includes('timeout') ||
            errMsg.includes('abort') ||
            errMsg.includes('connection refused') ||
            errMsg.includes('offline');

          if (isNetworkFailure) {
            // Transient network error: do NOT sign out legitimate user (Requirement 8),
            // but do NOT grant active student status (Requirements 1 & 9).
            setProfile(null);
            return null;
          }

          // Non-network query error: fail-safe, do not grant active status
          const isNotFound = errCode === 'PGRST116' || errMsg.includes('0 rows') || errMsg.includes('not found');
          if (!isNotFound) {
            setProfile(null);
            return null;
          }
        }

        // 4. Missing profile row (0 rows returned or new registration before trigger completion)
        // If user metadata exists for a fresh registration, construct fallback ONLY with 'not_activated' status.
        // Unresolved/unverified profiles must NEVER be granted 'active' status.
        if (currentUser?.user_metadata) {
          if (currentUser.user_metadata.status === 'suspended') {
            if (isConfigured) {
              await supabase.auth.signOut();
            }
            setProfile(null);
            setUser(null);
            setSession(null);
            return null;
          }

          const metaRole = (currentUser.user_metadata.role as UserRole) || 'student';
          // Strictly 'not_activated' for unconfirmed trigger fallback; NEVER silently grant 'active'
          const fallbackStatus: AccountStatus = 'not_activated';

          const fallbackProfile: Profile = {
            id: currentUserId,
            poraplan_id: currentUser.user_metadata.poraplan_id || null,
            full_name: currentUser.user_metadata.full_name || 'Academic Scholar',
            email: currentUser.email || '',
            linked_email: currentUser.user_metadata.linked_email || null,
            role: metaRole,
            status: fallbackStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          setProfile(fallbackProfile);
          return fallbackProfile;
        }

        // Profile missing and no metadata: profile remains null
        setProfile(null);
        return null;
      } catch {
        // Keep silent on transient network/runtime errors; ensure profile is never active
        setProfile(null);
      }
      return null;
    },
    [isConfigured]
  );

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
      password: string,
      captchaTokens?: { resolutionToken?: string; loginToken?: string }
    ): Promise<{ error: Error | null; role?: UserRole }> => {
      const cleanId = poraplanId.trim();
      if (!cleanId) {
        return { error: new Error('Please enter your PoraPlan ID.') };
      }
      if (!password) {
        return { error: new Error('Please enter your password.') };
      }

      if (!isConfigured) {
        // Local mode with strict pre-registered account verification
        const { account, error: authError } = authenticateMockPoraPlanId(cleanId, password);
        if (authError || !account || account.status === 'suspended') {
          return {
            error: new Error('Invalid PoraPlan ID or password.'),
          };
        }

        const mockProfile = getMockProfile(account.id);
        setProfile(mockProfile);
        setUser({
          id: account.id,
          email: account.authEmail,
          app_metadata: {},
          user_metadata: {
            full_name: account.fullName,
            poraplan_id: account.poraplanId,
            role: account.role,
            status: account.status,
          },
          aud: 'authenticated',
          created_at: new Date().toISOString(),
        } as unknown as User);

        try {
          sessionStorage.setItem('poraplan_mock_session', account.id);
        } catch {
          // Ignore storage quota
        }

        return { error: null, role: account.role };
      }

      try {
        // 1. Resolve PoraPlan ID with anti-enumeration protection and CAPTCHA
        const { resolution, error: resolveError } = await resolvePoraPlanIdLogin(
          cleanId,
          captchaTokens?.resolutionToken
        );
        if (resolveError || !resolution) {
          const msg = resolveError?.message || 'Invalid PoraPlan ID or password.';
          return { error: new Error(msg) };
        }

        if (resolution.status === 'suspended') {
          return {
            error: new Error('Invalid PoraPlan ID or password.'),
          };
        }

        // 2. Authenticate against Supabase Auth with fresh login CAPTCHA token if provided
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: resolution.authEmail,
          password,
          options: captchaTokens?.loginToken ? { captchaToken: captchaTokens.loginToken } : undefined,
        });

        if (signInError) {
          if (signInError.message?.toLowerCase().includes('captcha')) {
            return { error: new Error('Security verification failed. Please try again.') };
          }
          return {
            error: new Error('Invalid PoraPlan ID or password.'),
          };
        }

        if (data.user) {
          const loadedProfile = await fetchUserProfile(data.user.id, data.user);
          if (!loadedProfile || loadedProfile.status === 'suspended') {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            return {
              error: new Error('Invalid PoraPlan ID or password.'),
            };
          }

          // If first-time activation, update status to active
          if (resolution.status === 'not_activated') {
            await supabase
              .from('profiles')
              .update({ status: 'active' })
              .eq('id', data.user.id);
          }

          const finalRole = loadedProfile?.role || resolution.role;
          return { error: null, role: finalRole };
        }

        return { error: null, role: resolution.role };
      } catch {
        return { error: new Error('Invalid PoraPlan ID or password.') };
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
          if (!loadedProfile || loadedProfile.status === 'suspended') {
            await supabase.auth.signOut();
            setSession(null);
            setUser(null);
            setProfile(null);
            return {
              error: new Error('Invalid email or password.'),
            };
          }
          return { error: null, role: loadedProfile.role };
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
        error: new Error('Google sign-in requires live connection settings in .env.local.'),
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
    async (email: string, captchaToken?: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: null };
      }

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/reset-password`,
          captchaToken,
        });

        if (error) {
          if (error.message?.toLowerCase().includes('captcha')) {
            return { error: new Error('Security verification failed. Please try again.') };
          }
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
      const validation = validatePasswordPolicy(newPassword);
      if (!validation.valid) {
        return { error: new Error(validation.error || 'Password does not meet security requirements.') };
      }

      if (!isConfigured) {
        if (user?.email) {
          const res = resetMockPassword(user.email, newPassword);
          if (res.error) {
            return { error: res.error };
          }
        }
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
    [isConfigured, user]
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
    try {
      sessionStorage.removeItem('poraplan_mock_session');
    } catch {
      // Ignore storage error
    }
    if (isConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  }, [isConfigured]);

  const role = useMemo(() => {
    if (profile?.role) {
      return profile.role;
    }
    // If metadata explicitly indicates suspended, never grant any active role
    if (user?.user_metadata?.status === 'suspended') {
      return null;
    }
    return (user?.user_metadata?.role as UserRole) || null;
  }, [profile, user]);

  const poraplanId = useMemo(() => {
    return profile?.poraplan_id || (user?.user_metadata?.poraplan_id as string) || null;
  }, [profile, user]);

  const status = useMemo(() => {
    if (profile?.status) {
      return profile.status;
    }
    // Explicit suspension in metadata is enforced immediately
    if (user?.user_metadata?.status === 'suspended') {
      return 'suspended';
    }
    // Explicit not_activated status in metadata
    if (user?.user_metadata?.status === 'not_activated') {
      return 'not_activated';
    }
    // A failed or unavailable database profile lookup must NEVER silently grant 'active'
    return null;
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
