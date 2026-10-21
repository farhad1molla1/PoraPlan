/**
 * PoraPlan — Academic Doubts Resolution Desk Service Layer
 *
 * Provides student question submission, mentor response dispatch, status management,
 * academic object linkage (subjects, study plans, tasks, assignments), and strict
 * role-isolated queries across both Supabase and local mock stores.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Doubt,
  DoubtStatus,
  DoubtPriority,
  DoubtResponse,
} from '../types/database';
import {
  getMockStudentDoubts,
  getMockMentorDoubts,
  getMockDoubtById,
  createMockDoubt,
  addMockDoubtResponse,
  updateMockDoubtStatus,
  deleteMockDoubt,
} from './mockAuthStore';
import { getAssignedStudents } from './mentorship';

export interface DoubtResponseWithAuthor extends DoubtResponse {
  author_name?: string;
  author_role?: string;
  author_poraplan_id?: string;
}

export interface DoubtWithMeta extends Doubt {
  student_name?: string;
  student_poraplan_id?: string;
  mentor_name?: string;
  subject_name?: string;
  subject_code?: string;
  plan_title?: string;
  task_title?: string;
  assignment_title?: string;
  responses?: DoubtResponseWithAuthor[];
  responses_count?: number;
  latest_response?: DoubtResponseWithAuthor;
}

/**
 * Fetch all doubts submitted by a student.
 */
