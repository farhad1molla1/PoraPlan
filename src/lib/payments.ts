/**
 * PoraPlan — Payment & Billing Management Service Layer
 * Module 11: Payment & Billing Management
 *
 * STRICT ARCHITECTURAL CONSTRAINTS:
 * 1. ABSOLUTE NO-AMOUNT POLICY:
 *    Zero amount, balance, fee, price, currency, revenue, or financial total columns.
 * 2. INDEPENDENT PAYMENT TRACKS:
 *    Student payment records vs. Mentor payout records are strictly segregated.
 * 3. IDENTITY RESOLUTION:
 *    Identity and authorization are ALWAYS derived from the verified session context.
 *    Caller-supplied roles or identity arguments are NEVER trusted as authority.
 * 4. SOFT-DELETE AWARE:
 *    Ordinary students and mentors only see non-deleted records.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Database,
  StudentPaymentRecord,
  StudentPaymentRecordInsert,
  StudentPaymentRecordUpdate,
  StudentPaymentRecordWithMeta,
  MentorPaymentRecord,
  MentorPaymentRecordInsert,
  MentorPaymentRecordUpdate,
  MentorPaymentRecordWithMeta,
  PaymentEvent,
  PaymentEventInsert,
  PaymentAdminNote,
  BillingDateAuditLog,
  StudentPaymentStatus,
  MentorPaymentStatus,
  PaymentMethod,
  ProgramEnrollment,
} from '../types/database';

import {
  getMockCurrentSession,
  getMockStudentPaymentRecords,
  getMockStudentPaymentRecordById,
  createMockStudentPaymentRecord,
  updateMockStudentPaymentRecord,
  softDeleteMockStudentPaymentRecord,
  getMockMentorPaymentRecords,
  getMockMentorPaymentRecordById,
  createMockMentorPaymentRecord,
  updateMockMentorPaymentRecord,
  softDeleteMockMentorPaymentRecord,
  getMockPaymentEvents,
  createMockPaymentEvent,
  getMockPaymentAdminNotes,
  createMockPaymentAdminNote,
  overrideMockBillingStartDate,
  getMockBillingDateAuditLogs,
  getMockUsers,
  getMockEnrollments,
} from './mockAuthStore';

import {
  isValidCalendarDate,
  toBangladeshDateStr,
  computeBillingPeriod,
} from './billingCycles';
import {
  calculatePaginationRange,
  createPaginationMeta,
} from './pagination';
import {
  DEFAULT_PAGE,
  type PaginationMeta,
} from '../types/pagination';

interface SupabaseBackend {
  isConfigured: boolean;
  supabase: SupabaseClient<Database> | null;
}

/**
 * Safely resolves the Supabase client when in browser mode.
 * In Node / test-runner environments, gracefully defaults to mock mode.
 */
async function getSupabaseBackend(): Promise<SupabaseBackend> {
  if (typeof window === 'undefined') {
    return { isConfigured: false, supabase: null };
  }
  try {
    const sb = await import('./supabase');
    if (!sb.isSupabaseConfigured()) {
      return { isConfigured: false, supabase: null };
    }
    return { isConfigured: true, supabase: sb.supabase };
  } catch {
    return { isConfigured: false, supabase: null };
  }
}

// ==============================================================================
// Identity & Authorization Resolution
// ==============================================================================

export interface AuthenticatedUserContext {
  userId: string;
  role: 'student' | 'mentor' | 'admin';
  isActive: boolean;
  error: Error | null;
}

/**
 * Resolves the current authenticated user identity and role from trusted session state.
 * Never trusts caller-supplied parameters for identity or role authority.
 */
export async function resolveAuthContext(): Promise<AuthenticatedUserContext> {
  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const session = getMockCurrentSession();
    if (!session) {
      return {
        userId: '',
        role: 'student',
        isActive: false,
        error: new Error('Authentication required: no active session found.'),
      };
    }

    if (session.status !== 'active') {
      return {
        userId: session.id,
        role: session.role as 'student' | 'mentor' | 'admin',
        isActive: false,
        error: new Error('Account is not active or has been suspended.'),
      };
    }

    return {
      userId: session.id,
      role: session.role as 'student' | 'mentor' | 'admin',
      isActive: true,
      error: null,
    };
  }

  try {
    const {
      data: { user },
      error: authErr,
    } = await sb.supabase.auth.getUser();

    if (authErr || !user) {
      return {
        userId: '',
        role: 'student',
        isActive: false,
        error: authErr || new Error('Authentication required: no active session found.'),
      };
    }

    const { data: profile, error: profErr } = await sb.supabase
      .from('profiles')
      .select('id, role, status')
      .eq('id', user.id)
      .single();

    if (profErr || !profile) {
      return {
        userId: user.id,
        role: 'student',
        isActive: false,
        error: profErr || new Error('User profile not found.'),
      };
    }

    if (profile.status !== 'active') {
      return {
        userId: user.id,
        role: profile.role as 'student' | 'mentor' | 'admin',
        isActive: false,
        error: new Error('Account is not active or has been suspended.'),
      };
    }

    return {
      userId: user.id,
      role: profile.role as 'student' | 'mentor' | 'admin',
      isActive: true,
      error: null,
    };
  } catch (err: unknown) {
    return {
      userId: '',
      role: 'student',
      isActive: false,
      error: err instanceof Error ? err : new Error('Failed to resolve authentication context.'),
    };
  }
}

// ==============================================================================
// 1. Student Payment Records (Self-Service & Protected)
// ==============================================================================

/**
 * Fetches non-deleted student payment records for the currently authenticated student.
 */
export async function getMyStudentPaymentRecords(filters?: {
  enrollmentId?: string;
  status?: StudentPaymentStatus;
}): Promise<{ records: StudentPaymentRecord[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) {
    return { records: [], error: auth.error };
  }

  if (auth.role !== 'student' && auth.role !== 'admin') {
    return { records: [], error: new Error('Access denied: caller is not a student or administrator.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    let list = getMockStudentPaymentRecords({
      studentId: auth.userId,
      enrollmentId: filters?.enrollmentId,
      status: filters?.status,
      includeDeleted: false,
    });
    return { records: list, error: null };
  }

  try {
    let query = sb.supabase
      .from('student_payment_records')
      .select('*')
      .eq('student_id', auth.userId)
      .eq('is_deleted', false);

    if (filters?.enrollmentId) {
      query = query.eq('enrollment_id', filters.enrollmentId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('cycle_start_date', { ascending: false });
    if (error) throw error;
    return { records: (data as StudentPaymentRecord[]) || [], error: null };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve student payment records.'),
    };
  }
}

/**
 * Fetches a single student payment record by ID, ensuring caller ownership or admin privileges.
 */
export async function getMyStudentPaymentRecordById(
  id: string,
  options?: { withMeta?: boolean }
): Promise<{ record: StudentPaymentRecordWithMeta | StudentPaymentRecord | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) {
    return { record: null, error: auth.error };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const record = getMockStudentPaymentRecordById(id, options);
    if (!record || record.is_deleted) {
      return { record: null, error: new Error('Payment record not found.') };
    }

    // Ownership assertion: students can only access their own records
    if (auth.role === 'student' && record.student_id !== auth.userId) {
      return { record: null, error: new Error('Unauthorized: cannot access another student payment record.') };
    }

    // Strip internal admin notes from non-admin responses
    if (auth.role !== 'admin' && 'events' in record && Array.isArray((record as StudentPaymentRecordWithMeta).events)) {
      (record as StudentPaymentRecordWithMeta).events = (record as StudentPaymentRecordWithMeta).events?.map((e) => ({
        ...e,
        note: null,
      }));
    }

    return { record, error: null };
  }

  try {
    const selectFields = options?.withMeta
      ? '*, student:profiles!student_id(*), enrollment:program_enrollments(*), events:payment_events(id, record_type, student_payment_id, mentor_payment_id, payment_method, transaction_reference, payment_date, recorded_by, created_at), recorder:profiles!recorded_by(*)'
      : '*';

    const { data, error } = await sb.supabase
      .from('student_payment_records')
      .select(selectFields)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { record: null, error: error || new Error('Payment record not found.') };
    }

    const record = data as unknown as StudentPaymentRecord;
    if (record.is_deleted && auth.role !== 'admin') {
      return { record: null, error: new Error('Payment record not found.') };
    }

    if (auth.role === 'student' && record.student_id !== auth.userId) {
      return { record: null, error: new Error('Unauthorized: cannot access another student payment record.') };
    }

    const result = data as unknown as StudentPaymentRecordWithMeta;
    if (auth.role !== 'admin' && result.events && Array.isArray(result.events)) {
      result.events = result.events.map((e) => ({
        ...e,
        note: null,
      }));
    }

    return { record: result, error: null };
  } catch (err: unknown) {
    return {
      record: null,
      error: err instanceof Error ? err : new Error('Failed to retrieve student payment record.'),
    };
  }
}

