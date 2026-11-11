import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  TaskPriority,
  TaskStatus,
  StudentTaskFilters,
  Subject,
  StudyPlan,
} from '../types/database';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  type PaginationMeta,
  type PaginationParams,
} from '../types/pagination';
import {
  calculatePaginationRange,
  createPaginationMeta,
} from './pagination';

export type { StudentTaskFilters };
export { DEFAULT_PAGE, DEFAULT_PAGE_SIZE };
import {
  getMockStudentTasks,
  getMockTaskById,
  createMockTask,
  updateMockTask,
  deleteMockTask,
} from './mockAuthStore';
import { createNotification } from './notifications';

export type TaskWithMeta = Task & {
  subject_name?: string;
  plan_title?: string;
  subject?: Subject | null;
  plan?: StudyPlan | null;
};

export interface StudentTasksPaginatedParams extends PaginationParams {
  studentId: string;
  filters?: StudentTaskFilters;
  search?: string;
}

export interface StudentTasksPaginatedResult {
  tasks: TaskWithMeta[];
  pagination: PaginationMeta;
  error: Error | null;
}

export interface StudentTaskStatusCounts {
  all: number;
  pending: number;
  in_progress: number;
  completed: number;
  error: Error | null;
}

/**
 * Fetch all tasks for a given student ID with optional filters:
 * - startDate / endDate: filters by scheduled task due_date (inclusive)
 * - subjectId: filters by associated subject
 * - status: filters by current status ('pending', 'in_progress', 'completed')
 * - programId: filters by program
 *
 * Handled via RLS on Supabase:
 * - Students can only query their own student_id.
 * - Mentors can only query student_ids of students assigned to them.
 */
export async function getStudentTasks(
  studentId: string,
  programIdOrFilters?: string | StudentTaskFilters,
  optionalFilters?: StudentTaskFilters
): Promise<{
  tasks: TaskWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { tasks: [], error: new Error('Student ID is required.') };
  }

  const filters: StudentTaskFilters =
    typeof programIdOrFilters === 'string'
      ? { programId: programIdOrFilters, ...(optionalFilters || {}) }
      : programIdOrFilters || {};

  if (!isSupabaseConfigured()) {
    const list = getMockStudentTasks(studentId, filters);
    return { tasks: list as TaskWithMeta[], error: null };
  }

  try {
    let query = supabase
      .from('tasks')
      .select('*, subjects(*), study_plans(*)')
      .eq('student_id', studentId);

    if (filters.programId && filters.programId !== 'all') {
      query = query.eq('program_id', filters.programId);
    }

    if (filters.subjectId && filters.subjectId !== 'all') {
      query = query.eq('subject_id', filters.subjectId);
    }

    if (filters.status && (filters.status as string) !== 'all') {
      query = query.eq('status', filters.status);
    }

    // Scheduled task date filtering based on due_date (inclusive)
    if (filters.startDate) {
      const cleanStart = filters.startDate.includes('T')
        ? filters.startDate.split('T')[0]
        : filters.startDate.trim();
      query = query.gte('due_date', cleanStart);
    }

    if (filters.endDate) {
      const cleanEnd = filters.endDate.includes('T')
        ? filters.endDate.split('T')[0]
        : filters.endDate.trim();
      query = query.lte('due_date', cleanEnd);
    }

    const { data, error } = await query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      return { tasks: [], error };
    }

    const tasks: TaskWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      created_by: row.created_by,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      estimated_minutes: row.estimated_minutes,
      completed_at: row.completed_at,
      attachment_path: row.attachment_path || null,
      attachment_name: row.attachment_name || null,
      attachment_size: row.attachment_size || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject: row.subjects || null,
      subject_name: row.subjects?.name || undefined,
      plan: row.study_plans || null,
      plan_title: row.study_plans?.title || undefined,
    }));

    return { tasks, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { tasks: [], error };
  }
}

/**
 * Lightweight count of tasks assigned to a student.
 */
