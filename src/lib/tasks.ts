import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  TaskPriority,
  TaskStatus,
  Subject,
  StudyPlan,
} from '../types/database';
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

/**
 * Fetch all tasks for a given student ID.
 * Handled via RLS on Supabase:
 * - Students can only query their own student_id.
 * - Mentors can only query student_ids of students assigned to them.
 */
export async function getStudentTasks(studentId: string, programId?: string): Promise<{
  tasks: TaskWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { tasks: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    let list = getMockStudentTasks(studentId);
    if (programId && programId !== 'all') {
      list = list.filter((t) => !t.program_id || t.program_id === programId);
    }
    return { tasks: list as TaskWithMeta[], error: null };
  }

  try {
    let query = supabase
      .from('tasks')
      .select('*, subjects(*), study_plans(*)')
      .eq('student_id', studentId);

    if (programId && programId !== 'all') {
      query = query.eq('program_id', programId);
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
  updates: Partial<Pick<Task, 'title' | 'description' | 'subject_id' | 'plan_id' | 'priority' | 'status' | 'due_date' | 'estimated_minutes' | 'completed_at' | 'attachment_path' | 'attachment_name' | 'attachment_size'>>
): Promise<{
  task: Task | null;
  error: Error | null;
}> {
  if (!taskId) {
    return { task: null, error: new Error('Task ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockTask(taskId, updates);
  }

  try {
    const payload: TaskUpdate = {};
    if (updates.title !== undefined) {
      const cleanTitle = updates.title.trim();
      if (!cleanTitle) {
        return { task: null, error: new Error('Task title cannot be empty.') };
      }
      payload.title = cleanTitle;
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

    const { data, error } = await supabase
      .from('tasks')
      .update(payload)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      return { task: null, error };
    }

    return { task: data as Task, error: null };
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
