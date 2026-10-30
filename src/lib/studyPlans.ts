import { supabase, isSupabaseConfigured } from './supabase';
import type {
  StudyPlan,
  StudyPlanItem,
  StudyPlanInsert,
  StudyPlanUpdate,
  StudyPlanItemInsert,
  Subject,
} from '../types/database';
import {
  getMockStudentStudyPlans,
  getMockStudyPlanById,
  createMockStudyPlan,
  updateMockStudyPlan,
  deleteMockStudyPlan,
} from './mockAuthStore';
import { createNotification } from './notifications';

export type StudyPlanWithMeta = StudyPlan & {
  items_count: number;
  subject_name?: string;
  subject?: Subject | null;
};

/**
 * Fetch all study plans for a given student ID.
 * Handled via RLS on Supabase:
 * - Students can only query their own student_id.
 * - Mentors can only query student_ids of students assigned to them.
 */
export async function getStudentStudyPlans(studentId: string): Promise<{
  plans: StudyPlanWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { plans: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentStudyPlans(studentId);
    return { plans: list as StudyPlanWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('study_plans')
      .select('*, subjects(*), study_plan_items(id)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      return { plans: [], error };
    }

    const plans: StudyPlanWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      created_by: row.created_by,
      subject_id: row.subject_id,
      title: row.title,
      description: row.description,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject: row.subjects || null,
      subject_name: row.subjects?.name || undefined,
      items_count: Array.isArray(row.study_plan_items) ? row.study_plan_items.length : 0,
    }));

    return { plans, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { plans: [], error };
  }
}

/**
 * Fetch a single study plan by ID with its ordered items and associated subject.
 */
