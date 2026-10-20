import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Evaluation,
  EvaluationInsert,
  EvaluationUpdate,
  EvaluationFormat,
  EvaluationStatus,
  Subject,
  StudyPlan,
  Assignment,
} from '../types/database';
import {
  getMockStudentEvaluations,
  getMockMentorEvaluations,
  getMockEvaluationById,
  createMockEvaluation,
  updateMockEvaluation,
  recordMockEvaluationResult,
  deleteMockEvaluation,
} from './mockAuthStore';

export type EvaluationWithMeta = Evaluation & {
  student_name?: string;
  student_poraplan_id?: string;
  student_email?: string;
  mentor_name?: string;
  subject_name?: string;
  plan_title?: string;
  assignment_title?: string;
  subject?: Subject | null;
  plan?: StudyPlan | null;
  assignment?: Assignment | null;
};

/**
 * Fetch all evaluations for a student ID.
 * Enforced at database level by Supabase RLS:
 * - Students can only view evaluations where student_id = auth.uid()
 * - Mentors can view evaluations for assigned students
 */
export async function getStudentEvaluations(studentId: string): Promise<{
  evaluations: EvaluationWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { evaluations: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentEvaluations(studentId);
    return { evaluations: list as EvaluationWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*, subjects(id, name, code), study_plans(id, title), assignments(id, title), profiles!mentor_id(full_name)')
      .eq('student_id', studentId)
      .order('scheduled_date', { ascending: false });

    if (error) {
      return { evaluations: [], error };
    }

    const evaluations: EvaluationWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      assignment_id: row.assignment_id,
      title: row.title,
      description: row.description,
      format: row.format,
      status: row.status,
      scheduled_date: row.scheduled_date,
      scheduled_time: row.scheduled_time,
      duration_minutes: row.duration_minutes,
      total_points: row.total_points,
      score: row.score,
      feedback: row.feedback,
      recommendation: row.recommendation,
      evaluated_at: row.evaluated_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject_name: row.subjects?.name || undefined,
      plan_title: row.study_plans?.title || undefined,
      assignment_title: row.assignments?.title || undefined,
      mentor_name: row.profiles?.full_name || undefined,
    }));

    return { evaluations, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { evaluations: [], error };
  }
}

/**
 * Fetch evaluations for a mentor across their assigned students.
 */
