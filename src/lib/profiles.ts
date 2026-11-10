import { supabase, isSupabaseConfigured } from './supabase';
import type { Profile, ProfileUpdate, UserRole, AccountStatus, PublicProfile } from '../types/database';
import {
  resolveMockPoraPlanId,
  checkMockGoogleLinked,
  connectMockPersonalEmail,
  getMockProfile,
  updateMockProfile,
  adminRegisterMockMember,
  resetMockPasswordByPoraplanId,
  getMockUsers,
  getMockPublicProfile,
} from './mockAuthStore';
import { validatePasswordPolicy } from './passwordPolicy';

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
 * Resolves a PoraPlan ID (e.g. PP001, PPM001) to its corresponding auth credentials.
 * Routes through the hardened resolve-poraplan-id server boundary with CAPTCHA verification
 * and anti-enumeration protections. Rejects unauthorized, suspended, or invented IDs
 * with a uniform error message.
 */
export async function resolvePoraPlanIdLogin(
  poraplanId: string,
  captchaToken?: string
): Promise<{
  resolution: PoraPlanIdResolution | null;
  error: Error | null;
}> {
  const cleanId = poraplanId.trim();
  if (!cleanId) {
    return { resolution: null, error: new Error('Please enter your PoraPlan ID.') };
  }

  if (!isSupabaseConfigured()) {
    const mockRes = resolveMockPoraPlanId(cleanId);
    if (!mockRes || mockRes.status === 'suspended') {
      return {
        resolution: null,
        error: new Error('Invalid PoraPlan ID or password.'),
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
    // 1. Invoke the secure server-side Edge Function with anti-enumeration protection
    const { data: fnData, error: fnError } = await supabase.functions.invoke('resolve-poraplan-id', {
      body: {
        poraplanId: cleanId,
        captchaToken,
      },
    });

    if (!fnError && fnData?.authEmail) {
      return {
        resolution: {
          authEmail: fnData.authEmail,
          status: 'active',
          role: 'student',
          poraplanId: cleanId.toUpperCase(),
        },
        error: null,
      };
    }

    if (fnError) {
      let resolvedMessage = 'Invalid PoraPlan ID or password.';
      try {
        const ctx = (fnError as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          const parsed = await ctx.json();
          if (parsed?.error) {
            resolvedMessage = parsed.error;
          }
        } else if (fnError.message) {
          if (fnError.message.includes('CAPTCHA') || fnError.message.includes('temporarily unavailable')) {
            resolvedMessage = fnError.message;
          }
        }
      } catch {
        // Fall back to uniform message on parse error
      }

      // If the function returned a deliberate security failure, honor it
      if (resolvedMessage === 'Invalid PoraPlan ID or password.' || resolvedMessage.includes('CAPTCHA')) {
        return { resolution: null, error: new Error(resolvedMessage) };
      }
    }

    // 2. Transitional / local fallback via RPC if function is not deployed in local environment
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'resolve_poraplan_id_login',
      { p_poraplan_id: cleanId }
    );

    if (!rpcError && rpcData && rpcData.length > 0) {
      const match = rpcData[0];
      if (match.account_status === 'suspended') {
        return {
          resolution: null,
          error: new Error('Invalid PoraPlan ID or password.'),
        };
      }

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

    // Return uniform error message: never reveal whether ID exists or was unrecognized
    return {
      resolution: null,
      error: new Error('Invalid PoraPlan ID or password.'),
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
 * Explicitly sanitizes inputs: users can never alter role, poraplan_id, or status.
 */
export async function updateProfile(
  userId: string,
  updates: ProfileUpdate
): Promise<{
  profile: Profile | null;
  error: Error | null;
}> {
  // Sanitize strictly: role, poraplan_id, and status cannot be altered by users
  const sanitizedUpdates: ProfileUpdate = {};
  if (updates.full_name !== undefined) sanitizedUpdates.full_name = updates.full_name.trim();
  if (updates.avatar_url !== undefined) sanitizedUpdates.avatar_url = updates.avatar_url;
  if (updates.linked_email !== undefined) sanitizedUpdates.linked_email = updates.linked_email?.trim().toLowerCase() || null;
  if (updates.whatsapp_number !== undefined) sanitizedUpdates.whatsapp_number = updates.whatsapp_number?.trim() || null;
  if (updates.university !== undefined) sanitizedUpdates.university = updates.university?.trim() || null;
  if (updates.department !== undefined) sanitizedUpdates.department = updates.department?.trim() || null;
  if (updates.batch !== undefined) sanitizedUpdates.batch = updates.batch?.trim() || null;
  if (updates.current_semester !== undefined) sanitizedUpdates.current_semester = updates.current_semester?.trim() || null;
  if (updates.academic_background !== undefined) sanitizedUpdates.academic_background = updates.academic_background?.trim() || null;
  if (updates.expertise !== undefined) sanitizedUpdates.expertise = updates.expertise?.trim() || null;
  if (updates.mentoring_subjects !== undefined) sanitizedUpdates.mentoring_subjects = updates.mentoring_subjects?.trim() || null;
  if (updates.bio !== undefined) sanitizedUpdates.bio = updates.bio?.trim() || null;

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
 * Upload an avatar image for a user to Supabase Storage or mock data store.
 * Validates file size (max 2MB) and image types.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<{ avatarUrl: string | null; error: Error | null }> {
  // Validation: allowed MIME types
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return {
      avatarUrl: null,
      error: new Error('Please upload an image file (JPEG, PNG, WebP, or GIF).'),
    };
  }

  // Validation: size max 2MB
  const MAX_SIZE_BYTES = 2 * 1024 * 1024;
  if (file.size > MAX_SIZE_BYTES) {
    return {
      avatarUrl: null,
      error: new Error('Image size must be less than 2MB.'),
    };
  }

  // Mock / offline fallback: convert to base64 Data URL
  if (!isSupabaseConfigured()) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        // Also persist in mock store
        updateMockProfile(userId, { avatar_url: dataUrl });
        resolve({ avatarUrl: dataUrl, error: null });
      };
      reader.onerror = () => {
        resolve({ avatarUrl: null, error: new Error('Failed to read image file.') });
      };
      reader.readAsDataURL(file);
    });
  }

  try {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(fileExt) ? fileExt : 'jpg';
    const filePath = `${userId}/${Date.now()}.${cleanExt}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      return { avatarUrl: null, error: uploadError };
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    const avatarUrl = publicUrlData.publicUrl;

    // Automatically sync profile avatar_url
    await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId);

    return { avatarUrl, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { avatarUrl: null, error };
  }
}

/**
 * Helper to validate user role.
 */
export function isValidUserRole(role: string): role is UserRole {
  return role === 'student' || role === 'mentor' || role === 'admin';
}

/**
 * Admin function to pre-register / provision a new PoraPlan member.
 */
export async function adminRegisterMember(
  poraplanId: string,
  fullName: string,
  email: string,
  role: UserRole,
  initialPassword?: string
): Promise<{ success: boolean; message: string }> {
  if (initialPassword) {
    const validation = validatePasswordPolicy(initialPassword);
    if (!validation.valid) {
      return { success: false, message: validation.error || 'Password policy violation.' };
    }
  }

  if (!isSupabaseConfigured()) {
    return adminRegisterMockMember(poraplanId, fullName, email, role, initialPassword);
  }

  try {
    const { data, error } = await supabase.rpc('admin_register_member', {
      p_poraplan_id: poraplanId.trim().toUpperCase(),
      p_full_name: fullName.trim(),
      p_email: email.trim().toLowerCase(),
      p_role: role,
      p_status: 'not_activated',
      ...(initialPassword ? { p_initial_password: initialPassword } : {}),
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const rows = Array.isArray(data) ? (data as Array<{ success: boolean; message: string }>) : [];
    if (rows.length > 0) {
      return { success: Boolean(rows[0].success), message: rows[0].message };
    }

    return { success: true, message: `Member ${poraplanId.toUpperCase()} successfully pre-registered.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

/**
 * Admin function to reset a member password via privileged server-side RPC.
 * Enforces unified password security policy before execution.
 */
export async function adminResetMemberPassword(
  poraplanId: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const validation = validatePasswordPolicy(newPassword);
  if (!validation.valid) {
    return { success: false, message: validation.error || 'Password policy violation.' };
  }

  if (!isSupabaseConfigured()) {
    return resetMockPasswordByPoraplanId(poraplanId, newPassword);
  }

  try {
    const { data, error } = await supabase.rpc('admin_reset_member_password', {
      p_poraplan_id: poraplanId.trim().toUpperCase(),
      p_new_password: newPassword,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    const rows = Array.isArray(data) ? (data as Array<{ success: boolean; message: string }>) : [];
    if (rows.length > 0) {
      return { success: Boolean(rows[0].success), message: rows[0].message };
    }

    return { success: true, message: `Password for member ${poraplanId.toUpperCase()} successfully reset.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, message: msg };
  }
}

/**
 * Retrieve user directory profiles for platform administrators.
 * Supports filtering by role, status, and searching across full name, email, and PoraPlan ID.
 */
export async function getAdminUsers(filters?: {
  role?: UserRole;
  search?: string;
  status?: AccountStatus;
}): Promise<{ users: Profile[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { users: getMockUsers(filters), error: null };
  }

  try {
    let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });

    if (filters?.role) {
      query = query.eq('role', filters.role);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.trim();
      query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,poraplan_id.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      return { users: [], error };
    }

    return { users: (data as Profile[]) || [], error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { users: [], error };
  }
}

/**
 * Fetch a sanitized public profile by user ID.
 * Strictly respects role privacy gates by projecting only public fields.
 * Never exposes whatsapp_number, email, linked_email, contact_email, academic_background or internal notes.
 * Enforces two-tier privacy-safe retrieval:
 * Tier 1: get_public_profile SECURITY DEFINER RPC with active status check
 * Tier 2: public_profiles VIEW with active status check
 * Never falls back to raw profiles table query to prevent privacy bypass.
 */
export async function getPublicProfile(userId: string): Promise<{
  profile: PublicProfile | null;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const mockPublic = getMockPublicProfile(userId);
    if (mockPublic) {
      return { profile: mockPublic, error: null };
    }
    return { profile: null, error: new Error('Public profile not found') };
  }

  try {
    // 1. Preferred: Call the security-definer RPC
    const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('get_public_profile', {
      p_user_id: userId,
    });

    if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
      return { profile: rpcData[0] as PublicProfile, error: null };
    }

    // 2. Fallback: Query the public_profiles view
    const { data: viewData, error: viewError } = await (supabase as any)
      .from('public_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!viewError && viewData) {
      return { profile: viewData as PublicProfile, error: null };
    }

    // If both RPC and public_profiles view return nothing, profile does not exist or is inactive.
    const finalError = rpcError || viewError || new Error('Public profile not found or unavailable');
    return { profile: null, error: finalError };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { profile: null, error };
  }
}


