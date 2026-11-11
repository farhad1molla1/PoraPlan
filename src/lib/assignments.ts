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
  DEFAULT_PAGE,
  type PaginationMeta,
  type PaginationParams,
} from '../types/pagination';
import {
  calculatePaginationRange,
  createPaginationMeta,
} from './pagination';
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
  processMockAssignmentDeadlineReminders,
  parseDhakaDeadline,
  calculateReminderSchedule,
} from './mockAuthStore';
import { createNotification } from './notifications';

export const DEFAULT_ASSIGNMENTS_PAGE_SIZE = 15;

export interface StudentAssignmentsPaginatedParams extends PaginationParams {
  studentId: string;
  statusFilter?: 'all' | 'pending' | 'submitted' | 'reviewed';
  programId?: string;
  search?: string;
}

export interface StudentAssignmentsPaginatedResult {
  assignments: AssignmentWithMeta[];
  pagination: PaginationMeta;
  error: Error | null;
}

export interface StudentAssignmentStatusCounts {
  total: number;
  pending: number;
  submitted: number;
  reviewed: number;
  error: Error | null;
}

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
export async function getStudentAssignments(studentId: string, programId?: string): Promise<{
  assignments: AssignmentWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { assignments: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    let list = getMockStudentAssignments(studentId);
    if (programId && programId !== 'all') {
      list = list.filter((a) => !a.program_id || a.program_id === programId);
    }
    return { assignments: list as AssignmentWithMeta[], error: null };
  }

  try {
    let query = supabase
      .from('assignments')
      .select('*, subjects(*), study_plans(*), submissions(*)')
      .eq('student_id', studentId);

    if (programId && programId !== 'all') {
      query = query.eq('program_id', programId);
    }

    const { data, error } = await query
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
 * Lightweight count of assignments assigned to a student.
 */
export async function getStudentAssignmentsCount(
  studentId: string
): Promise<{ count: number; error: Error | null }> {
  if (!studentId) {
    return { count: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentAssignments(studentId);
    return { count: list.length, error: null };
  }

  try {
    const { count, error } = await supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);

    if (error) {
      return { count: 0, error };
    }

    return { count: count ?? 0, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { count: 0, error };
  }
}

/**
 * Fetch assignments for a student with server-side pagination, status filtering, and search.
 * Enforces deterministic sorting with an id tie-breaker.
 */
export async function getStudentAssignmentsPaginated(
  params: StudentAssignmentsPaginatedParams
): Promise<StudentAssignmentsPaginatedResult> {
  const {
    studentId,
    page = DEFAULT_PAGE,
    pageSize = DEFAULT_ASSIGNMENTS_PAGE_SIZE,
    statusFilter = 'all',
    programId,
    search,
  } = params;

  if (!studentId) {
    const emptyMeta = createPaginationMeta({ page, pageSize, totalCount: 0 });
    return { assignments: [], pagination: emptyMeta, error: new Error('Student ID is required.') };
  }

  const range = calculatePaginationRange({ page, pageSize });

  if (!isSupabaseConfigured()) {
    let list = getMockStudentAssignments(studentId) as AssignmentWithMeta[];
    if (programId && programId !== 'all') {
      list = list.filter((a) => !a.program_id || a.program_id === programId);
    }
    if (statusFilter === 'pending') {
      list = list.filter((a) => !a.submission);
    } else if (statusFilter === 'submitted') {
      list = list.filter((a) => a.submission && a.submission.status === 'submitted');
    } else if (statusFilter === 'reviewed') {
      list = list.filter(
        (a) =>
          a.submission &&
          (a.submission.status === 'reviewed' || a.submission.status === 'under_review')
      );
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) => a.title.toLowerCase().includes(q) || a.subject_name?.toLowerCase().includes(q)
      );
    }
    const totalCount = list.length;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
      clampToTotal: true,
    });
    const actualFrom = (pagination.page - 1) * pagination.pageSize;
    const paginatedData = list.slice(actualFrom, actualFrom + pagination.pageSize);
    return { assignments: paginatedData, pagination, error: null };
  }

  try {
    let assignmentQuery = supabase
      .from('assignments')
      .select('*, subjects(*), study_plans(*), submissions(*)', { count: 'exact' })
      .eq('student_id', studentId);

    if (programId && programId !== 'all') {
      assignmentQuery = assignmentQuery.eq('program_id', programId);
    }

    if (search && search.trim()) {
      assignmentQuery = assignmentQuery.ilike('title', `%${search.trim()}%`);
    }

    // Apply status filter via student's submission relations
    if (statusFilter === 'submitted') {
      const { data: subs, error: subErr } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', studentId)
        .eq('status', 'submitted');

      if (subErr) {
        const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
        return { assignments: [], pagination: emptyMeta, error: subErr };
      }
      const ids = (subs || []).map((s) => s.assignment_id);
      if (ids.length === 0) {
        const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
        return { assignments: [], pagination: emptyMeta, error: null };
      }
      assignmentQuery = assignmentQuery.in('id', ids);
    } else if (statusFilter === 'reviewed') {
      const { data: subs, error: subErr } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', studentId)
        .in('status', ['reviewed', 'under_review']);

      if (subErr) {
        const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
        return { assignments: [], pagination: emptyMeta, error: subErr };
      }
      const ids = (subs || []).map((s) => s.assignment_id);
      if (ids.length === 0) {
        const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
        return { assignments: [], pagination: emptyMeta, error: null };
      }
      assignmentQuery = assignmentQuery.in('id', ids);
    } else if (statusFilter === 'pending') {
      const { data: subs, error: subErr } = await supabase
        .from('submissions')
        .select('assignment_id')
        .eq('student_id', studentId);

      if (subErr) {
        const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
        return { assignments: [], pagination: emptyMeta, error: subErr };
      }
      const submittedIds = (subs || []).map((s) => s.assignment_id);
      if (submittedIds.length > 0) {
        assignmentQuery = assignmentQuery.not('id', 'in', `(${submittedIds.join(',')})`);
      }
    }

    // Stable deterministic sorting with id tie-breaker
    const { data, count, error } = await assignmentQuery
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    if (error) {
      const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
      return { assignments: [], pagination: emptyMeta, error };
    }

    const totalCount = count ?? 0;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
      clampToTotal: true,
    });

    const assignments: AssignmentWithMeta[] = (data || []).map((row: any) => {
      const submissionsList = Array.isArray(row.submissions)
        ? row.submissions
        : row.submissions
        ? [row.submissions]
        : [];
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
        submission,
      };
    });

    return { assignments, pagination, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
    return { assignments: [], pagination: emptyMeta, error };
  }
}

