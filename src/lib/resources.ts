import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Resource,
  ResourceInsert,
  ResourceUpdate,
  ResourceType,
  ResourceStatus,
  Subject,
  StudyPlan,
} from '../types/database';
import {
  getMockStudentResources,
  getMockMentorResources,
  getMockResourceById,
  createMockResource,
  updateMockResource,
  deleteMockResource,
} from './mockAuthStore';

export type ResourceWithMeta = Resource & {
  student_name?: string;
  student_poraplan_id?: string;
  mentor_name?: string;
  subject_name?: string;
  plan_title?: string;
  subject?: Subject | null;
  plan?: StudyPlan | null;
};

/**
 * Fetch all learning resources accessible to a student.
 * Enforced at database level by Supabase RLS:
 * - Students can only view resources where student_id = auth.uid()
 * - Mentors can view resources for their assigned students
 */
export async function getStudentResources(studentId: string): Promise<{
  resources: ResourceWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { resources: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentResources(studentId);
    return { resources: list as ResourceWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*, subjects(id, name, code), study_plans(id, title), profiles!mentor_id(full_name)')
      .eq('student_id', studentId)
      .order('created_at', { ascending: false });

    if (error) {
      return { resources: [], error };
    }

    const resources: ResourceWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      title: row.title,
      description: row.description,
      resource_type: row.resource_type,
      url: row.url,
      file_name: row.file_name,
      file_size: row.file_size,
      content: row.content,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      subject_name: row.subjects?.name || undefined,
      plan_title: row.study_plans?.title || undefined,
      mentor_name: row.profiles?.full_name || undefined,
    }));

    return { resources, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resources: [], error };
  }
}

/**
 * Fetch resources managed by a mentor across their assigned students.
 */
export async function getMentorResources(mentorId: string): Promise<{
  resources: ResourceWithMeta[];
  error: Error | null;
}> {
  if (!mentorId) {
    return { resources: [], error: new Error('Mentor ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockMentorResources(mentorId);
    return { resources: list as ResourceWithMeta[], error: null };
  }

  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*, subjects(id, name, code), study_plans(id, title), profiles!student_id(full_name, poraplan_id)')
      .order('created_at', { ascending: false });

    if (error) {
      return { resources: [], error };
    }

    const resources: ResourceWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      title: row.title,
      description: row.description,
      resource_type: row.resource_type,
      url: row.url,
      file_name: row.file_name,
      file_size: row.file_size,
      content: row.content,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student_name: row.profiles?.full_name || undefined,
      student_poraplan_id: row.profiles?.poraplan_id || undefined,
      subject_name: row.subjects?.name || undefined,
      plan_title: row.study_plans?.title || undefined,
    }));

    return { resources, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resources: [], error };
  }
}

/**
 * Fetch a single resource by ID.
 */
export async function getResourceById(resourceId: string): Promise<{
  resource: ResourceWithMeta | null;
  error: Error | null;
}> {
  if (!resourceId) {
    return { resource: null, error: new Error('Resource ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = getMockResourceById(resourceId);
    return { resource: res, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('resources')
      .select('*, subjects(id, name, code), study_plans(id, title), profiles!student_id(full_name, poraplan_id), profiles!mentor_id(full_name)')
      .eq('id', resourceId)
      .maybeSingle();

    if (error) return { resource: null, error };
    if (!data) return { resource: null, error: null };

    const row: any = data;
    const resource: ResourceWithMeta = {
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      subject_id: row.subject_id,
      plan_id: row.plan_id,
      title: row.title,
      description: row.description,
      resource_type: row.resource_type,
      url: row.url,
      file_name: row.file_name,
      file_size: row.file_size,
      content: row.content,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student_name: row.profiles?.full_name || undefined,
      student_poraplan_id: row.profiles?.poraplan_id || undefined,
      subject_name: row.subjects?.name || undefined,
      plan_title: row.study_plans?.title || undefined,
      mentor_name: row.profiles?.full_name || undefined,
    };

    return { resource, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resource: null, error };
  }
}

/**
 * Create a new learning resource for a student.
 */
export async function createResource(params: {
  studentId: string;
  mentorId?: string;
  subjectId?: string;
  planId?: string;
  title: string;
  description?: string;
  resourceType: ResourceType;
  url?: string;
  fileName?: string;
  fileSize?: number;
  content?: string;
  status?: ResourceStatus;
}): Promise<{
  resource: Resource | null;
  error: Error | null;
}> {
  const cleanTitle = params.title?.trim();
  if (!cleanTitle) {
    return { resource: null, error: new Error('Resource title is required.') };
  }
  if (!params.studentId) {
    return { resource: null, error: new Error('Student ID is required.') };
  }

  if (params.resourceType === 'link' && params.url) {
    const cleanUrl = params.url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { resource: null, error: new Error('Resource URL must start with http:// or https://') };
    }
  }

  if (!isSupabaseConfigured()) {
    return createMockResource(params);
  }

  try {
    const newRecord: ResourceInsert = {
      student_id: params.studentId,
      mentor_id: params.mentorId || null,
      subject_id: params.subjectId || null,
      plan_id: params.planId || null,
      title: cleanTitle,
      description: params.description?.trim() || null,
      resource_type: params.resourceType || 'link',
      url: params.url?.trim() || null,
      file_name: params.fileName?.trim() || null,
      file_size: params.fileSize !== undefined ? params.fileSize : null,
      content: params.content?.trim() || null,
      status: params.status || 'active',
    };

    const { data, error } = await supabase
      .from('resources')
      .insert(newRecord)
      .select()
      .single();

    if (error) {
      return { resource: null, error };
    }

    return { resource: data as Resource, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resource: null, error };
  }
}

/**
 * Update an existing resource.
 */
export async function updateResource(
  resourceId: string,
  mentorId: string,
  updates: Partial<Pick<Resource, 'title' | 'description' | 'subject_id' | 'plan_id' | 'resource_type' | 'url' | 'file_name' | 'file_size' | 'content' | 'status'>>
): Promise<{
  resource: Resource | null;
  error: Error | null;
}> {
  if (!resourceId) {
    return { resource: null, error: new Error('Resource ID is required.') };
  }

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();
    if (!cleanTitle) {
      return { resource: null, error: new Error('Resource title cannot be empty.') };
    }
  }

  if (updates.url !== undefined && updates.url) {
    const cleanUrl = updates.url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return { resource: null, error: new Error('Resource URL must start with http:// or https://') };
    }
  }

  if (!isSupabaseConfigured()) {
    return updateMockResource(resourceId, mentorId, updates);
  }

  try {
    const patch: ResourceUpdate = {
      ...updates,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('resources')
      .update(patch)
      .eq('id', resourceId)
      .select()
      .single();

    if (error) {
      return { resource: null, error };
    }

    return { resource: data as Resource, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resource: null, error };
  }
}

/**
 * Delete a resource by ID.
 */
export async function deleteResource(
  resourceId: string,
  mentorId: string
): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!resourceId) {
    return { success: false, error: new Error('Resource ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockResource(resourceId, mentorId);
  }

  try {
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', resourceId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
