import { supabase, isSupabaseConfigured } from './supabase';
import type { Profile } from '../types/database';

/**
 * Fetch students assigned to a specific mentor.
 */
export async function getAssignedStudents(mentorId: string): Promise<{
  students: Profile[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { students: [], error: new Error('Supabase client is not configured') };
  }

  try {
    const { data: pairings, error: pairError } = await supabase
      .from('mentor_students')
      .select('student_id')
      .eq('mentor_id', mentorId);

    if (pairError) {
      return { students: [], error: pairError };
    }

    if (!pairings || pairings.length === 0) {
      return { students: [], error: null };
    }

    const studentIds = pairings.map((p) => p.student_id);
    const { data: studentProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', studentIds);

    if (profileError) {
      return { students: [], error: profileError };
    }

    return { students: (studentProfiles as Profile[]) || [], error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { students: [], error };
  }
}

/**
 * Fetch mentors assigned to a specific student.
 */
export async function getAssignedMentors(studentId: string): Promise<{
  mentors: Profile[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    return { mentors: [], error: new Error('Supabase client is not configured') };
  }

  try {
    const { data: pairings, error: pairError } = await supabase
      .from('mentor_students')
      .select('mentor_id')
      .eq('student_id', studentId);

    if (pairError) {
      return { mentors: [], error: pairError };
    }

    if (!pairings || pairings.length === 0) {
      return { mentors: [], error: null };
    }

    const mentorIds = pairings.map((p) => p.mentor_id);
    const { data: mentorProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', mentorIds);

    if (profileError) {
      return { mentors: [], error: profileError };
    }

    return { mentors: (mentorProfiles as Profile[]) || [], error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { mentors: [], error };
  }
}