export async function getMentorEvaluations(mentorId: string): Promise<{
  evaluations: EvaluationWithMeta[];
  error: Error | null;
}> {
  if (!mentorId) {
    return { evaluations: [], error: new Error('Mentor ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockMentorEvaluations(mentorId);
    return { evaluations: list as EvaluationWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*, subjects(id, name, code), study_plans(id, title), assignments(id, title), profiles!student_id(full_name, poraplan_id, email)')
      .order('scheduled_date', { ascending: false });

    if (error) {
      return { evaluations: [], error };
    }

    const evaluations: EvaluationWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      assignment_id: row.assignment_id,
      title: row.title,
      description: row.description,
      format: row.format,
      status: row.status,
      scheduled_date: row.scheduled_date,
      scheduled_time: row.scheduled_time,
      duration_minutes: row.duration_minutes,
      total_points: row.total_points,
      score: row.score,
      feedback: row.feedback,
      recommendation: row.recommendation,
      evaluated_at: row.evaluated_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject_name: row.subjects?.name || undefined,
      plan_title: row.study_plans?.title || undefined,
      assignment_title: row.assignments?.title || undefined,
      student_name: row.profiles?.full_name || 'Scholar',
      student_poraplan_id: row.profiles?.poraplan_id || undefined,
      student_email: row.profiles?.email || undefined,
    }));

    return { evaluations, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { evaluations: [], error };
  }
}

/**
 * Retrieve a single evaluation by ID.
 */
export async function getEvaluationById(evaluationId: string): Promise<{
  evaluation: EvaluationWithMeta | null;
  error: Error | null;
}> {
  if (!evaluationId) {
    return { evaluation: null, error: new Error('Evaluation ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return getMockEvaluationById(evaluationId);
  }

  try {
    const { data, error } = await supabase
      .from('evaluations')
      .select('*, subjects(id, name, code), study_plans(id, title), assignments(id, title), profiles!student_id(full_name, poraplan_id), profiles!mentor_id(full_name)')
      .eq('id', evaluationId)
      .single();

    if (error) {
      return { evaluation: null, error };
    }

    const row: any = data;
    const evaluation: EvaluationWithMeta = {
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      assignment_id: row.assignment_id,
      title: row.title,
      description: row.description,
      format: row.format,
      status: row.status,
      scheduled_date: row.scheduled_date,
      scheduled_time: row.scheduled_time,
      duration_minutes: row.duration_minutes,
      total_points: row.total_points,
      score: row.score,
      feedback: row.feedback,
      recommendation: row.recommendation,
      evaluated_at: row.evaluated_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject_name: row.subjects?.name || undefined,
      plan_title: row.study_plans?.title || undefined,
      assignment_title: row.assignments?.title || undefined,
      student_name: row.profiles?.full_name || 'Scholar',
      student_poraplan_id: row.profiles?.poraplan_id || undefined,
      mentor_name: row.profiles?.full_name || undefined,
    };

    return { evaluation, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { evaluation: null, error };
  }
}

/**
 * Mentor creates a new evaluation for an assigned student.
 */
export async function createEvaluation(params: {
  studentId: string;
  mentorId: string;
  title: string;
  scheduledDate: string;
  format?: EvaluationFormat;
  scheduledTime?: string;
  durationMinutes?: number;
  totalPoints?: number;
  description?: string;
  subjectId?: string;
  planId?: string;
  assignmentId?: string;
}): Promise<{ evaluation: Evaluation | null; error: Error | null }> {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { evaluation: null, error: new Error('Evaluation title is required.') };
  }
  if (!params.scheduledDate) {
    return { evaluation: null, error: new Error('Scheduled date is required.') };
  }
  if (!params.studentId) {
    return { evaluation: null, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return createMockEvaluation(params);
  }

  try {
    const payload: EvaluationInsert = {
      student_id: params.studentId,
      mentor_id: params.mentorId,
      subject_id: params.subjectId || null,
      plan_id: params.planId || null,
      assignment_id: params.assignmentId || null,
      title: cleanTitle,
      description: params.description?.trim() || null,
      format: params.format || 'oral',
      status: 'scheduled',
      scheduled_date: params.scheduledDate,
      scheduled_time: params.scheduledTime || null,
      duration_minutes: params.durationMinutes !== undefined ? params.durationMinutes : 30,
      total_points: params.totalPoints !== undefined ? params.totalPoints : 100,
    };

    const { data, error } = await supabase
      .from('evaluations')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { evaluation: null, error };
    }

    return { evaluation: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { evaluation: null, error };
  }
}

/**
 * Mentor updates scheduled evaluation metadata.
 */
export async function updateEvaluation(params: {
  evaluationId: string;
  mentorId: string;
  title?: string;
  description?: string;
  format?: EvaluationFormat;
  status?: EvaluationStatus;
  scheduledDate?: string;
  scheduledTime?: string;
  durationMinutes?: number;
  totalPoints?: number;
  subjectId?: string;
  planId?: string;
}): Promise<{ evaluation: Evaluation | null; error: Error | null }> {
  if (!params.evaluationId) {
    return { evaluation: null, error: new Error('Evaluation ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockEvaluation(params.evaluationId, params.mentorId, params);
  }

  try {
    const payload: EvaluationUpdate = {};
    if (params.title !== undefined) {
      const cleanTitle = params.title.trim();
      if (!cleanTitle) {
        return { evaluation: null, error: new Error('Evaluation title cannot be empty.') };
      }
      payload.title = cleanTitle;
    }
    if (params.description !== undefined) {
      payload.description = params.description ? params.description.trim() : null;
    }
    if (params.format !== undefined) {
      payload.format = params.format;
    }
    if (params.status !== undefined) {
      payload.status = params.status;
    }
    if (params.scheduledDate !== undefined) {
      payload.scheduled_date = params.scheduledDate;
    }
    if (params.scheduledTime !== undefined) {
      payload.scheduled_time = params.scheduledTime;
    }
    if (params.durationMinutes !== undefined) {
      payload.duration_minutes = params.durationMinutes;
    }
    if (params.totalPoints !== undefined) {
      payload.total_points = params.totalPoints;
    }
    if (params.subjectId !== undefined) {
      payload.subject_id = params.subjectId || null;
    }
    if (params.planId !== undefined) {
      payload.plan_id = params.planId || null;
    }

    const { data, error } = await supabase
      .from('evaluations')
      .update(payload)
      .eq('id', params.evaluationId)
      .select()
      .single();

    if (error) {
      return { evaluation: null, error };
    }

    return { evaluation: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { evaluation: null, error };
  }
}

/**
 * Mentor records assessment results, awarded score, and qualitative concept feedback.
 */
export async function recordEvaluationResult(params: {
  evaluationId: string;
  mentorId: string;
  score: number;
  feedback: string;
  recommendation?: string;
  status?: EvaluationStatus;
}): Promise<{ evaluation: Evaluation | null; error: Error | null }> {
  if (!params.evaluationId) {
    return { evaluation: null, error: new Error('Evaluation ID is required.') };
  }
  const cleanFeedback = params.feedback.trim();
  if (!cleanFeedback) {
    return { evaluation: null, error: new Error('Evaluation feedback notes are required.') };
  }
  if (params.score === undefined || params.score === null || isNaN(params.score)) {
    return { evaluation: null, error: new Error('Valid numeric score is required.') };
  }

  if (!isSupabaseConfigured()) {
    return recordMockEvaluationResult(params);
  }

  try {
    const now = new Date().toISOString();
    const payload: EvaluationUpdate = {
      score: params.score,
      feedback: cleanFeedback,
      recommendation: params.recommendation?.trim() || null,
      status: params.status || 'completed',
      evaluated_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('evaluations')
      .update(payload)
      .eq('id', params.evaluationId)
      .select()
      .single();

    if (error) {
      return { evaluation: null, error };
    }

    return { evaluation: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { evaluation: null, error };
  }
}

/**
 * Mentor deletes a scheduled evaluation.
 */
export async function deleteEvaluation(
  evaluationId: string,
  mentorId: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!evaluationId) {
    return { success: false, error: new Error('Evaluation ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockEvaluation(evaluationId, mentorId);
  }

  try {
    const { error } = await supabase
      .from('evaluations')
      .delete()
      .eq('id', evaluationId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
