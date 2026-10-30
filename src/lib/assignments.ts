import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Assignment,
  AssignmentInsert,
  AssignmentUpdate,
  AssignmentStatus,
  Submission,
  SubmissionType,
  SubmissionStatus,
  Subject,
  StudyPlan,
} from '../types/database';
import {
  getMockStudentAssignments,
  getMockAssignmentById,
  createMockAssignment,
  updateMockAssignment,
  deleteMockAssignment,
  submitMockAssignment,
  updateMockSubmissionStatus,
  reviewMockSubmission,
  getMockMentorSubmissions,
} from './mockAuthStore';
import { createNotification } from './notifications';

export type SubmissionWithMeta = Submission & {
  assignment_title?: string;
  assignment_total_points?: number | null;
  subject_name?: string;
  student_name?: string;
  student_poraplan_id?: string;
  reviewer_name?: string;
};

export type AssignmentWithMeta = Assignment & {
  subject_name?: string;
  plan_title?: string;
  subject?: Subject | null;
  plan?: StudyPlan | null;
  submission?: Submission | null;
};

/**
 * Fetch all assignments for a given student ID.
 * Handled via RLS on Supabase:
 * - Students can only query their own student_id.
 * - Mentors can only query student_ids of students assigned to them.
 */
export async function getStudentAssignments(studentId: string): Promise<{
  assignments: AssignmentWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { assignments: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentAssignments(studentId);
    return { assignments: list as AssignmentWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, subjects(*), study_plans(*), submissions(*)')
      .eq('student_id', studentId)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { assignments: [], error };
    }

    const assignments: AssignmentWithMeta[] = (data || []).map((row: any) => {
      // Find submission for this student if any
      const submissionsList = Array.isArray(row.submissions) ? row.submissions : (row.submissions ? [row.submissions] : []);
      const submission = submissionsList.find((s: any) => s.student_id === studentId) || null;

      return {
        id: row.id,
        student_id: row.student_id,
        mentor_id: row.mentor_id,
        subject_id: row.subject_id,
        plan_id: row.plan_id,
        title: row.title,
        instructions: row.instructions,
        due_date: row.due_date,
        total_points: row.total_points,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        subject: row.subjects || null,
        subject_name: row.subjects?.name || undefined,
        plan: row.study_plans || null,
        plan_title: row.study_plans?.title || undefined,
        submission: submission || null,
      };
    });

    return { assignments, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { assignments: [], error };
  }
}

/**
 * Fetch a single assignment by ID with its details and submission.
 */
export async function getAssignmentById(assignmentId: string): Promise<{
  assignment: Assignment | null;
  subject: Subject | null;
  plan: StudyPlan | null;
  submission: Submission | null;
  error: Error | null;
}> {
  if (!assignmentId) {
    return { assignment: null, subject: null, plan: null, submission: null, error: new Error('Assignment ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const result = getMockAssignmentById(assignmentId);
    if (!result.assignment) {
      return { assignment: null, subject: null, plan: null, submission: null, error: new Error('Assignment not found.') };
    }
    return {
      assignment: result.assignment,
      subject: result.subject,
      plan: result.plan,
      submission: result.submission,
      error: null,
    };
  }

  try {
    const { data, error } = await supabase
      .from('assignments')
      .select('*, subjects(*), study_plans(*), submissions(*)')
      .eq('id', assignmentId)
      .single();

    if (error || !data) {
      return { assignment: null, subject: null, plan: null, submission: null, error: error || new Error('Assignment not found.') };
    }

    const row = data as any;
    const submissionsList = Array.isArray(row.submissions) ? row.submissions : (row.submissions ? [row.submissions] : []);
    const submission = submissionsList.length > 0 ? submissionsList[0] : null;

    return {
      assignment: {
        id: row.id,
        student_id: row.student_id,
        mentor_id: row.mentor_id,
        subject_id: row.subject_id,
        plan_id: row.plan_id,
        title: row.title,
        instructions: row.instructions,
        due_date: row.due_date,
        total_points: row.total_points,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
      subject: row.subjects || null,
      plan: row.study_plans || null,
      submission: submission || null,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { assignment: null, subject: null, plan: null, submission: null, error };
  }
}

/**
 * Mentor creates a new assignment for an assigned student.
 */
export async function createAssignment(params: {
  studentId: string;
  mentorId?: string;
  subjectId?: string;
  planId?: string;
  title: string;
  instructions?: string;
  dueDate?: string;
  totalPoints?: number;
  status?: AssignmentStatus;
}): Promise<{ assignment: Assignment | null; error: Error | null }> {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { assignment: null, error: new Error('Assignment title is required.') };
  }
  if (!params.studentId) {
    return { assignment: null, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return createMockAssignment(params);
  }

  try {
    const insertPayload: AssignmentInsert = {
      student_id: params.studentId,
      mentor_id: params.mentorId || null,
      subject_id: params.subjectId || null,
      plan_id: params.planId || null,
      title: cleanTitle,
      instructions: params.instructions?.trim() || null,
      due_date: params.dueDate || null,
      total_points: params.totalPoints !== undefined ? params.totalPoints : 100,
      status: params.status || 'published',
    };

    const { data, error } = await supabase
      .from('assignments')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return { assignment: null, error };
    }

    if (insertPayload.status === 'published') {
      createNotification({
        recipientId: params.studentId,
        actorId: params.mentorId || null,
        type: 'assignment_created',
        title: 'New Assignment Published',
        message: `Mentor assigned "${cleanTitle}" (${insertPayload.total_points || 100} pts)`,
        link: '/student/assignments',
        idempotencyKey: `assignment:${data.id}`,
      }).catch(() => {});
    }

    return { assignment: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { assignment: null, error };
  }
}

/**
 * Mentor updates assignment metadata.
 */
export async function updateAssignment(
  assignmentId: string,
  updates: Partial<Pick<Assignment, 'title' | 'instructions' | 'subject_id' | 'plan_id' | 'due_date' | 'total_points' | 'status'>>
): Promise<{ assignment: Assignment | null; error: Error | null }> {
  if (!assignmentId) {
    return { assignment: null, error: new Error('Assignment ID is required.') };
  }

  if (updates.title !== undefined && !updates.title.trim()) {
    return { assignment: null, error: new Error('Assignment title cannot be empty.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockAssignment(assignmentId, updates);
  }

  try {
    const updatePayload: AssignmentUpdate = {
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : undefined,
      instructions: updates.instructions !== undefined ? (updates.instructions ? updates.instructions.trim() : null) : undefined,
    };

    const { data, error } = await supabase
      .from('assignments')
      .update(updatePayload)
      .eq('id', assignmentId)
      .select()
      .single();

    if (error) {
      return { assignment: null, error };
    }

    return { assignment: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { assignment: null, error };
  }
}

/**
 * Mentor deletes an assignment. Cascades to submissions.
 */
export async function deleteAssignment(assignmentId: string): Promise<{ success: boolean; error: Error | null }> {
  if (!assignmentId) {
    return { success: false, error: new Error('Assignment ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockAssignment(assignmentId);
  }

  try {
    const { error } = await supabase
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

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
 * Student submits work for an assignment.
 * Upserts to prevent duplicate submissions on double-clicks.
 */
export async function submitAssignment(params: {
  assignmentId: string;
  studentId: string;
  submissionType: SubmissionType;
  content: string;
  linkUrl?: string;
  fileName?: string;
  fileSize?: number;
}): Promise<{ submission: Submission | null; error: Error | null }> {
  const cleanContent = params.content.trim();
  if (!cleanContent) {
    return { submission: null, error: new Error('Submission content cannot be empty.') };
  }
  if (!params.assignmentId) {
    return { submission: null, error: new Error('Assignment ID is required.') };
  }
  if (!params.studentId) {
    return { submission: null, error: new Error('Student ID is required.') };
  }

  if (params.submissionType === 'link') {
    const url = params.linkUrl?.trim() || cleanContent;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { submission: null, error: new Error('External link must start with http:// or https://') };
    }
  }

  if (!isSupabaseConfigured()) {
    return submitMockAssignment(params);
  }

  try {
    const now = new Date().toISOString();
    const payload = {
      assignment_id: params.assignmentId,
      student_id: params.studentId,
      submission_type: params.submissionType,
      content: cleanContent,
      link_url: params.linkUrl?.trim() || (params.submissionType === 'link' ? cleanContent : null),
      file_name: params.fileName || null,
      file_size: params.fileSize || null,
      status: 'submitted' as SubmissionStatus,
      submitted_at: now,
      updated_at: now,
    };

    // Use upsert on unique constraint (assignment_id, student_id)
    const { data, error } = await supabase
      .from('submissions')
      .upsert(payload, { onConflict: 'assignment_id,student_id' })
      .select()
      .single();

    if (error) {
      return { submission: null, error };
    }

    return { submission: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { submission: null, error };
  }
}

/**
 * Mentor marks submission status (e.g. 'under_review' or 'reviewed').
 */
export async function updateSubmissionStatus(
  submissionId: string,
  status: SubmissionStatus
): Promise<{ submission: Submission | null; error: Error | null }> {
  if (!submissionId) {
    return { submission: null, error: new Error('Submission ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockSubmissionStatus(submissionId, status);
  }

  try {
    const { data, error } = await supabase
      .from('submissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      return { submission: null, error };
    }

    return { submission: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { submission: null, error };
  }
}

/**
 * Mentor reviews a submission: saves feedback, optional score, reviewer, and timestamp.
 */
export async function reviewSubmission(params: {
  submissionId: string;
  mentorId: string;
  status: SubmissionStatus;
  feedback: string;
  score?: number | null;
}): Promise<{ submission: Submission | null; error: Error | null }> {
  if (!params.submissionId) {
    return { submission: null, error: new Error('Submission ID is required.') };
  }
  const cleanFeedback = params.feedback.trim();
  if (!cleanFeedback) {
    return { submission: null, error: new Error('Feedback comments are required.') };
  }

  if (!isSupabaseConfigured()) {
    return reviewMockSubmission(params);
  }

  try {
    const now = new Date().toISOString();
    const payload = {
      status: params.status || 'reviewed',
      feedback: cleanFeedback,
      score: params.score !== undefined ? params.score : null,
      reviewed_by: params.mentorId,
      reviewed_at: now,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from('submissions')
      .update(payload)
      .eq('id', params.submissionId)
      .select()
      .single();

    if (error) {
      return { submission: null, error };
    }

    if (data?.student_id) {
      createNotification({
        recipientId: data.student_id,
        actorId: params.mentorId,
        type: 'submission_reviewed',
        title: 'Submission Reviewed',
        message: `Mentor reviewed your assignment submission${params.score !== undefined && params.score !== null ? ` — Score: ${params.score}` : ''}`,
        link: '/student/assignments',
        idempotencyKey: `submission_review:${params.submissionId}`,
      }).catch(() => {});
    }

    return { submission: data, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { submission: null, error };
  }
}

/**
 * Mentor queries all submissions across assigned students (Review Queue).
 */
export async function getMentorReviewQueue(mentorId: string): Promise<{
  submissions: SubmissionWithMeta[];
  error: Error | null;
}> {
  if (!mentorId) {
    return { submissions: [], error: new Error('Mentor ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockMentorSubmissions(mentorId);
    return { submissions: list as SubmissionWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('*, assignments(title, total_points, subjects(name)), profiles!student_id(full_name, poraplan_id)')
      .order('submitted_at', { ascending: false });

    if (error) {
      return { submissions: [], error };
    }

    const submissions: SubmissionWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      assignment_id: row.assignment_id,
      student_id: row.student_id,
      submission_type: row.submission_type,
      content: row.content,
      link_url: row.link_url,
      file_name: row.file_name,
      file_size: row.file_size,
      status: row.status,
      feedback: row.feedback,
      score: row.score,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      submitted_at: row.submitted_at,
      updated_at: row.updated_at,
      assignment_title: row.assignments?.title || 'Assignment',
      assignment_total_points: row.assignments?.total_points || 100,
      subject_name: row.assignments?.subjects?.name || undefined,
      student_name: row.profiles?.full_name || 'Scholar',
      student_poraplan_id: row.profiles?.poraplan_id || undefined,
    }));

    return { submissions, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { submissions: [], error };
  }
}
