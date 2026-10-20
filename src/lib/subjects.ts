import { supabase, isSupabaseConfigured } from './supabase';
import type { Subject, SubjectInsert, SubjectUpdate } from '../types/database';
import {
  getMockStudentSubjects,
  getMockSubjectById,
  createMockSubject,
  updateMockSubject,
  deleteMockSubject,
} from './mockAuthStore';

/**
 * Fetch all study areas for a given student ID.
 * Handled via RLS on Supabase:
 * - Students can only query their own student_id.
 * - Mentors can only query student_ids of students assigned to them.
 */
export async function getStudentSubjects(studentId: string): Promise<{
  subjects: Subject[];
  error: Error | null;
}> {
  if (!studentId) {
    return { subjects: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentSubjects(studentId);
    return { subjects: list, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('student_id', studentId)
      .order('name', { ascending: true });

    if (error) {
      return { subjects: [], error };
    }

    return { subjects: (data as Subject[]) || [], error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { subjects: [], error };
  }
}

/**
 * Fetch a single study area by subject ID.
 */
export async function getSubjectById(subjectId: string): Promise<{
  subject: Subject | null;
  error: Error | null;
}> {
  if (!subjectId) {
    return { subject: null, error: new Error('Subject ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const sub = getMockSubjectById(subjectId);
    return { subject: sub, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('id', subjectId)
      .single();

    if (error) {
      return { subject: null, error };
    }

    return { subject: data as Subject, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { subject: null, error };
  }
}

/**
 * Create a study area for a student.
 * Mentors may create study areas only for their assigned students.
 */
export async function createSubject(params: {
  studentId: string;
  name: string;
  code?: string;
  description?: string;
  createdBy?: string;
}): Promise<{
  subject: Subject | null;
  error: Error | null;
}> {
  const cleanName = params.name.trim();
  if (!cleanName) {
    return { subject: null, error: new Error('Study area name is required.') };
  }

  if (!params.studentId) {
    return { subject: null, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return createMockSubject({
      studentId: params.studentId,
      name: cleanName,
      code: params.code,
      description: params.description,
      createdBy: params.createdBy,
    });
  }

  try {
    const insertPayload: SubjectInsert = {
      student_id: params.studentId,
      created_by: params.createdBy || null,
      name: cleanName,
      code: params.code?.trim().toUpperCase() || null,
      description: params.description?.trim() || null,
      status: 'active',
    };

    const { data, error } = await supabase
      .from('subjects')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      // Friendly message for unique constraint violation
      if (error.code === '23505' || error.message.includes('unique')) {
        return {
          subject: null,
          error: new Error(`A study area named "${cleanName}" already exists for this student.`),
        };
      }
      return { subject: null, error };
    }

    return { subject: data as Subject, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { subject: null, error };
  }
}

/**
 * Update an existing study area.
 */
export async function updateSubject(
  subjectId: string,
  updates: Partial<Pick<Subject, 'name' | 'code' | 'description' | 'status'>>
): Promise<{
  subject: Subject | null;
  error: Error | null;
}> {
  if (!subjectId) {
    return { subject: null, error: new Error('Subject ID is required.') };
  }

  if (updates.name !== undefined) {
    const cleanName = updates.name.trim();
    if (!cleanName) {
      return { subject: null, error: new Error('Study area name cannot be empty.') };
    }
  }

  if (!isSupabaseConfigured()) {
    return updateMockSubject(subjectId, updates);
  }

  try {
    const sanitizedUpdates: SubjectUpdate = {};
    if (updates.name !== undefined) sanitizedUpdates.name = updates.name.trim();
    if (updates.code !== undefined) sanitizedUpdates.code = updates.code ? updates.code.trim().toUpperCase() : null;
    if (updates.description !== undefined) sanitizedUpdates.description = updates.description ? updates.description.trim() : null;
    if (updates.status !== undefined) sanitizedUpdates.status = updates.status;

    const { data, error } = await supabase
      .from('subjects')
      .update(sanitizedUpdates)
      .eq('id', subjectId)
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        return {
          subject: null,
          error: new Error(`Another study area with that name already exists for this student.`),
        };
      }
      return { subject: null, error };
    }

    return { subject: data as Subject, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { subject: null, error };
  }
}

/**
 * Delete a study area.
 */
export async function deleteSubject(subjectId: string): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!subjectId) {
    return { success: false, error: new Error('Subject ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockSubject(subjectId);
  }

  try {
    const { error } = await supabase
      .from('subjects')
      .delete()
      .eq('id', subjectId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