/**
 * Lightweight server-side status counters for Student Assignments tab badges and metrics.
 * Executes parallel HEAD requests without downloading full data records.
 */
export async function getStudentAssignmentStatusCounts(
  studentId: string,
  programId?: string
): Promise<StudentAssignmentStatusCounts> {
  if (!studentId) {
    return { total: 0, pending: 0, submitted: 0, reviewed: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const all = getMockStudentAssignments(studentId);
    const filtered =
      programId && programId !== 'all'
        ? all.filter((a) => !a.program_id || a.program_id === programId)
        : all;
    const submitted = filtered.filter((a) => a.submission && a.submission.status === 'submitted').length;
    const reviewed = filtered.filter(
      (a) =>
        a.submission &&
        (a.submission.status === 'reviewed' || a.submission.status === 'under_review')
    ).length;
    const pending = filtered.filter((a) => !a.submission).length;
    return {
      total: filtered.length,
      pending,
      submitted,
      reviewed,
      error: null,
    };
  }

  try {
    let totalQ = supabase
      .from('assignments')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId);
    if (programId && programId !== 'all') {
      totalQ = totalQ.eq('program_id', programId);
    }

    const [totalRes, submittedRes, reviewedRes] = await Promise.all([
      totalQ,
      supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .eq('status', 'submitted'),
      supabase
        .from('submissions')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .in('status', ['reviewed', 'under_review']),
    ]);

    const error = totalRes.error || submittedRes.error || reviewedRes.error;
    if (error) {
      return { total: 0, pending: 0, submitted: 0, reviewed: 0, error };
    }

    const total = totalRes.count ?? 0;
    const submitted = submittedRes.count ?? 0;
    const reviewed = reviewedRes.count ?? 0;
    const pending = Math.max(0, total - (submitted + reviewed));

    return {
      total,
      pending,
      submitted,
      reviewed,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { total: 0, pending: 0, submitted: 0, reviewed: 0, error };
  }
}

/**
 * Bounded query for Student Dashboard home screen preview.
 * Retrieves only top unsubmitted assignments (maximum 3) and exact status counts.
 */
export async function getStudentDashboardAssignmentsPreview(
  studentId: string,
  limit = 3
): Promise<{
  assignments: AssignmentWithMeta[];
  totalCount: number;
  pendingCount: number;
  submittedCount: number;
  error: Error | null;
}> {
  if (!studentId) {
    return { assignments: [], totalCount: 0, pendingCount: 0, submittedCount: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentAssignments(studentId) as AssignmentWithMeta[];
    const pending = list.filter((a) => !a.submission);
    const submitted = list.filter((a) => Boolean(a.submission));
    const preview = pending.slice(0, limit);
    return {
      assignments: preview,
      totalCount: list.length,
      pendingCount: pending.length,
      submittedCount: submitted.length,
      error: null,
    };
  }

  try {
    const [counts, subsRes] = await Promise.all([
      getStudentAssignmentStatusCounts(studentId),
      supabase.from('submissions').select('assignment_id').eq('student_id', studentId),
    ]);

    if (counts.error) {
      return { assignments: [], totalCount: 0, pendingCount: 0, submittedCount: 0, error: counts.error };
    }

    let query = supabase
      .from('assignments')
      .select('*, subjects(*), study_plans(*), submissions(*)')
      .eq('student_id', studentId);

    const submittedIds = (subsRes.data || []).map((s) => s.assignment_id);
    if (submittedIds.length > 0) {
      query = query.not('id', 'in', `(${submittedIds.join(',')})`);
    }

    const { data, error } = await query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .limit(limit);

    if (error) {
      return { assignments: [], totalCount: counts.total, pendingCount: counts.pending, submittedCount: counts.submitted, error };
    }

    const assignments: AssignmentWithMeta[] = (data || []).map((row: any) => ({
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
      submission: null,
    }));

    return {
      assignments,
      totalCount: counts.total,
      pendingCount: counts.pending,
      submittedCount: counts.submitted,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { assignments: [], totalCount: 0, pendingCount: 0, submittedCount: 0, error };
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
  programId?: string;
  cohortId?: string;
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
      program_id: params.programId || null,
      cohort_id: params.cohortId || null,
      subject_id: params.subjectId || null,
      plan_id: params.planId || null,
      title: cleanTitle,
      instructions: params.instructions?.trim() || null,
      due_date: params.dueDate || null,
      total_points: params.totalPoints !== undefined ? params.totalPoints : 100,
      status: params.status || 'published',
      published_at: (params.status || 'published') === 'published' ? new Date().toISOString() : null,
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
  updates: Partial<Pick<Assignment, 'title' | 'instructions' | 'subject_id' | 'plan_id' | 'due_date' | 'total_points' | 'status'>>,
  updaterId?: string
): Promise<{ assignment: Assignment | null; error: Error | null }> {
  if (!assignmentId) {
    return { assignment: null, error: new Error('Assignment ID is required.') };
  }

  if (updates.title !== undefined && !updates.title.trim()) {
    return { assignment: null, error: new Error('Assignment title cannot be empty.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockAssignment(assignmentId, updates, updaterId);
  }

  try {
    // 1. Fetch current assignment to check existing state and student ownership
    const { data: currentAssignment, error: fetchError } = await supabase
      .from('assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();

    if (fetchError || !currentAssignment) {
      return { assignment: null, error: fetchError || new Error('Assignment not found.') };
    }

    // 2. Pre-mutation lifecycle and change detection
    const nextStatus = updates.status !== undefined ? updates.status : currentAssignment.status;
    const isPublishingDraft = currentAssignment.status === 'draft' && nextStatus === 'published';
    const isPublishedUpdate = currentAssignment.status === 'published' && nextStatus === 'published';

    let hasMeaningfulChange = false;

    // 1. title
    if (updates.title !== undefined && updates.title.trim() !== currentAssignment.title) {
      hasMeaningfulChange = true;
    }

    // 2. due_date
    if (updates.due_date !== undefined) {
      const newDue = updates.due_date ? (updates.due_date.includes('T') ? updates.due_date.split('T')[0] : updates.due_date.trim()) : null;
      const oldDue = currentAssignment.due_date ? (currentAssignment.due_date.includes('T') ? currentAssignment.due_date.split('T')[0] : currentAssignment.due_date.trim()) : null;
      if (newDue !== oldDue) {
        hasMeaningfulChange = true;
      }
    }

    // 3. instructions
    if (updates.instructions !== undefined) {
      const newInst = updates.instructions?.trim() || null;
      const oldInst = currentAssignment.instructions ? currentAssignment.instructions.trim() || null : null;
      if (newInst !== oldInst) {
        hasMeaningfulChange = true;
      }
    }

    const updatePayload: AssignmentUpdate = {
      ...updates,
      title: updates.title !== undefined ? updates.title.trim() : undefined,
      instructions: updates.instructions !== undefined ? (updates.instructions ? updates.instructions.trim() : null) : undefined,
      updated_at: new Date().toISOString(),
      published_at: isPublishingDraft && !currentAssignment.published_at ? new Date().toISOString() : undefined,
    };

    const { data: updatedAssignment, error: updateError } = await supabase
      .from('assignments')
      .update(updatePayload)
      .eq('id', assignmentId)
      .select()
      .single();

    if (updateError || !updatedAssignment) {
      return { assignment: null, error: updateError || new Error('Failed to update assignment.') };
    }

    // 3. Resolve actor and dispatch notifications
    let effectiveActorId = updaterId;
    if (!effectiveActorId) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveActorId = authData.user?.id || currentAssignment.mentor_id || undefined;
    }

    if (effectiveActorId && effectiveActorId !== currentAssignment.student_id) {
      if (isPublishingDraft) {
        // Trigger A: Draft published
        createNotification({
          recipientId: currentAssignment.student_id,
          actorId: effectiveActorId,
          type: 'assignment_created',
          title: 'New Assignment Published',
          message: `A new assignment has been published: "${updatedAssignment.title}".`,
          link: '/student/assignments',
          idempotencyKey: `assignment:${assignmentId}`,
        }).catch(() => {});
      } else if (isPublishedUpdate && hasMeaningfulChange) {
        // Trigger B: Published assignment metadata update
        createNotification({
          recipientId: currentAssignment.student_id,
          actorId: effectiveActorId,
          type: 'assignment_updated',
          title: 'Assignment Updated',
          message: `Mentor updated assignment "${updatedAssignment.title}".`,
          link: '/student/assignments',
          idempotencyKey: `assignment_update:${assignmentId}:${updatedAssignment.updated_at}`,
        }).catch(() => {});
      }
    }

    return { assignment: updatedAssignment, error: null };
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
  filePath?: string;
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
      file_path: params.filePath || null,
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

    try {
      const { data: asg } = await supabase
        .from('assignments')
        .select('mentor_id, title')
        .eq('id', params.assignmentId)
        .single();
      if (asg?.mentor_id) {
        createNotification({
          recipientId: asg.mentor_id,
          actorId: params.studentId,
          type: 'submission_created',
          title: 'New Student Submission',
          message: `Work submitted for "${asg.title}"`,
          link: '/mentor/reviews',
          idempotencyKey: `submission:${data.id}:${data.submitted_at || now}`,
        }).catch(() => {});
      }
    } catch {}

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
        idempotencyKey: `submission_review:${data.id}:${data.submitted_at || params.submissionId}`,
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
      file_path: row.file_path || null,
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


export { parseDhakaDeadline, calculateReminderSchedule };

/**
 * Server-side / Mock dispatcher for assignment deadline reminders.
 * When Supabase is configured, invokes the secure database function `process_assignment_deadline_reminders`.
 * In mock / demo mode, delegates to deterministic mock simulation.
 */
export async function processAssignmentDeadlineReminders(currentTime?: Date | string): Promise<{
  processedCount: number;
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const result = processMockAssignmentDeadlineReminders(currentTime);
    return { processedCount: result.processedCount, error: null };
  }

  try {
    const { data, error } = await supabase.rpc('process_assignment_deadline_reminders');
    if (error) {
      return { processedCount: 0, error };
    }
    return { processedCount: typeof data === 'number' ? data : 0, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { processedCount: 0, error };
  }
}