export async function getStudentTasksCount(
  studentId: string
): Promise<{ count: number; error: Error | null }> {
  if (!studentId) {
    return { count: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentTasks(studentId);
    return { count: list.length, error: null };
  }

  try {
    const { count, error } = await supabase
      .from('tasks')
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
 * Fetch tasks for a student with server-side pagination, status filtering, and search.
 * Enforces deterministic sorting with an id tie-breaker.
 */
export async function getStudentTasksPaginated(
  params: StudentTasksPaginatedParams
): Promise<StudentTasksPaginatedResult> {
  const { studentId, page = DEFAULT_PAGE, pageSize = DEFAULT_PAGE_SIZE, filters = {}, search } = params;

  if (!studentId) {
    const emptyMeta = createPaginationMeta({ page, pageSize, totalCount: 0 });
    return { tasks: [], pagination: emptyMeta, error: new Error('Student ID is required.') };
  }

  const range = calculatePaginationRange({ page, pageSize });

  if (!isSupabaseConfigured()) {
    let list = getMockStudentTasks(studentId, filters) as TaskWithMeta[];
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.subject_name?.toLowerCase().includes(q)
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
    return { tasks: paginatedData, pagination, error: null };
  }

  try {
    let query = supabase
      .from('tasks')
      .select('*, subjects(*), study_plans(*)', { count: 'exact' })
      .eq('student_id', studentId);

    if (filters.programId && filters.programId !== 'all') {
      query = query.eq('program_id', filters.programId);
    }

    if (filters.subjectId && filters.subjectId !== 'all') {
      query = query.eq('subject_id', filters.subjectId);
    }

    if (filters.status && (filters.status as string) !== 'all') {
      query = query.eq('status', filters.status);
    }

    if (filters.startDate) {
      const cleanStart = filters.startDate.includes('T')
        ? filters.startDate.split('T')[0]
        : filters.startDate.trim();
      query = query.gte('due_date', cleanStart);
    }

    if (filters.endDate) {
      const cleanEnd = filters.endDate.includes('T')
        ? filters.endDate.split('T')[0]
        : filters.endDate.trim();
      query = query.lte('due_date', cleanEnd);
    }

    if (search && search.trim()) {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    // Stable deterministic sorting with id tie-breaker
    const { data, count, error } = await query
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    if (error) {
      const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
      return { tasks: [], pagination: emptyMeta, error };
    }

    const totalCount = count ?? 0;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
      clampToTotal: true,
    });

    const tasks: TaskWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      created_by: row.created_by,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      estimated_minutes: row.estimated_minutes,
      completed_at: row.completed_at,
      attachment_path: row.attachment_path || null,
      attachment_name: row.attachment_name || null,
      attachment_size: row.attachment_size || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject: row.subjects || null,
      subject_name: row.subjects?.name || undefined,
      plan: row.study_plans || null,
      plan_title: row.study_plans?.title || undefined,
    }));

    return { tasks, pagination, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const emptyMeta = createPaginationMeta({ page: range.page, pageSize: range.pageSize, totalCount: 0 });
    return { tasks: [], pagination: emptyMeta, error };
  }
}

/**
 * Lightweight server-side status counters for Student Tasks tab badges.
 * Executes parallel HEAD requests without downloading full data records.
 */
