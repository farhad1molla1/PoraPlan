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
} from './mockAuthStore';

import { isValidCalendarDate } from './billingCycles';

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