export async function getStudentDoubts(studentId: string): Promise<{
  doubts: DoubtWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { doubts: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentDoubts(studentId);
    return { doubts: list as DoubtWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('doubts')
      .select('*, subjects(id, name, code), study_plans(id, title), tasks(id, title), assignments(id, title), profiles!mentor_id(full_name), doubt_responses(*, profiles!author_id(full_name, poraplan_id, role))')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      return { doubts: [], error };
    }

    const doubts: DoubtWithMeta[] = (data || []).map((row: any) => {
      const rawResponses: any[] = row.doubt_responses || [];
      const responses: DoubtResponseWithAuthor[] = rawResponses
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        .map((r) => ({
          id: r.id,
          doubt_id: r.doubt_id,
          author_id: r.author_id,
          message: r.message,
          created_at: r.created_at,
          author_name: r.profiles?.full_name || 'User',
          author_role: r.profiles?.role,
          author_poraplan_id: r.profiles?.poraplan_id,
        }));

      return {
        id: row.id,
        student_id: row.student_id,
        mentor_id: row.mentor_id,
        subject_id: row.subject_id,
        plan_id: row.plan_id,
        task_id: row.task_id,
        assignment_id: row.assignment_id,
        title: row.title,
        question: row.question,
        priority: row.priority,
        status: row.status,
        resolved_at: row.resolved_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        subject_name: row.subjects?.name || undefined,
        subject_code: row.subjects?.code || undefined,
        plan_title: row.study_plans?.title || undefined,
        task_title: row.tasks?.title || undefined,
        assignment_title: row.assignments?.title || undefined,
        mentor_name: row.profiles?.full_name || undefined,
        responses,
        responses_count: responses.length,
        latest_response: responses.length > 0 ? responses[responses.length - 1] : undefined,
      };
    });

    return { doubts, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { doubts: [], error };
  }
}

/**
 * Fetch all doubts submitted by scholars assigned to a mentor.
 */
export async function getMentorDoubts(mentorId: string): Promise<{
  doubts: DoubtWithMeta[];
  error: Error | null;
}> {
  if (!mentorId) {
    return { doubts: [], error: new Error('Mentor ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockMentorDoubts(mentorId);
    return { doubts: list as DoubtWithMeta[], error: null };
  }

  try {
    // 1. Fetch mentor's assigned students
    const { students, error: stuErr } = await getAssignedStudents(mentorId);
    if (stuErr) return { doubts: [], error: stuErr };

    if (!students || students.length === 0) {
      return { doubts: [], error: null };
    }

    const studentIds = students.map((s) => s.id);

    // 2. Fetch doubts for these students
    const { data, error } = await supabase
      .from('doubts')
      .select('*, subjects(id, name, code), study_plans(id, title), tasks(id, title), assignments(id, title), profiles!student_id(full_name, poraplan_id), doubt_responses(*, profiles!author_id(full_name, poraplan_id, role))')
      .in('student_id', studentIds)
      .order('created_at', { ascending: false });

    if (error) {
      return { doubts: [], error };
    }

    const doubts: DoubtWithMeta[] = (data || []).map((row: any) => {
      const rawResponses: any[] = row.doubt_responses || [];
      const responses: DoubtResponseWithAuthor[] = rawResponses
        .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
        .map((r) => ({
          id: r.id,
          doubt_id: r.doubt_id,
          author_id: r.author_id,
          message: r.message,
          created_at: r.created_at,
          author_name: r.profiles?.full_name || 'User',
          author_role: r.profiles?.role,
          author_poraplan_id: r.profiles?.poraplan_id,
        }));

      return {
        id: row.id,
        student_id: row.student_id,
        mentor_id: row.mentor_id,
        subject_id: row.subject_id,
        plan_id: row.plan_id,
        task_id: row.task_id,
        assignment_id: row.assignment_id,
        title: row.title,
        question: row.question,
        priority: row.priority,
        status: row.status,
        resolved_at: row.resolved_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        student_name: row.profiles?.full_name || undefined,
        student_poraplan_id: row.profiles?.poraplan_id || undefined,
        subject_name: row.subjects?.name || undefined,
        subject_code: row.subjects?.code || undefined,
        plan_title: row.study_plans?.title || undefined,
        task_title: row.tasks?.title || undefined,
        assignment_title: row.assignments?.title || undefined,
        responses,
        responses_count: responses.length,
        latest_response: responses.length > 0 ? responses[responses.length - 1] : undefined,
      };
    });

    return { doubts, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { doubts: [], error };
  }
}

/**
 * Fetch a single doubt by ID with conversation replies and joined metadata.
 */
export async function getDoubtById(doubtId: string): Promise<{
  doubt: DoubtWithMeta | null;
  error: Error | null;
}> {
  if (!doubtId) {
    return { doubt: null, error: new Error('Doubt ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const d = getMockDoubtById(doubtId);
    return { doubt: d as DoubtWithMeta | null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('doubts')
      .select('*, subjects(id, name, code), study_plans(id, title), tasks(id, title), assignments(id, title), profiles!student_id(full_name, poraplan_id), profiles!mentor_id(full_name), doubt_responses(*, profiles!author_id(full_name, poraplan_id, role))')
      .eq('id', doubtId)
      .maybeSingle();

    if (error) return { doubt: null, error };
    if (!data) return { doubt: null, error: null };

    const row: any = data;
    const rawResponses: any[] = row.doubt_responses || [];
    const responses: DoubtResponseWithAuthor[] = rawResponses
      .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
      .map((r) => ({
        id: r.id,
        doubt_id: r.doubt_id,
        author_id: r.author_id,
        message: r.message,
        created_at: r.created_at,
        author_name: r.profiles?.full_name || 'User',
        author_role: r.profiles?.role,
        author_poraplan_id: r.profiles?.poraplan_id,
      }));

    const doubt: DoubtWithMeta = {
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      task_id: row.task_id,
      assignment_id: row.assignment_id,
      title: row.title,
      question: row.question,
      priority: row.priority,
      status: row.status,
      resolved_at: row.resolved_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student_name: row.profiles?.full_name || undefined,
      student_poraplan_id: row.profiles?.poraplan_id || undefined,
      subject_name: row.subjects?.name || undefined,
      subject_code: row.subjects?.code || undefined,
      plan_title: row.study_plans?.title || undefined,
      task_title: row.tasks?.title || undefined,
      assignment_title: row.assignments?.title || undefined,
      mentor_name: row.profiles?.full_name || undefined,
      responses,
      responses_count: responses.length,
      latest_response: responses.length > 0 ? responses[responses.length - 1] : undefined,
    };

    return { doubt, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { doubt: null, error };
  }
}

/**
 * Submit a new academic doubt inquiry.
 */
export async function createDoubt(params: {
  studentId: string;
  title: string;
  question: string;
  subjectId?: string;
  planId?: string;
  taskId?: string;
  assignmentId?: string;
  priority?: DoubtPriority;
}): Promise<{
  doubt: Doubt | null;
  error: Error | null;
}> {
  const cleanTitle = params.title?.trim();
  if (!cleanTitle) {
    return { doubt: null, error: new Error('Doubt title is required.') };
  }
  const cleanQuestion = params.question?.trim();
  if (!cleanQuestion) {
    return { doubt: null, error: new Error('Doubt question body is required.') };
  }
  if (!params.studentId) {
    return { doubt: null, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = createMockDoubt(params);
    return res;
  }

  try {
    // 1. Look up mentor assigned to student if available
    let mentorId: string | null = null;
    const { data: mentorPair } = await supabase
      .from('mentor_students')
      .select('mentor_id')
      .eq('student_id', params.studentId)
      .maybeSingle();

    if (mentorPair?.mentor_id) {
      mentorId = mentorPair.mentor_id;
    }

    // 2. Validate subject ownership if supplied
    if (params.subjectId) {
      const { data: subject } = await supabase
        .from('subjects')
        .select('id, student_id')
        .eq('id', params.subjectId)
        .maybeSingle();

      if (!subject || subject.student_id !== params.studentId) {
        return { doubt: null, error: new Error('Selected study area does not belong to this student.') };
      }
    }

    const { data, error } = await supabase
      .from('doubts')
      .insert({
        student_id: params.studentId,
        mentor_id: mentorId,
        subject_id: params.subjectId || null,
        plan_id: params.planId || null,
        task_id: params.taskId || null,
        assignment_id: params.assignmentId || null,
        title: cleanTitle,
        question: cleanQuestion,
        priority: params.priority || 'normal',
        status: 'open',
      })
      .select()
      .single();

    if (error) {
      return { doubt: null, error };
    }

    return { doubt: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { doubt: null, error };
  }
}

/**
 * Add a reply/response message to a doubt conversation.
 */
export async function addDoubtResponse(params: {
  doubtId: string;
  authorId: string;
  message: string;
}): Promise<{
  response: DoubtResponse | null;
  error: Error | null;
}> {
  const cleanMessage = params.message?.trim();
  if (!cleanMessage) {
    return { response: null, error: new Error('Response message cannot be empty.') };
  }
  if (!params.doubtId) {
    return { response: null, error: new Error('Doubt ID is required.') };
  }
  if (!params.authorId) {
    return { response: null, error: new Error('Author ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return addMockDoubtResponse(params);
  }

  try {
    const { data, error } = await supabase
      .from('doubt_responses')
      .insert({
        doubt_id: params.doubtId,
        author_id: params.authorId,
        message: cleanMessage,
      })
      .select()
      .single();

    if (error) {
      return { response: null, error };
    }

    return { response: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { response: null, error };
  }
}

/**
 * Update doubt status (open, answered, resolved).
 */
export async function updateDoubtStatus(
  doubtId: string,
  userId: string,
  status: DoubtStatus
): Promise<{
  doubt: Doubt | null;
  error: Error | null;
}> {
  if (!doubtId) {
    return { doubt: null, error: new Error('Doubt ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockDoubtStatus(doubtId, userId, status);
  }

  try {
    const updates: Partial<Doubt> = {
      status,
      resolved_at: status === 'resolved' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('doubts')
      .update(updates)
      .eq('id', doubtId)
      .select()
      .single();

    if (error) {
      return { doubt: null, error };
    }

    return { doubt: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { doubt: null, error };
  }
}

/**
 * Delete a doubt inquiry.
 */
export async function deleteDoubt(
  doubtId: string,
  userId: string
): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!doubtId) {
    return { success: false, error: new Error('Doubt ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockDoubt(doubtId, userId);
  }

  try {
    const { error } = await supabase
      .from('doubts')
      .delete()
      .eq('id', doubtId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