export async function getStudentTaskStatusCounts(
  studentId: string,
  programId?: string
): Promise<StudentTaskStatusCounts> {
  if (!studentId) {
    return { all: 0, pending: 0, in_progress: 0, completed: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const allTasks = getMockStudentTasks(studentId);
    const filtered =
      programId && programId !== 'all' ? allTasks.filter((t) => t.program_id === programId) : allTasks;
    return {
      all: filtered.length,
      pending: filtered.filter((t) => t.status === 'pending').length,
      in_progress: filtered.filter((t) => t.status === 'in_progress').length,
      completed: filtered.filter((t) => t.status === 'completed').length,
      error: null,
    };
  }

  try {
    const buildCountQuery = (status?: TaskStatus) => {
      let q = supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId);
      if (programId && programId !== 'all') {
        q = q.eq('program_id', programId);
      }
      if (status) {
        q = q.eq('status', status);
      }
      return q;
    };

    const [allRes, pendingRes, inProgressRes, completedRes] = await Promise.all([
      buildCountQuery(),
      buildCountQuery('pending'),
      buildCountQuery('in_progress'),
      buildCountQuery('completed'),
    ]);

    const error = allRes.error || pendingRes.error || inProgressRes.error || completedRes.error;
    if (error) {
      return { all: 0, pending: 0, in_progress: 0, completed: 0, error };
    }

    return {
      all: allRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      in_progress: inProgressRes.count ?? 0,
      completed: completedRes.count ?? 0,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { all: 0, pending: 0, in_progress: 0, completed: 0, error };
  }
}

/**
 * Bounded query for Student Dashboard home screen preview.
 * Retrieves only the top tasks (maximum 5) and exact overall workload counts.
 */
export async function getStudentDashboardTasksPreview(
  studentId: string,
  limit = 5
): Promise<{
  tasks: TaskWithMeta[];
  totalCount: number;
  pendingCount: number;
  completedCount: number;
  error: Error | null;
}> {
  if (!studentId) {
    return { tasks: [], totalCount: 0, pendingCount: 0, completedCount: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const mockList = getMockStudentTasks(studentId) as TaskWithMeta[];
    const pending = mockList.filter((t) => t.status !== 'completed');
    const completed = mockList.filter((t) => t.status === 'completed');
    const preview = pending.length > 0 ? pending.slice(0, limit) : mockList.slice(0, limit);
    return {
      tasks: preview,
      totalCount: mockList.length,
      pendingCount: pending.length,
      completedCount: completed.length,
      error: null,
    };
  }

  try {
    const [counts, previewRes] = await Promise.all([
      getStudentTaskStatusCounts(studentId),
      supabase
        .from('tasks')
        .select('*, subjects(*), study_plans(*)')
        .eq('student_id', studentId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(limit),
    ]);

    if (previewRes.error) {
      return { tasks: [], totalCount: 0, pendingCount: 0, completedCount: 0, error: previewRes.error };
    }

    const tasks: TaskWithMeta[] = (previewRes.data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      created_by: row.created_by,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      title: row.title,
      description: row.description,
      priority: row.priority,
      status: row.status,
      due_date: row.due_date,
      estimated_minutes: row.estimated_minutes,
      completed_at: row.completed_at,
      attachment_path: row.attachment_path || null,
      attachment_name: row.attachment_name || null,
      attachment_size: row.attachment_size || null,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject: row.subjects || null,
      subject_name: row.subjects?.name || undefined,
      plan: row.study_plans || null,
      plan_title: row.study_plans?.title || undefined,
    }));

    return {
      tasks,
      totalCount: counts.all,
      pendingCount: counts.pending + counts.in_progress,
      completedCount: counts.completed,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { tasks: [], totalCount: 0, pendingCount: 0, completedCount: 0, error };
  }
}

/**
 * Fetch a single task by ID.
 */
export async function getTaskById(taskId: string): Promise<{
  task: Task | null;
  subject: Subject | null;
  plan: StudyPlan | null;
  error: Error | null;
}> {
  if (!taskId) {
    return { task: null, subject: null, plan: null, error: new Error('Task ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const task = getMockTaskById(taskId);
    if (!task) {
      return { task: null, subject: null, plan: null, error: new Error('Task not found.') };
    }
    return { task, subject: null, plan: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*, subjects(*), study_plans(*)')
      .eq('id', taskId)
      .single();

    if (error || !data) {
      return { task: null, subject: null, plan: null, error: error || new Error('Task not found.') };
    }

    const task: Task = {
      id: data.id,
      student_id: data.student_id,
      created_by: data.created_by,
      subject_id: data.subject_id,
      plan_id: data.plan_id,
      title: data.title,
      description: data.description,
      priority: data.priority,
      status: data.status,
      due_date: data.due_date,
      estimated_minutes: data.estimated_minutes,
      completed_at: data.completed_at,
      attachment_path: data.attachment_path || null,
      attachment_name: data.attachment_name || null,
      attachment_size: data.attachment_size || null,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return {
      task,
      subject: (data as any).subjects || null,
      plan: (data as any).study_plans || null,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { task: null, subject: null, plan: null, error };
  }
}

/**
 * Create a new task for a student.
 * Mentors may create tasks only for their assigned students.
 */
export async function createTask(params: {
  studentId: string;
  createdBy?: string;
  subjectId?: string;
  planId?: string;
  programId?: string;
  cohortId?: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  estimatedMinutes?: number;
  attachmentPath?: string;
  attachmentName?: string;
  attachmentSize?: number;
}): Promise<{
  task: Task | null;
  error: Error | null;
}> {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { task: null, error: new Error('Task title is required.') };
  }
  if (!params.studentId) {
    return { task: null, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return createMockTask({
      studentId: params.studentId,
      createdBy: params.createdBy,
      subjectId: params.subjectId,
      planId: params.planId,
      programId: params.programId,
      cohortId: params.cohortId,
      title: cleanTitle,
      description: params.description,
      priority: params.priority,
      dueDate: params.dueDate,
      estimatedMinutes: params.estimatedMinutes,
      attachmentPath: params.attachmentPath,
      attachmentName: params.attachmentName,
      attachmentSize: params.attachmentSize,
    });
  }

  try {
    const payload: TaskInsert = {
      student_id: params.studentId,
      created_by: params.createdBy || null,
      program_id: params.programId || null,
      cohort_id: params.cohortId || null,
      subject_id: params.subjectId || null,
      plan_id: params.planId || null,
      title: cleanTitle,
      description: params.description?.trim() || null,
      priority: params.priority || 'medium',
      status: 'pending',
      due_date: params.dueDate || null,
      estimated_minutes: params.estimatedMinutes && params.estimatedMinutes > 0 ? params.estimatedMinutes : null,
      completed_at: null,
      attachment_path: params.attachmentPath || null,
      attachment_name: params.attachmentName || null,
      attachment_size: params.attachmentSize || null,
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { task: null, error };
    }

    if (params.createdBy && params.createdBy !== params.studentId) {
      createNotification({
        recipientId: params.studentId,
        actorId: params.createdBy,
        type: 'task_created',
        title: 'New Task Assigned',
        message: `Mentor assigned task "${cleanTitle}"`,
        link: '/student/tasks',
        idempotencyKey: `task:${data.id}`,
      }).catch(() => {});
    }

    return { task: data as Task, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { task: null, error };
  }
}

/**
 * Update an existing task.
 */
export async function updateTask(
  taskId: string,
  updates: Partial<Pick<Task, 'title' | 'description' | 'subject_id' | 'plan_id' | 'priority' | 'status' | 'due_date' | 'estimated_minutes' | 'completed_at' | 'attachment_path' | 'attachment_name' | 'attachment_size'>>,
  updaterId?: string
): Promise<{
  task: Task | null;
  error: Error | null;
}> {
  if (!taskId) {
    return { task: null, error: new Error('Task ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockTask(taskId, updates, updaterId);
  }

  try {
    // 1. Fetch current task to check previous state and student ownership
    const { data: currentTask, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (fetchError || !currentTask) {
      return { task: null, error: fetchError || new Error('Task not found.') };
    }

    if (updates.title !== undefined) {
      const cleanTitle = updates.title.trim();
      if (!cleanTitle) {
        return { task: null, error: new Error('Task title cannot be empty.') };
      }
    }

    // 2. Meaningful change detection
    // Approved fields: 1. Title, 2. Due date (deadline), 3. Instructions (description)
    // Non-approved: priority, status, completed_at, attachment_*, subject_id, plan_id, estimated_minutes
    let hasMeaningfulChange = false;

    // 1. Title
    if (updates.title !== undefined && updates.title.trim() !== currentTask.title) {
      hasMeaningfulChange = true;
    }

    // 2. Deadline (due_date)
    if (updates.due_date !== undefined) {
      const newDue = updates.due_date ? (updates.due_date.includes('T') ? updates.due_date.split('T')[0] : updates.due_date.trim()) : null;
      const oldDue = currentTask.due_date ? (currentTask.due_date.includes('T') ? currentTask.due_date.split('T')[0] : currentTask.due_date.trim()) : null;
      if (newDue !== oldDue) {
        hasMeaningfulChange = true;
      }
    }

    // 3. Instructions (description)
    if (updates.description !== undefined) {
      const newDesc = updates.description?.trim() || null;
      const oldDesc = currentTask.description ? currentTask.description.trim() || null : null;
      if (newDesc !== oldDesc) {
        hasMeaningfulChange = true;
      }
    }

    const payload: TaskUpdate = {
      updated_at: new Date().toISOString(),
    };
    if (updates.title !== undefined) {
      payload.title = updates.title.trim();
    }
    if (updates.description !== undefined) {
      payload.description = updates.description?.trim() || null;
    }
    if (updates.subject_id !== undefined) {
      payload.subject_id = updates.subject_id || null;
    }
    if (updates.plan_id !== undefined) {
      payload.plan_id = updates.plan_id || null;
    }
    if (updates.priority !== undefined) {
      payload.priority = updates.priority;
    }
    if (updates.status !== undefined) {
      payload.status = updates.status;
      if (updates.status === 'completed') {
        payload.completed_at = updates.completed_at || new Date().toISOString();
      } else {
        payload.completed_at = null;
      }
    }
    if (updates.due_date !== undefined) {
      payload.due_date = updates.due_date || null;
    }
    if (updates.estimated_minutes !== undefined) {
      payload.estimated_minutes = updates.estimated_minutes && updates.estimated_minutes > 0 ? updates.estimated_minutes : null;
    }
    if (updates.completed_at !== undefined) {
      payload.completed_at = updates.completed_at;
    }
    if (updates.attachment_path !== undefined) {
      payload.attachment_path = updates.attachment_path;
    }
    if (updates.attachment_name !== undefined) {
      payload.attachment_name = updates.attachment_name;
    }
    if (updates.attachment_size !== undefined) {
      payload.attachment_size = updates.attachment_size;
    }

    const { data: updatedTask, error: updateError } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .select()
      .single();

    if (updateError || !updatedTask) {
      return { task: null, error: updateError || new Error('Failed to update task.') };
    }

    // 3. Resolve actor and send notification if meaningful change occurred
    let effectiveActorId = updaterId;
    if (!effectiveActorId) {
      const { data: authData } = await supabase.auth.getUser();
      effectiveActorId = authData.user?.id || currentTask.created_by || undefined;
    }

    if (hasMeaningfulChange && effectiveActorId && effectiveActorId !== currentTask.student_id) {
      createNotification({
        recipientId: currentTask.student_id,
        actorId: effectiveActorId,
        type: 'task_updated',
        title: 'Task Updated',
        message: `Mentor updated task "${updatedTask.title}"`,
        link: '/student/tasks',
        idempotencyKey: `task_update:${taskId}:${updatedTask.updated_at}`,
      }).catch(() => {});
    }

    return { task: updatedTask as Task, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { task: null, error };
  }
}

/**
 * Set task status (accessible by students for their own tasks, and mentors/admins).
 */
export async function setTaskStatus(
  taskId: string,
  newStatus: TaskStatus
): Promise<{
  task: Task | null;
  error: Error | null;
}> {
  const completedAt = newStatus === 'completed' ? new Date().toISOString() : null;
  return updateTask(taskId, {
    status: newStatus,
    completed_at: completedAt,
  });
}

/**
 * Delete a task.
 */
export async function deleteTask(taskId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!taskId) {
    return { success: false, error: new Error('Task ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockTask(taskId);
  }

  try {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