// ==============================================================================
// 2. Mentor Payout Records (Self-Service & Protected)
// ==============================================================================

/**
 * Fetches non-deleted mentor payout records for the currently authenticated mentor.
 */
export async function getMyMentorPaymentRecords(filters?: {
  billingMonth?: string;
  status?: MentorPaymentStatus;
}): Promise<{ records: MentorPaymentRecord[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) {
    return { records: [], error: auth.error };
  }

  if (auth.role !== 'mentor' && auth.role !== 'admin') {
    return { records: [], error: new Error('Access denied: caller is not a mentor or administrator.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    let list = getMockMentorPaymentRecords({
      mentorId: auth.userId,
      billingMonth: filters?.billingMonth,
      status: filters?.status,
      includeDeleted: false,
    });
    return { records: list, error: null };
  }

  try {
    let query = sb.supabase
      .from('mentor_payment_records')
      .select('*')
      .eq('mentor_id', auth.userId)
      .eq('is_deleted', false);

    if (filters?.billingMonth) {
      query = query.eq('billing_month', filters.billingMonth);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('billing_month', { ascending: false });
    if (error) throw error;
    return { records: (data as MentorPaymentRecord[]) || [], error: null };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve mentor payout records.'),
    };
  }
}

/**
 * Fetches a single mentor payout record by ID, ensuring caller ownership or admin privileges.
 */
export async function getMyMentorPaymentRecordById(
  id: string,
  options?: { withMeta?: boolean }
): Promise<{ record: MentorPaymentRecordWithMeta | MentorPaymentRecord | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) {
    return { record: null, error: auth.error };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const record = getMockMentorPaymentRecordById(id, options);
    if (!record || record.is_deleted) {
      return { record: null, error: new Error('Mentor payout record not found.') };
    }

    // Ownership assertion: mentors can only access their own payout records
    if (auth.role === 'mentor' && record.mentor_id !== auth.userId) {
      return { record: null, error: new Error('Unauthorized: cannot access another mentor payout record.') };
    }

    // Strip internal admin notes from non-admin responses
    if (auth.role !== 'admin' && 'events' in record && Array.isArray((record as MentorPaymentRecordWithMeta).events)) {
      (record as MentorPaymentRecordWithMeta).events = (record as MentorPaymentRecordWithMeta).events?.map((e) => ({
        ...e,
        note: null,
      }));
    }

    return { record, error: null };
  }

  try {
    const selectFields = options?.withMeta
      ? '*, mentor:profiles!mentor_id(*), related_student:profiles!related_student_id(*), related_enrollment:program_enrollments(*), events:payment_events(id, record_type, student_payment_id, mentor_payment_id, payment_method, transaction_reference, payment_date, recorded_by, created_at), recorder:profiles!recorded_by(*)'
      : '*';

    const { data, error } = await sb.supabase
      .from('mentor_payment_records')
      .select(selectFields)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { record: null, error: error || new Error('Mentor payout record not found.') };
    }

    const record = data as unknown as MentorPaymentRecord;
    if (record.is_deleted && auth.role !== 'admin') {
      return { record: null, error: new Error('Mentor payout record not found.') };
    }

    if (auth.role === 'mentor' && record.mentor_id !== auth.userId) {
      return { record: null, error: new Error('Unauthorized: cannot access another mentor payout record.') };
    }

    const result = data as unknown as MentorPaymentRecordWithMeta;
    if (auth.role !== 'admin' && result.events && Array.isArray(result.events)) {
      result.events = result.events.map((e) => ({
        ...e,
        note: null,
      }));
    }

    return { record: result, error: null };
  } catch (err: unknown) {
    return {
      record: null,
      error: err instanceof Error ? err : new Error('Failed to retrieve mentor payout record.'),
    };
  }
}

// ==============================================================================
// 3. Admin Payment Management Operations
// ==============================================================================

/**
 * Admin: List and filter all student payment records across the platform.
 */
