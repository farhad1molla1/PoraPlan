import { supabase, isSupabaseConfigured } from './supabase';
import type { Profile, ProfileUpdate, UserRole, AccountStatus } from '../types/database';
import {
  resolveMockPoraPlanId,
  checkMockGoogleLinked,
  connectMockPersonalEmail,
  getMockProfile,
  updateMockProfile,
} from './mockAuthStore';

export interface PoraPlanIdResolution {
  authEmail: string;
  status: AccountStatus;
  role: UserRole;
  poraplanId: string;
}

/**
 * Fetch a profile by user ID.
 */
export async function getProfile(userId: string): Promise<{
  profile: Profile | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const mockProfile = getMockProfile(userId);
    if (mockProfile) {
      return { profile: mockProfile, error: null };
    }
    return { profile: null, error: new Error('User profile not found') };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { profile: null, error };
    }

    return { profile: data as Profile, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { profile: null, error };
  }
}

/**
 * Resolves a PoraPlan ID (e.g. PP001, PPM001) to its corresponding auth credentials & status.
 * Uses the secure RPC function resolve_poraplan_id_login with fallback to profiles table.
 * Rejects unauthorized or non-existent PoraPlan IDs (e.g. PP999).
 */
export async function resolvePoraPlanIdLogin(poraplanId: string): Promise<{
  resolution: PoraPlanIdResolution | null;
  error: Error | null;
}> {
  const cleanId = poraplanId.trim();
  if (!cleanId) {
    return { resolution: null, error: new Error('Please enter your PoraPlan ID.') };
  }

  if (!isSupabaseConfigured()) {
    const mockRes = resolveMockPoraPlanId(cleanId);
    if (!mockRes) {
      return {
        resolution: null,
        error: new Error('This PoraPlan ID is not recognized. Please verify your ID with your mentor.'),
      };
    }
    return {
      resolution: {
        authEmail: mockRes.authEmail,
        status: mockRes.status,
        role: mockRes.role,
        poraplanId: mockRes.poraplanId,
      },
      error: null,
    };
  }

  try {
    // 1. Try secure RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'resolve_poraplan_id_login',
      { p_poraplan_id: cleanId }
    );

    if (!rpcError && rpcData && rpcData.length > 0) {
      const match = rpcData[0];
      return {
        resolution: {
          authEmail: match.auth_email,
          status: (match.account_status as AccountStatus) || 'active',
          role: (match.account_role as UserRole) || 'student',
          poraplanId: match.resolved_poraplan_id || cleanId.toUpperCase(),
        },
        error: null,
      };
    }

    // 2. Direct query fallback on profiles table (case-insensitive)
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('email, status, role, poraplan_id')
      .ilike('poraplan_id', cleanId)
      .limit(1)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      return { resolution: null, error: profileError };
    }

    if (profileData) {
      return {
        resolution: {
          authEmail: profileData.email,
          status: (profileData.status as AccountStatus) || 'active',
          role: profileData.role,
          poraplanId: profileData.poraplan_id || cleanId.toUpperCase(),
        },
        error: null,
      };
    }

    // ID not found in database: unauthorized/invented ID
    return {
      resolution: null,
      error: new Error('This PoraPlan ID is not recognized. Please verify your ID with your mentor.'),
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resolution: null, error };
  }
}

/**
 * Checks whether an incoming Google email is linked to an existing, pre-registered PoraPlan member.
 */
export async function checkGoogleAccountLinked(email: string): Promise<{
  isLinked: boolean;
  poraplanId?: string;
  role?: UserRole;
  status?: AccountStatus;
  error: Error | null;
}> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { isLinked: false, error: new Error('Invalid email provided.') };
  }

  if (!isSupabaseConfigured()) {
    const mockCheck = checkMockGoogleLinked(cleanEmail);
    return {
      isLinked: mockCheck.isLinked,
      poraplanId: mockCheck.poraplanId,
      role: mockCheck.role,
      status: mockCheck.status,
      error: null,
    };
  }

  try {
    // 1. Try secure RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'check_google_account_linked',
      { p_email: cleanEmail }
    );

    if (!rpcError && rpcData && rpcData.length > 0) {
      const match = rpcData[0];
      return {
        isLinked: Boolean(match.is_linked),
        poraplanId: match.resolved_poraplan_id,
        role: match.account_role as UserRole,
        status: match.account_status as AccountStatus,
        error: null,
      };
    }

    // 2. Direct query fallback
    const { data, error } = await supabase
      .from('profiles')
      .select('poraplan_id, role, status, email, linked_email')
      .or(`email.ilike.${cleanEmail},linked_email.ilike.${cleanEmail}`)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      return { isLinked: false, error };
    }

    if (data) {
      return {
        isLinked: true,
        poraplanId: data.poraplan_id || undefined,
        role: data.role,
        status: (data.status as AccountStatus) || 'active',
        error: null,
      };
    }

    return { isLinked: false, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { isLinked: false, error };
  }
}

/**
 * Connects a personal email address to an activated PoraPlan account.
 */
export async function connectPersonalEmail(
  userId: string,
  email: string
): Promise<{ success: boolean; error: Error | null }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    return { success: false, error: new Error('Please enter a valid email address.') };
  }

  if (!isSupabaseConfigured()) {
    return connectMockPersonalEmail(userId, cleanEmail);
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({
        linked_email: cleanEmail,
        status: 'active',
      })
      .eq('id', userId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

/**
 * Update an existing profile for a user.
 * Explicitly sanitizes inputs: users can never alter role or poraplan_id.
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<{
  profile: Profile | null;
  error: Error | null;
}> {
  // Sanitize strictly: role cannot be altered by users
  const sanitizedUpdates: ProfileUpdate = {};
  if (updates.full_name !== undefined) sanitizedUpdates.full_name = updates.full_name;
  if (updates.avatar_url !== undefined) sanitizedUpdates.avatar_url = updates.avatar_url;
  if (updates.linked_email !== undefined) sanitizedUpdates.linked_email = updates.linked_email;

  if (!isSupabaseConfigured()) {
    return updateMockProfile(userId, sanitizedUpdates);
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(sanitizedUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { profile: null, error };
    }

    return { profile: data as Profile, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { profile: null, error };
  }
}

/**
 * Helper to validate user role.
 */
export function isValidUserRole(role: string): role is UserRole {
  return role === 'student' || role === 'mentor' || role === 'admin';
}
