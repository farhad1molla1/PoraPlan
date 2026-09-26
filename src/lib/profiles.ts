import { supabase, isSupabaseConfigured } from './supabase';
import type { Profile, ProfileUpdate, UserRole } from '../types/database';

/**
 * Fetch a profile by user ID.
 */
export async function getProfile(userId: string): Promise<{
  profile: Profile | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { profile: null, error: new Error('Supabase client is not configured') };
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
 * Update an existing profile for a user.
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<{
  profile: Profile | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { profile: null, error: new Error('Supabase client is not configured') };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
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