export async function getAdminStudentPaymentRecords(filters?: {
  studentId?: string;
  enrollmentId?: string;
  status?: StudentPaymentStatus;
  includeDeleted?: boolean;
}): Promise<{ records: StudentPaymentRecord[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { records: [], error: auth.error };
  if (auth.role !== 'admin') {
    return { records: [], error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const records = getMockStudentPaymentRecords(filters);
    return { records, error: null };
  }

  try {
    let query = sb.supabase.from('student_payment_records').select('*');

    if (!filters?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId);
    }
    if (filters?.enrollmentId) {
      query = query.eq('enrollment_id', filters.enrollmentId);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('cycle_start_date', { ascending: false });
    if (error) throw error;
    return { records: (data as StudentPaymentRecord[]) || [], error: null };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err : new Error('Failed to list student payment records.'),
    };
  }
}

/**
 * Admin: Create a new student payment record for an active enrollment cycle.
 */
export async function createStudentPaymentRecord(
  input: StudentPaymentRecordInsert
): Promise<{ record: StudentPaymentRecord | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { record: null, error: auth.error };
  if (auth.role !== 'admin') {
    return { record: null, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return createMockStudentPaymentRecord(input, auth.userId);
  }

  try {
    const { data, error } = await sb.supabase
      .from('student_payment_records')
      .insert({
        ...input,
        recorded_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          record: null,
          error: new Error('An active payment record already exists for this enrollment and billing cycle.'),
        };
      }
      throw error;
    }
    return { record: data as StudentPaymentRecord, error: null };
  } catch (err: unknown) {
    return {
      record: null,
      error: err instanceof Error ? err : new Error('Failed to create student payment record.'),
    };
  }
}

/**
 * Admin: Update student payment status or operational metadata.
 */
export async function updateStudentPaymentRecord(
  id: string,
  updates: StudentPaymentRecordUpdate
): Promise<{ record: StudentPaymentRecord | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { record: null, error: auth.error };
  if (auth.role !== 'admin') {
    return { record: null, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return updateMockStudentPaymentRecord(id, updates, auth.userId);
  }

  try {
    const { data, error } = await sb.supabase
      .from('student_payment_records')
      .update({
        ...updates,
        recorded_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { record: data as StudentPaymentRecord, error: null };
  } catch (err: unknown) {
    return {
      record: null,
      error: err instanceof Error ? err : new Error('Failed to update student payment record.'),
    };
  }
}

/**
 * Admin: Soft-delete a student payment record.
 */
export async function softDeleteStudentPaymentRecord(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { success: false, error: auth.error };
  if (auth.role !== 'admin') {
    return { success: false, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return softDeleteMockStudentPaymentRecord(id, auth.userId);
  }

  try {
    const { error } = await sb.supabase
      .from('student_payment_records')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to delete student payment record.'),
    };
  }
}

/**
 * Admin: List and filter all mentor payout records.
 */
export async function getAdminMentorPaymentRecords(filters?: {
  mentorId?: string;
  billingMonth?: string;
  status?: MentorPaymentStatus;
  includeDeleted?: boolean;
}): Promise<{ records: MentorPaymentRecord[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { records: [], error: auth.error };
  if (auth.role !== 'admin') {
    return { records: [], error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const records = getMockMentorPaymentRecords(filters);
    return { records, error: null };
  }

  try {
    let query = sb.supabase.from('mentor_payment_records').select('*');

    if (!filters?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    if (filters?.mentorId) {
      query = query.eq('mentor_id', filters.mentorId);
    }
    if (filters?.billingMonth) {
      query = query.eq('billing_month', filters.billingMonth);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.order('billing_month', { ascending: false });
    if (error) throw error;
    return { records: (data as MentorPaymentRecord[]) || [], error: null };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err : new Error('Failed to list mentor payout records.'),
    };
  }
}

/**
 * Admin: Create a new mentor payout record.
 */
export async function createMentorPaymentRecord(
  input: MentorPaymentRecordInsert
): Promise<{ record: MentorPaymentRecord | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { record: null, error: auth.error };
  if (auth.role !== 'admin') {
    return { record: null, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return createMockMentorPaymentRecord(input, auth.userId);
  }

  try {
    const { data, error } = await sb.supabase
      .from('mentor_payment_records')
      .insert({
        ...input,
        recorded_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return {
          record: null,
          error: new Error('An active payout record already exists for this mentor and billing month.'),
        };
      }
      throw error;
    }
    return { record: data as MentorPaymentRecord, error: null };
  } catch (err: unknown) {
    return {
      record: null,
      error: err instanceof Error ? err : new Error('Failed to create mentor payout record.'),
    };
  }
}

/**
 * Admin: Update mentor payout status or metadata.
 */
export async function updateMentorPaymentRecord(
  id: string,
  updates: MentorPaymentRecordUpdate
): Promise<{ record: MentorPaymentRecord | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { record: null, error: auth.error };
  if (auth.role !== 'admin') {
    return { record: null, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return updateMockMentorPaymentRecord(id, updates, auth.userId);
  }

  try {
    const { data, error } = await sb.supabase
      .from('mentor_payment_records')
      .update({
        ...updates,
        recorded_by: auth.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return { record: data as MentorPaymentRecord, error: null };
  } catch (err: unknown) {
    return {
      record: null,
      error: err instanceof Error ? err : new Error('Failed to update mentor payout record.'),
    };
  }
}

/**
 * Admin: Soft-delete a mentor payout record.
 */
export async function softDeleteMentorPaymentRecord(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { success: false, error: auth.error };
  if (auth.role !== 'admin') {
    return { success: false, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return softDeleteMockMentorPaymentRecord(id, auth.userId);
  }

  try {
    const { error } = await sb.supabase
      .from('mentor_payment_records')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
    return { success: true, error: null };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to delete mentor payout record.'),
    };
  }
}

// ==============================================================================
// 4. Payment Events Operations
// ==============================================================================

/**
 * Fetches payment events belonging to a parent payment record, enforcing parent ownership.
 */
export async function getPaymentEvents(
  recordType: 'student' | 'mentor',
  recordId: string
): Promise<{ events: PaymentEvent[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { events: [], error: auth.error };

  const sanitizeEvents = (evts: PaymentEvent[]): PaymentEvent[] => {
    if (auth.role === 'admin') return evts;
    // Strip internal admin notes from non-admin responses
    return evts.map((e) => ({ ...e, note: null }));
  };

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    if (recordType === 'student') {
      const parent = getMockStudentPaymentRecordById(recordId);
      if (!parent || parent.is_deleted) {
        return { events: [], error: new Error('Parent student payment record not found.') };
      }
      if (auth.role === 'student' && parent.student_id !== auth.userId) {
        return { events: [], error: new Error('Unauthorized: cannot access payment events for another student.') };
      }
      if (auth.role !== 'student' && auth.role !== 'admin') {
        return { events: [], error: new Error('Unauthorized.') };
      }
      const rawEvents = getMockPaymentEvents({ studentPaymentId: recordId, recordType: 'student' });
      return { events: sanitizeEvents(rawEvents), error: null };
    } else {
      const parent = getMockMentorPaymentRecordById(recordId);
      if (!parent || parent.is_deleted) {
        return { events: [], error: new Error('Parent mentor payout record not found.') };
      }
      if (auth.role === 'mentor' && parent.mentor_id !== auth.userId) {
        return { events: [], error: new Error('Unauthorized: cannot access payout events for another mentor.') };
      }
      if (auth.role !== 'mentor' && auth.role !== 'admin') {
        return { events: [], error: new Error('Unauthorized.') };
      }
      const rawEvents = getMockPaymentEvents({ mentorPaymentId: recordId, recordType: 'mentor' });
      return { events: sanitizeEvents(rawEvents), error: null };
    }
  }

  try {
    if (auth.role === 'admin') {
      // Legitimate admin retrieval of full event history including internal notes via verified RPC
      const { data, error } = await sb.supabase.rpc('get_admin_payment_events', {
        p_record_type: recordType,
        p_record_id: recordId,
      });
      if (error) throw error;
      return { events: (data as PaymentEvent[]) || [], error: null };
    }

    // Student and mentor callers query permitted non-sensitive columns strictly
    let query = sb.supabase
      .from('payment_events')
      .select('id, record_type, student_payment_id, mentor_payment_id, payment_method, transaction_reference, payment_date, recorded_by, created_at')
      .eq('record_type', recordType);

    if (recordType === 'student') {
      query = query.eq('student_payment_id', recordId);
    } else {
      query = query.eq('mentor_payment_id', recordId);
    }

    const { data, error } = await query.order('payment_date', { ascending: false });
    if (error) throw error;
    const rawEvents = (data as PaymentEvent[]) || [];
    return { events: sanitizeEvents(rawEvents), error: null };
  } catch (err: unknown) {
    return {
      events: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve payment events.'),
    };
  }
}

/**
 * Admin: Record a child payment event (installment/partial payment) under a parent record.
 */
export async function createPaymentEvent(
  input: PaymentEventInsert
): Promise<{ event: PaymentEvent | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { event: null, error: auth.error };
  if (auth.role !== 'admin') {
    return { event: null, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return createMockPaymentEvent(input, auth.userId);
  }

  try {
    const { data, error } = await sb.supabase
      .from('payment_events')
      .insert({
        ...input,
        recorded_by: auth.userId,
      })
      .select('id, record_type, student_payment_id, mentor_payment_id, payment_method, transaction_reference, payment_date, recorded_by, created_at')
      .single();

    if (error) throw error;
    return { event: { ...data, note: input.note || null } as PaymentEvent, error: null };
  } catch (err: unknown) {
    return {
      event: null,
      error: err instanceof Error ? err : new Error('Failed to record payment event.'),
    };
  }
}

// ==============================================================================
// 5. Private Payment Admin Notes (Strict Admin Isolation)
// ==============================================================================

/**
 * Admin: Retrieve private administrator notes for a payment record or enrollment.
 */
export async function getPaymentAdminNotes(
  recordType: 'student_payment' | 'mentor_payment' | 'enrollment',
  recordId: string
): Promise<{ notes: PaymentAdminNote[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { notes: [], error: auth.error };
  if (auth.role !== 'admin') {
    return { notes: [], error: new Error('Unauthorized: Admin notes are private to administrators.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const notes = getMockPaymentAdminNotes(recordType, recordId, auth.role);
    return { notes, error: null };
  }

  try {
    const { data, error } = await sb.supabase
      .from('payment_admin_notes')
      .select('*')
      .eq('record_type', recordType)
      .eq('record_id', recordId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { notes: (data as PaymentAdminNote[]) || [], error: null };
  } catch (err: unknown) {
    return {
      notes: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve payment admin notes.'),
    };
  }
}

/**
 * Admin: Author a private administrator note.
 */
export async function createPaymentAdminNote(input: {
  recordType: 'student_payment' | 'mentor_payment' | 'enrollment';
  recordId: string;
  note: string;
}): Promise<{ note: PaymentAdminNote | null; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { note: null, error: auth.error };
  if (auth.role !== 'admin') {
    return { note: null, error: new Error('Unauthorized: Admin privilege required.') };
  }

  if (!input.note.trim()) {
    return { note: null, error: new Error('Note content cannot be empty.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return createMockPaymentAdminNote({
      ...input,
      adminId: auth.userId,
      callerRole: auth.role,
    });
  }

  try {
    const { data, error } = await sb.supabase
      .from('payment_admin_notes')
      .insert({
        record_type: input.recordType,
        record_id: input.recordId,
        note: input.note.trim(),
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return { note: data as PaymentAdminNote, error: null };
  } catch (err: unknown) {
    return {
      note: null,
      error: err instanceof Error ? err : new Error('Failed to create payment admin note.'),
    };
  }
}

// ==============================================================================
// 6. Billing Date Override & Audit History
// ==============================================================================

/**
 * Admin: Retrieve immutable billing date adjustment audit logs.
 */
export async function getBillingDateAuditLogs(
  enrollmentId?: string
): Promise<{ logs: BillingDateAuditLog[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { logs: [], error: auth.error };
  if (auth.role !== 'admin') {
    return { logs: [], error: new Error('Unauthorized: Billing audit logs are restricted to administrators.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const logs = getMockBillingDateAuditLogs(enrollmentId);
    return { logs, error: null };
  }

  try {
    let query = sb.supabase.from('billing_date_audit_logs').select('*');
    if (enrollmentId) {
      query = query.eq('enrollment_id', enrollmentId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return { logs: (data as BillingDateAuditLog[]) || [], error: null };
  } catch (err: unknown) {
    return {
      logs: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve billing date audit logs.'),
    };
  }
}

export const DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE = 25;

export interface AdminBillingAuditLogsPaginatedParams {
  page?: number;
  pageSize?: number;
  enrollmentId?: string;
}

export interface AdminBillingAuditLogsPaginatedResult {
  logs: BillingDateAuditLog[];
  pagination: PaginationMeta;
  error: Error | null;
}

/**
 * Admin: Retrieve paginated billing date audit logs with exact count metadata,
 * deterministic ordering (created_at DESC, id ASC), and optional enrollment filtering.
 */
export async function getBillingDateAuditLogsPaginated(
  params?: AdminBillingAuditLogsPaginatedParams
): Promise<AdminBillingAuditLogsPaginatedResult> {
  const auth = await resolveAuthContext();
  const page = params?.page ?? DEFAULT_PAGE;
  const pageSize = params?.pageSize ?? DEFAULT_ADMIN_BILLING_AUDIT_LOG_PAGE_SIZE;
  const range = calculatePaginationRange({ page, pageSize });

  const emptyMeta = createPaginationMeta({
    page: range.page,
    pageSize: range.pageSize,
    totalCount: 0,
  });

  if (auth.error) {
    return { logs: [], pagination: emptyMeta, error: auth.error };
  }
  if (auth.role !== 'admin') {
    return {
      logs: [],
      pagination: emptyMeta,
      error: new Error('Unauthorized: Billing audit logs are restricted to administrators.'),
    };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const list = getMockBillingDateAuditLogs(params?.enrollmentId);

    // Deterministic sort: created_at DESC NULLS LAST, id ASC
    list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
      if (timeB !== timeA) return timeB - timeA;
      return (a.id || '').localeCompare(b.id || '');
    });

    const totalCount = list.length;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });
    const sliced = list.slice(range.from, range.to + 1);

    return { logs: sliced, pagination, error: null };
  }

  try {
    let query = sb.supabase
      .from('billing_date_audit_logs')
      .select('*', { count: 'exact' });

    if (params?.enrollmentId) {
      query = query.eq('enrollment_id', params.enrollmentId);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    if (error) throw error;

    const totalCount = count ?? 0;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });

    return {
      logs: (data as BillingDateAuditLog[]) || [],
      pagination,
      error: null,
    };
  } catch (err: unknown) {
    return {
      logs: [],
      pagination: emptyMeta,
      error: err instanceof Error ? err : new Error('Failed to retrieve billing date audit logs.'),
    };
  }
}

/**
 * Admin: Override an enrollment's effective billing start anchor date with mandatory audit logging.
 * Does NOT rewrite or delete historical billing records.
 */
export async function overrideBillingStartDate(input: {
  enrollmentId: string;
  newBillingStartDate: string;
  reason: string;
}): Promise<{
  success: boolean;
  enrollment: ProgramEnrollment | null;
  auditLog: BillingDateAuditLog | null;
  error: Error | null;
}> {
  const auth = await resolveAuthContext();
  if (auth.error) {
    return { success: false, enrollment: null, auditLog: null, error: auth.error };
  }
  if (auth.role !== 'admin') {
    return {
      success: false,
      enrollment: null,
      auditLog: null,
      error: new Error('Unauthorized: Admin privilege required to override billing start date.'),
    };
  }

  if (!isValidCalendarDate(input.newBillingStartDate)) {
    return {
      success: false,
      enrollment: null,
      auditLog: null,
      error: new Error(`Invalid billing start date format: "${input.newBillingStartDate}". Expected "YYYY-MM-DD".`),
    };
  }

  if (!input.reason || !input.reason.trim()) {
    return {
      success: false,
      enrollment: null,
      auditLog: null,
      error: new Error('A detailed operational reason is required to adjust billing start date.'),
    };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    return overrideMockBillingStartDate(
      input.enrollmentId,
      input.newBillingStartDate,
      input.reason.trim(),
      auth.userId
    );
  }

  try {
    // 1. Fetch existing enrollment
    const { data: enrData, error: enrErr } = await sb.supabase
      .from('program_enrollments')
      .select('*')
      .eq('id', input.enrollmentId)
      .single();

    if (enrErr || !enrData) {
      return { success: false, enrollment: null, auditLog: null, error: enrErr || new Error('Enrollment not found.') };
    }

    const oldDate =
      enrData.billing_start_date ||
      (typeof enrData.enrolled_at === 'string' ? enrData.enrolled_at.substring(0, 10) : 'unknown');

    // 2. Insert immutable audit log
    const { data: auditData, error: auditErr } = await sb.supabase
      .from('billing_date_audit_logs')
      .insert({
        enrollment_id: input.enrollmentId,
        old_billing_start_date: oldDate,
        new_billing_start_date: input.newBillingStartDate,
        reason: input.reason.trim(),
        changed_by: auth.userId,
      })
      .select()
      .single();

    if (auditErr) throw auditErr;

    // 3. Update enrollment billing start date
    const { data: updatedEnr, error: updateErr } = await sb.supabase
      .from('program_enrollments')
      .update({
        billing_start_date: input.newBillingStartDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.enrollmentId)
      .select()
      .single();

    if (updateErr) throw updateErr;

    return {
      success: true,
      enrollment: updatedEnr as ProgramEnrollment,
      auditLog: auditData as BillingDateAuditLog,
      error: null,
    };
  } catch (err: unknown) {
    return {
      success: false,
      enrollment: null,
      auditLog: null,
      error: err instanceof Error ? err : new Error('Failed to override billing start date.'),
    };
  }
}

// ==============================================================================
// 7. Paginated Admin Billing Services & Performance Foundation (Batch 4.6B-1)
// ==============================================================================

export const DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE = 25;
export const DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE = 25;

/**
 * Safely sanitizes search query input for PostgREST .or() filter expressions.
 * Strips syntax delimiters (commas, parentheses, quotes, colons, semicolons, slashes) to prevent filter manipulation.
 */
export function sanitizeSearchInput(input: string): string {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[,()":;\\/]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface AdminStudentPaymentRecordsPaginatedParams {
  page?: number;
  pageSize?: number;
  studentId?: string;
  enrollmentId?: string;
  status?: StudentPaymentStatus;
  paymentMethod?: PaymentMethod;
  search?: string;
  includeDeleted?: boolean;
}

export interface AdminStudentPaymentRecordsPaginatedResult {
  records: StudentPaymentRecord[];
  pagination: PaginationMeta;
  error: Error | null;
}

/**
 * Admin: Retrieve paginated student payment records with exact count metadata,
 * deterministic ordering (cycle_start_date DESC NULLS LAST, id ASC),
 * server-side status/method filtering, and safe search.
 */
export async function getAdminStudentPaymentRecordsPaginated(
  params?: AdminStudentPaymentRecordsPaginatedParams
): Promise<AdminStudentPaymentRecordsPaginatedResult> {
  const auth = await resolveAuthContext();
  const page = params?.page ?? DEFAULT_PAGE;
  const pageSize = params?.pageSize ?? DEFAULT_ADMIN_STUDENT_PAYMENT_PAGE_SIZE;
  const range = calculatePaginationRange({ page, pageSize });

  const emptyMeta = createPaginationMeta({
    page: range.page,
    pageSize: range.pageSize,
    totalCount: 0,
  });

  if (auth.error) {
    return { records: [], pagination: emptyMeta, error: auth.error };
  }
  if (auth.role !== 'admin') {
    return {
      records: [],
      pagination: emptyMeta,
      error: new Error('Unauthorized: Admin privilege required.'),
    };
  }

  // Guard against non-empty search that has zero searchable tokens after sanitization
  const isSearchProvided = typeof params?.search === 'string' && params.search.trim().length > 0;
  let sanitizedSearch = '';
  if (isSearchProvided) {
    sanitizedSearch = sanitizeSearchInput(params!.search!);
    if (!sanitizedSearch) {
      return { records: [], pagination: emptyMeta, error: null };
    }
    if (sanitizedSearch.replace(/[%]/g, '').trim().length === 0) {
      return { records: [], pagination: emptyMeta, error: null };
    }
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    let list = getMockStudentPaymentRecords({
      studentId: params?.studentId,
      enrollmentId: params?.enrollmentId,
      status: params?.status,
      includeDeleted: params?.includeDeleted,
    });

    if (params?.paymentMethod) {
      list = list.filter((r) => r.payment_method === params.paymentMethod);
    }

    if (sanitizedSearch) {
      const q = sanitizedSearch.toLowerCase();
      const mockUsers = getMockUsers();
      list = list.filter((r) => {
        const refMatch = (r.transaction_reference || '').toLowerCase().includes(q);
        const cycleMatch = r.cycle_start_date.includes(q) || r.cycle_end_date.includes(q);
        const waivedMatch = (r.waived_reason || '').toLowerCase().includes(q);
        const student = mockUsers.find((u) => u.id === r.student_id);
        const nameMatch = (student?.full_name || '').toLowerCase().includes(q);
        const idMatch = (student?.poraplan_id || '').toLowerCase().includes(q);
        return refMatch || cycleMatch || waivedMatch || nameMatch || idMatch;
      });
    }

    // Deterministic sort: cycle_start_date DESC NULLS LAST, id ASC
    list.sort((a, b) => {
      const timeA = a.cycle_start_date ? new Date(a.cycle_start_date).getTime() : -Infinity;
      const timeB = b.cycle_start_date ? new Date(b.cycle_start_date).getTime() : -Infinity;
      if (timeB !== timeA) return timeB - timeA;
      return (a.id || '').localeCompare(b.id || '');
    });

    const totalCount = list.length;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });
    const sliced = list.slice(range.from, range.to + 1);

    return { records: sliced, pagination, error: null };
  }

  try {
    let query = sb.supabase
      .from('student_payment_records')
      .select('*', { count: 'exact' });

    if (!params?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    if (params?.studentId) {
      query = query.eq('student_id', params.studentId);
    }
    if (params?.enrollmentId) {
      query = query.eq('enrollment_id', params.enrollmentId);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    if (params?.paymentMethod) {
      query = query.eq('payment_method', params.paymentMethod);
    }

    if (sanitizedSearch) {
      // Find matching student profiles to enable searching by student name/poraplan_id
      let matchedStudentIds: string[] = [];
      const { data: matchedProfiles } = await sb.supabase
        .from('profiles')
        .select('id')
        .or(`full_name.ilike.%${sanitizedSearch}%,poraplan_id.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`)
        .limit(50);

      if (matchedProfiles && matchedProfiles.length > 0) {
        matchedStudentIds = matchedProfiles.map((p) => p.id);
      }

      if (matchedStudentIds.length > 0) {
        query = query.or(
          `transaction_reference.ilike.%${sanitizedSearch}%,waived_reason.ilike.%${sanitizedSearch}%,student_id.in.(${matchedStudentIds.join(',')})`
        );
      } else {
        query = query.or(
          `transaction_reference.ilike.%${sanitizedSearch}%,waived_reason.ilike.%${sanitizedSearch}%`
        );
      }
    }

    // Deterministic ordering: cycle_start_date DESC NULLS LAST, id ASC
    query = query
      .order('cycle_start_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    const { data, count, error } = await query;
    if (error) throw error;

    const totalCount = count ?? 0;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });

    return {
      records: (data as StudentPaymentRecord[]) || [],
      pagination,
      error: null,
    };
  } catch (err: unknown) {
    return {
      records: [],
      pagination: emptyMeta,
      error: err instanceof Error ? err : new Error('Failed to retrieve paginated student payment records.'),
    };
  }
}

export interface AdminMentorPaymentRecordsPaginatedParams {
  page?: number;
  pageSize?: number;
  mentorId?: string;
  billingMonth?: string;
  status?: MentorPaymentStatus;
  paymentMethod?: PaymentMethod;
  search?: string;
  includeDeleted?: boolean;
}

export interface AdminMentorPaymentRecordsPaginatedResult {
  records: MentorPaymentRecord[];
  pagination: PaginationMeta;
  error: Error | null;
}

/**
 * Admin: Retrieve paginated mentor payout records with exact count metadata,
 * deterministic ordering (billing_month DESC NULLS LAST, id ASC),
 * server-side status/method filtering, and safe search.
 */
export async function getAdminMentorPaymentRecordsPaginated(
  params?: AdminMentorPaymentRecordsPaginatedParams
): Promise<AdminMentorPaymentRecordsPaginatedResult> {
  const auth = await resolveAuthContext();
  const page = params?.page ?? DEFAULT_PAGE;
  const pageSize = params?.pageSize ?? DEFAULT_ADMIN_MENTOR_PAYMENT_PAGE_SIZE;
  const range = calculatePaginationRange({ page, pageSize });

  const emptyMeta = createPaginationMeta({
    page: range.page,
    pageSize: range.pageSize,
    totalCount: 0,
  });

  if (auth.error) {
    return { records: [], pagination: emptyMeta, error: auth.error };
  }
  if (auth.role !== 'admin') {
    return {
      records: [],
      pagination: emptyMeta,
      error: new Error('Unauthorized: Admin privilege required.'),
    };
  }

  // Guard against non-empty search that has zero searchable tokens after sanitization
  const isSearchProvided = typeof params?.search === 'string' && params.search.trim().length > 0;
  let sanitizedSearch = '';
  if (isSearchProvided) {
    sanitizedSearch = sanitizeSearchInput(params!.search!);
    if (!sanitizedSearch) {
      return { records: [], pagination: emptyMeta, error: null };
    }
    if (sanitizedSearch.replace(/[%]/g, '').trim().length === 0) {
      return { records: [], pagination: emptyMeta, error: null };
    }
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    let list = getMockMentorPaymentRecords({
      mentorId: params?.mentorId,
      billingMonth: params?.billingMonth,
      status: params?.status,
      includeDeleted: params?.includeDeleted,
    });

    if (params?.paymentMethod) {
      list = list.filter((r) => r.payment_method === params.paymentMethod);
    }

    if (sanitizedSearch) {
      const q = sanitizedSearch.toLowerCase();
      const mockUsers = getMockUsers();
      list = list.filter((r) => {
        const refMatch = (r.transaction_reference || '').toLowerCase().includes(q);
        const monthMatch = r.billing_month.includes(q);
        const mentor = mockUsers.find((u) => u.id === r.mentor_id);
        const nameMatch = (mentor?.full_name || '').toLowerCase().includes(q);
        const emailMatch = (mentor?.email || '').toLowerCase().includes(q);
        return refMatch || monthMatch || nameMatch || emailMatch;
      });
    }

    // Deterministic sort: billing_month DESC NULLS LAST, id ASC
    list.sort((a, b) => {
      const timeA = a.billing_month ? new Date(a.billing_month).getTime() : -Infinity;
      const timeB = b.billing_month ? new Date(b.billing_month).getTime() : -Infinity;
      if (timeB !== timeA) return timeB - timeA;
      return (a.id || '').localeCompare(b.id || '');
    });

    const totalCount = list.length;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });
    const sliced = list.slice(range.from, range.to + 1);

    return { records: sliced, pagination, error: null };
  }

  try {
    let query = sb.supabase
      .from('mentor_payment_records')
      .select('*', { count: 'exact' });

    if (!params?.includeDeleted) {
      query = query.eq('is_deleted', false);
    }
    if (params?.mentorId) {
      query = query.eq('mentor_id', params.mentorId);
    }
    if (params?.billingMonth) {
      query = query.eq('billing_month', params.billingMonth);
    }
    if (params?.status) {
      query = query.eq('status', params.status);
    }
    if (params?.paymentMethod) {
      query = query.eq('payment_method', params.paymentMethod);
    }

    if (sanitizedSearch) {
      // Find matching mentor profiles to enable searching by mentor name/email
      let matchedMentorIds: string[] = [];
      const { data: matchedProfiles } = await sb.supabase
        .from('profiles')
        .select('id')
        .or(`full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,poraplan_id.ilike.%${sanitizedSearch}%`)
        .limit(50);

      if (matchedProfiles && matchedProfiles.length > 0) {
        matchedMentorIds = matchedProfiles.map((p) => p.id);
      }

      if (matchedMentorIds.length > 0) {
        query = query.or(
          `transaction_reference.ilike.%${sanitizedSearch}%,billing_month.ilike.%${sanitizedSearch}%,mentor_id.in.(${matchedMentorIds.join(',')})`
        );
      } else {
        query = query.or(
          `transaction_reference.ilike.%${sanitizedSearch}%,billing_month.ilike.%${sanitizedSearch}%`
        );
      }
    }

    // Deterministic ordering: billing_month DESC NULLS LAST, id ASC
    query = query
      .order('billing_month', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    const { data, count, error } = await query;
    if (error) throw error;

    const totalCount = count ?? 0;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });

    return {
      records: (data as MentorPaymentRecord[]) || [],
      pagination,
      error: null,
    };
  } catch (err: unknown) {
    return {
      records: [],
      pagination: emptyMeta,
      error: err instanceof Error ? err : new Error('Failed to retrieve paginated mentor payment records.'),
    };
  }
}

export interface GlobalDuplicateReferencesResult {
  counts: Map<string, number>;
  duplicateSet: Set<string>;
  duplicatesList: Array<{ reference: string; count: number }>;
  totalDuplicateCount: number;
  error: Error | null;
}

/**
 * Checks whether a given transaction reference is in the set of global duplicates.
 */
export function isDuplicateTransactionReference(
  reference: string | null | undefined,
  duplicateSet?: Set<string> | null
): boolean {
  if (!duplicateSet || duplicateSet.size === 0) return false;
  if (!reference || typeof reference !== 'string') return false;
  const clean = reference.trim().toUpperCase();
  return clean.length > 0 && duplicateSet.has(clean);
}

/**
 * Admin: Global duplicate transaction-reference detection across student and mentor payment records.
 *
 * Implements strict scalability safeguard: uses deterministic chunked range queries
 * (`range(from, to)` ordered by `id ASC`) to prevent PostgREST `max_rows` truncation.
 *
 * Rules:
 * - Combines student and mentor records into one namespace.
 * - Excludes cash payments (payment_method = 'cash').
 * - Ignores null and empty references.
 * - Trims whitespace and normalizes case to uppercase.
 * - Detects cross-track and same-track duplicate references globally.
 */
export async function getGlobalDuplicateReferences(): Promise<GlobalDuplicateReferencesResult> {
  const emptyResult: GlobalDuplicateReferencesResult = {
    counts: new Map(),
    duplicateSet: new Set(),
    duplicatesList: [],
    totalDuplicateCount: 0,
    error: null,
  };

  const auth = await resolveAuthContext();
  if (auth.error) return { ...emptyResult, error: auth.error };
  if (auth.role !== 'admin') {
    return { ...emptyResult, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const rawStudents = getMockStudentPaymentRecords({ includeDeleted: false });
    const rawMentors = getMockMentorPaymentRecords({ includeDeleted: false });

    const counts = new Map<string, number>();
    for (const r of rawStudents) {
      if (r.transaction_reference && r.transaction_reference.trim() && r.payment_method !== 'cash') {
        const ref = r.transaction_reference.trim().toUpperCase();
        counts.set(ref, (counts.get(ref) || 0) + 1);
      }
    }
    for (const r of rawMentors) {
      if (r.transaction_reference && r.transaction_reference.trim() && r.payment_method !== 'cash') {
        const ref = r.transaction_reference.trim().toUpperCase();
        counts.set(ref, (counts.get(ref) || 0) + 1);
      }
    }

    const duplicateSet = new Set<string>();
    const duplicatesList: Array<{ reference: string; count: number }> = [];
    counts.forEach((count, ref) => {
      if (count > 1) {
        duplicateSet.add(ref);
        duplicatesList.push({ reference: ref, count });
      }
    });

    return {
      counts,
      duplicateSet,
      duplicatesList,
      totalDuplicateCount: duplicatesList.length,
      error: null,
    };
  }

  try {
    // Scalability safeguard: retrieve references using chunked range pagination
    // to prevent truncation by PostgREST max_rows limits (typically 1000).
    const chunkSize = 1000;
    const counts = new Map<string, number>();

    // 1. Chunked retrieval from student_payment_records
    let studentFrom = 0;
    while (true) {
      const studentTo = studentFrom + chunkSize - 1;
      const { data, error } = await sb.supabase
        .from('student_payment_records')
        .select('transaction_reference')
        .eq('is_deleted', false)
        .neq('payment_method', 'cash')
        .not('transaction_reference', 'is', null)
        .order('id', { ascending: true })
        .range(studentFrom, studentTo);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        if (row.transaction_reference && row.transaction_reference.trim()) {
          const ref = row.transaction_reference.trim().toUpperCase();
          counts.set(ref, (counts.get(ref) || 0) + 1);
        }
      }

      if (data.length < chunkSize) break;
      studentFrom += chunkSize;
    }

    // 2. Chunked retrieval from mentor_payment_records
    let mentorFrom = 0;
    while (true) {
      const mentorTo = mentorFrom + chunkSize - 1;
      const { data, error } = await sb.supabase
        .from('mentor_payment_records')
        .select('transaction_reference')
        .eq('is_deleted', false)
        .neq('payment_method', 'cash')
        .not('transaction_reference', 'is', null)
        .order('id', { ascending: true })
        .range(mentorFrom, mentorTo);

      if (error) throw error;
      if (!data || data.length === 0) break;

      for (const row of data) {
        if (row.transaction_reference && row.transaction_reference.trim()) {
          const ref = row.transaction_reference.trim().toUpperCase();
          counts.set(ref, (counts.get(ref) || 0) + 1);
        }
      }

      if (data.length < chunkSize) break;
      mentorFrom += chunkSize;
    }

    const duplicateSet = new Set<string>();
    const duplicatesList: Array<{ reference: string; count: number }> = [];
    counts.forEach((count, ref) => {
      if (count > 1) {
        duplicateSet.add(ref);
        duplicatesList.push({ reference: ref, count });
      }
    });

    return {
      counts,
      duplicateSet,
      duplicatesList,
      totalDuplicateCount: duplicatesList.length,
      error: null,
    };
  } catch (err: unknown) {
    return {
      ...emptyResult,
      error: err instanceof Error ? err : new Error('Failed to retrieve global duplicate transaction references.'),
    };
  }
}

export interface AdminBillingMetrics {
  pendingStudents: number;
  overdueStudents: number;
  pendingMentors: number;
  upcomingRenewals: number;
  duplicateReferencesCount: number;
}

export interface AdminBillingMetricsResult {
  metrics: AdminBillingMetrics;
  error: Error | null;
}

/**
 * Admin: Retrieve lightweight operational metrics for the Billing Desk overview.
 * Uses parallel HEAD count queries for pending/overdue records and global duplicate detection.
 * Strictly adheres to the absolute NO-AMOUNT policy.
 */
export async function getAdminBillingMetrics(): Promise<AdminBillingMetricsResult> {
  const emptyMetrics: AdminBillingMetrics = {
    pendingStudents: 0,
    overdueStudents: 0,
    pendingMentors: 0,
    upcomingRenewals: 0,
    duplicateReferencesCount: 0,
  };

  const auth = await resolveAuthContext();
  if (auth.error) return { metrics: emptyMetrics, error: auth.error };
  if (auth.role !== 'admin') {
    return { metrics: emptyMetrics, error: new Error('Unauthorized: Admin privilege required.') };
  }

  const todayBD = toBangladeshDateStr();

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const rawStudents = getMockStudentPaymentRecords({ includeDeleted: false });
    const rawMentors = getMockMentorPaymentRecords({ includeDeleted: false });
    const enrollments = getMockEnrollments();
    const dupRes = await getGlobalDuplicateReferences();

    const pendingStudents = rawStudents.filter((r) => r.status === 'pending').length;
    const overdueStudents = rawStudents.filter((r) => r.status === 'overdue').length;
    const pendingMentors = rawMentors.filter((r) => r.status === 'pending').length;

    const upcomingRenewals = enrollments.filter((e) => {
      if (e.status !== 'active') return false;
      const anchor = e.billing_start_date || (e.enrolled_at ? e.enrolled_at.substring(0, 10) : todayBD);
      const period = computeBillingPeriod(anchor, 0);
      return period.nextDueDate >= todayBD;
    }).length;

    return {
      metrics: {
        pendingStudents,
        overdueStudents,
        pendingMentors,
        upcomingRenewals,
        duplicateReferencesCount: dupRes.totalDuplicateCount,
      },
      error: null,
    };
  }

  try {
    // Parallel exact-count queries with head: true to minimize database network transfer
    const [
      pendingStudentsRes,
      overdueStudentsRes,
      pendingMentorsRes,
      activeEnrollmentsRes,
      dupRes,
    ] = await Promise.all([
      sb.supabase
        .from('student_payment_records')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'pending'),
      sb.supabase
        .from('student_payment_records')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'overdue'),
      sb.supabase
        .from('mentor_payment_records')
        .select('*', { count: 'exact', head: true })
        .eq('is_deleted', false)
        .eq('status', 'pending'),
      sb.supabase
        .from('program_enrollments')
        .select('billing_start_date, enrolled_at')
        .eq('status', 'active'),
      getGlobalDuplicateReferences(),
    ]);

    if (pendingStudentsRes.error) throw pendingStudentsRes.error;
    if (overdueStudentsRes.error) throw overdueStudentsRes.error;
    if (pendingMentorsRes.error) throw pendingMentorsRes.error;
    if (activeEnrollmentsRes.error) throw activeEnrollmentsRes.error;
    if (dupRes.error) throw dupRes.error;

    // Calculate upcoming renewals from active enrollments
    const enrollments = (activeEnrollmentsRes.data as Array<{ billing_start_date?: string | null; enrolled_at?: string | null }>) || [];
    const upcomingRenewals = enrollments.filter((e) => {
      const anchor = e.billing_start_date || (e.enrolled_at ? e.enrolled_at.substring(0, 10) : todayBD);
      const period = computeBillingPeriod(anchor, 0);
      return period.nextDueDate >= todayBD;
    }).length;

    return {
      metrics: {
        pendingStudents: pendingStudentsRes.count ?? 0,
        overdueStudents: overdueStudentsRes.count ?? 0,
        pendingMentors: pendingMentorsRes.count ?? 0,
        upcomingRenewals,
        duplicateReferencesCount: dupRes.totalDuplicateCount,
      },
      error: null,
    };
  } catch (err: unknown) {
    return {
      metrics: emptyMetrics,
      error: err instanceof Error ? err : new Error('Failed to retrieve admin billing metrics.'),
    };
  }
}

/**
 * Admin: Retrieve up to 5 recent student payment records ordered by cycle_start_date DESC.
 * Bounded query prevents full-table download on desk overview.
 */
export async function getRecentStudentPaymentRecords(
  limit = 5
): Promise<{ records: StudentPaymentRecord[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { records: [], error: auth.error };
  if (auth.role !== 'admin') {
    return { records: [], error: new Error('Unauthorized: Admin privilege required.') };
  }

  const safeLimit = Math.min(Math.max(1, limit), 5);

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const list = getMockStudentPaymentRecords({ includeDeleted: false });
    list.sort((a, b) => {
      const timeA = a.cycle_start_date ? new Date(a.cycle_start_date).getTime() : -Infinity;
      const timeB = b.cycle_start_date ? new Date(b.cycle_start_date).getTime() : -Infinity;
      if (timeB !== timeA) return timeB - timeA;
      return (a.id || '').localeCompare(b.id || '');
    });
    return { records: list.slice(0, safeLimit), error: null };
  }

  try {
    const { data, error } = await sb.supabase
      .from('student_payment_records')
      .select('*')
      .eq('is_deleted', false)
      .order('cycle_start_date', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(safeLimit);

    if (error) throw error;
    return { records: (data as StudentPaymentRecord[]) || [], error: null };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve recent student payment records.'),
    };
  }
}

/**
 * Admin: Retrieve up to 5 recent mentor payout records ordered by billing_month DESC.
 * Bounded query prevents full-table download on desk overview.
 */
export async function getRecentMentorPaymentRecords(
  limit = 5
): Promise<{ records: MentorPaymentRecord[]; error: Error | null }> {
  const auth = await resolveAuthContext();
  if (auth.error) return { records: [], error: auth.error };
  if (auth.role !== 'admin') {
    return { records: [], error: new Error('Unauthorized: Admin privilege required.') };
  }

  const safeLimit = Math.min(Math.max(1, limit), 5);

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const list = getMockMentorPaymentRecords({ includeDeleted: false });
    list.sort((a, b) => {
      const timeA = a.billing_month ? new Date(a.billing_month).getTime() : -Infinity;
      const timeB = b.billing_month ? new Date(b.billing_month).getTime() : -Infinity;
      if (timeB !== timeA) return timeB - timeA;
      return (a.id || '').localeCompare(b.id || '');
    });
    return { records: list.slice(0, safeLimit), error: null };
  }

  try {
    const { data, error } = await sb.supabase
      .from('mentor_payment_records')
      .select('*')
      .eq('is_deleted', false)
      .order('billing_month', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .limit(safeLimit);

    if (error) throw error;
    return { records: (data as MentorPaymentRecord[]) || [], error: null };
  } catch (err: unknown) {
    return {
      records: [],
      error: err instanceof Error ? err : new Error('Failed to retrieve recent mentor payout records.'),
    };
  }
}

export interface AdminCalendarMonthDataResult {
  studentRecords: StudentPaymentRecord[];
  mentorRecords: MentorPaymentRecord[];
  error: Error | null;
}

/**
 * Admin: Retrieve month-scoped student payments and mentor payouts for the calendar heatmap.
 * Queries records whose due date or payout date falls within the active calendar month in Asia/Dhaka time.
 * Bounded date-range query eliminates full-table historical scans.
 */
export async function getAdminCalendarMonthData(
  year: number,
  month: number
): Promise<AdminCalendarMonthDataResult> {
  const emptyResult: AdminCalendarMonthDataResult = {
    studentRecords: [],
    mentorRecords: [],
    error: null,
  };

  const auth = await resolveAuthContext();
  if (auth.error) return { ...emptyResult, error: auth.error };
  if (auth.role !== 'admin') {
    return { ...emptyResult, error: new Error('Unauthorized: Admin privilege required.') };
  }

  // Calculate Bangladesh calendar boundaries (UTC+6)
  const safeYear = Math.max(2000, Math.floor(year));
  const safeMonth = Math.min(Math.max(1, Math.floor(month)), 12);
  const daysInMonth = new Date(safeYear, safeMonth, 0).getDate();

  const startDateStr = `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`;
  const endDateStr = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const sb = await getSupabaseBackend();
  if (!sb.isConfigured || !sb.supabase) {
    const rawStudents = getMockStudentPaymentRecords({ includeDeleted: false });
    const rawMentors = getMockMentorPaymentRecords({ includeDeleted: false });

    const studentRecords = rawStudents.filter((r) => {
      if (!r.next_due_date) return false;
      return r.next_due_date >= startDateStr && r.next_due_date <= endDateStr;
    });

    const mentorRecords = rawMentors.filter((r) => {
      if (!r.payout_date) return false;
      let dateKey: string;
      try {
        dateKey = toBangladeshDateStr(r.payout_date);
      } catch {
        dateKey = r.payout_date.split('T')[0];
      }
      return dateKey >= startDateStr && dateKey <= endDateStr;
    });

    return { studentRecords, mentorRecords, error: null };
  }

  try {
    const [studentRes, mentorRes] = await Promise.all([
      sb.supabase
        .from('student_payment_records')
        .select('*')
        .eq('is_deleted', false)
        .gte('next_due_date', startDateStr)
        .lte('next_due_date', endDateStr)
        .order('next_due_date', { ascending: true }),
      sb.supabase
        .from('mentor_payment_records')
        .select('*')
        .eq('is_deleted', false)
        .gte('payout_date', `${startDateStr}T00:00:00+06:00`)
        .lte('payout_date', `${endDateStr}T23:59:59.999+06:00`)
        .order('payout_date', { ascending: true }),
    ]);

    if (studentRes.error) throw studentRes.error;
    if (mentorRes.error) throw mentorRes.error;

    return {
      studentRecords: (studentRes.data as StudentPaymentRecord[]) || [],
      mentorRecords: (mentorRes.data as MentorPaymentRecord[]) || [],
      error: null,
    };
  } catch (err: unknown) {
    return {
      ...emptyResult,
      error: err instanceof Error ? err : new Error('Failed to retrieve calendar month data.'),
    };
  }
}