export async function getStudyPlanById(planId: string): Promise<{
  plan: StudyPlan | null;
  items: StudyPlanItem[];
  subject: Subject | null;
  error: Error | null;
}> {
  if (!planId) {
    return { plan: null, items: [], subject: null, error: new Error('Study Plan ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = getMockStudyPlanById(planId);
    return { plan: res.plan, items: res.items, subject: res.subject, error: null };
  }

  try {
    // 1. Fetch parent plan with subject join
    const { data: planData, error: planError } = await supabase
      .from('study_plans')
      .select('*, subjects(*)')
      .eq('id', planId)
      .single();

    if (planError || !planData) {
      return { plan: null, items: [], subject: null, error: planError || new Error('Study plan not found.') };
    }

    // 2. Fetch items ordered by item_order
    const { data: itemsData, error: itemsError } = await supabase
      .from('study_plan_items')
      .select('*')
      .eq('plan_id', planId)
      .order('item_order', { ascending: true });

    if (itemsError) {
      return { plan: null, items: [], subject: null, error: itemsError };
    }

    const plan: StudyPlan = {
      id: planData.id,
      student_id: planData.student_id,
      created_by: planData.created_by,
      subject_id: planData.subject_id,
      title: planData.title,
      description: planData.description,
      status: planData.status,
      created_at: planData.created_at,
      updated_at: planData.updated_at,
    };

    return {
      plan,
      items: (itemsData as StudyPlanItem[]) || [],
      subject: (planData as any).subjects || null,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { plan: null, items: [], subject: null, error };
  }
}

/**
 * Create a new study plan and its ordered items.
 * Authorized for mentors assigned to the target student, and admins.
 */
export async function createStudyPlan(params: {
  studentId: string;
  createdBy?: string;
  subjectId?: string;
  title: string;
  description?: string;
  items?: {
    title: string;
    instructions?: string;
    estimated_minutes?: number;
    target_date?: string;
  }[];
}): Promise<{
  plan: StudyPlan | null;
  items: StudyPlanItem[];
  error: Error | null;
}> {
  const cleanTitle = params.title.trim();
  if (!cleanTitle) {
    return { plan: null, items: [], error: new Error('Study plan title is required.') };
  }
  if (!params.studentId) {
    return { plan: null, items: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return createMockStudyPlan({
      studentId: params.studentId,
      createdBy: params.createdBy,
      subjectId: params.subjectId,
      title: cleanTitle,
      description: params.description,
      items: params.items,
    });
  }

  try {
    const planPayload: StudyPlanInsert = {
      student_id: params.studentId,
      created_by: params.createdBy || null,
      subject_id: params.subjectId || null,
      title: cleanTitle,
      description: params.description?.trim() || null,
      status: 'active',
    };

    // 1. Insert parent plan
    const { data: newPlan, error: planError } = await supabase
      .from('study_plans')
      .insert(planPayload)
      .select()
      .single();

    if (planError || !newPlan) {
      return { plan: null, items: [], error: planError || new Error('Failed to create study plan.') };
    }

    // 2. Insert items if any
    const createdItems: StudyPlanItem[] = [];
    if (params.items && params.items.length > 0) {
      const itemsPayload: StudyPlanItemInsert[] = params.items
        .filter((item) => item.title.trim().length > 0)
        .map((item, idx) => ({
          plan_id: newPlan.id,
          title: item.title.trim(),
          instructions: item.instructions?.trim() || null,
          estimated_minutes: item.estimated_minutes && item.estimated_minutes > 0 ? item.estimated_minutes : null,
          target_date: item.target_date || null,
          item_order: idx + 1,
          status: 'pending',
        }));

      if (itemsPayload.length > 0) {
        const { data: insertedItems, error: itemsError } = await supabase
          .from('study_plan_items')
          .insert(itemsPayload)
          .select()
          .order('item_order', { ascending: true });

        if (itemsError) {
          return { plan: newPlan as StudyPlan, items: [], error: itemsError };
        }
        if (insertedItems) {
          createdItems.push(...(insertedItems as StudyPlanItem[]));
        }
      }
    }

    if (params.createdBy && params.createdBy !== params.studentId) {
      createNotification({
        recipientId: params.studentId,
        actorId: params.createdBy,
        type: 'plan_updated',
        title: 'Study Plan Assigned',
        message: `Mentor published study plan "${cleanTitle}"`,
        link: '/student/plans',
        idempotencyKey: `plan:${newPlan.id}`,
      }).catch(() => {});
    }

    return { plan: newPlan as StudyPlan, items: createdItems, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { plan: null, items: [], error };
  }
}

/**
 * Update an existing study plan and optionally its items.
 */
export async function updateStudyPlan(
  planId: string,
  updates: Partial<Pick<StudyPlan, 'title' | 'description' | 'subject_id' | 'status'>>,
  items?: {
    id?: string;
    title: string;
    instructions?: string;
    estimated_minutes?: number;
    target_date?: string;
    status?: 'pending' | 'in_progress' | 'completed';
  }[]
): Promise<{
  plan: StudyPlan | null;
  items: StudyPlanItem[];
  error: Error | null;
}> {
  if (!planId) {
    return { plan: null, items: [], error: new Error('Study Plan ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockStudyPlan(planId, updates, items);
  }

  try {
    const planUpdatePayload: StudyPlanUpdate = {};
    if (updates.title !== undefined) {
      const cleanTitle = updates.title.trim();
      if (!cleanTitle) {
        return { plan: null, items: [], error: new Error('Plan title cannot be empty.') };
      }
      planUpdatePayload.title = cleanTitle;
    }
    if (updates.description !== undefined) {
      planUpdatePayload.description = updates.description?.trim() || null;
    }
    if (updates.subject_id !== undefined) {
      planUpdatePayload.subject_id = updates.subject_id || null;
    }
    if (updates.status !== undefined) {
      planUpdatePayload.status = updates.status;
    }

    // 1. Update parent plan
    const { data: updatedPlan, error: planError } = await supabase
      .from('study_plans')
      .update(planUpdatePayload)
      .eq('id', planId)
      .select()
      .single();

    if (planError || !updatedPlan) {
      return { plan: null, items: [], error: planError || new Error('Failed to update study plan.') };
    }

    // 2. If items were passed, replace items in order
    let finalItems: StudyPlanItem[] = [];
    if (items !== undefined) {
      // Delete existing
      await supabase.from('study_plan_items').delete().eq('plan_id', planId);

      const itemsPayload: StudyPlanItemInsert[] = items
        .filter((item) => item.title.trim().length > 0)
        .map((item, idx) => ({
          plan_id: planId,
          title: item.title.trim(),
          instructions: item.instructions?.trim() || null,
          estimated_minutes: item.estimated_minutes && item.estimated_minutes > 0 ? item.estimated_minutes : null,
          target_date: item.target_date || null,
          item_order: idx + 1,
          status: item.status || 'pending',
        }));

      if (itemsPayload.length > 0) {
        const { data: insertedItems, error: itemsError } = await supabase
          .from('study_plan_items')
          .insert(itemsPayload)
          .select()
          .order('item_order', { ascending: true });

        if (itemsError) {
          return { plan: updatedPlan as StudyPlan, items: [], error: itemsError };
        }
        finalItems = (insertedItems as StudyPlanItem[]) || [];
      }
    } else {
      const { data: currentItems } = await supabase
        .from('study_plan_items')
        .select('*')
        .eq('plan_id', planId)
        .order('item_order', { ascending: true });
      finalItems = (currentItems as StudyPlanItem[]) || [];
    }

    return { plan: updatedPlan as StudyPlan, items: finalItems, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { plan: null, items: [], error };
  }
}

/**
 * Delete a study plan (cascades to items via foreign key).
 */
export async function deleteStudyPlan(planId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!planId) {
    return { success: false, error: new Error('Study Plan ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockStudyPlan(planId);
  }

  try {
    const { error } = await supabase
      .from('study_plans')
      .delete()
      .eq('id', planId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
