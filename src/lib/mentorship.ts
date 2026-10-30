import { supabase, isSupabaseConfigured } from './supabase';
import type { Profile } from '../types/database';
import { getMockAssignedStudents, getMockAssignedMentors } from './mockAuthStore';
import { getEffectiveStudentsForMentor, getEffectiveMentor } from './mentorAssignments';

/**
 * Fetch students assigned to a specific mentor using effective mentor resolution.
 */
export async function getAssignedStudents(mentorId: string): Promise<{
  students: Profile[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const mockStudents = getMockAssignedStudents(mentorId);
    return { students: mockStudents, error: null };
  }

  try {
    const { students: effectiveList, error: effError } = await getEffectiveStudentsForMentor(mentorId);
    if (!effError && effectiveList.length > 0) {
      return { students: effectiveList.map((item) => item.student), error: null };
    }

    // Fallback to legacy mentor_students table
    const { data: pairings, error: pairError } = await supabase
      .from('mentor_students')
      .select('student_id')
      .eq('mentor_id', mentorId)
      .eq('status', 'active');

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
 * Fetch mentor(s) assigned to a specific student using effective mentor resolution.
 */
export async function getAssignedMentors(studentId: string): Promise<{
  mentors: Profile[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const mockMentors = getMockAssignedMentors(studentId);
    return { mentors: mockMentors, error: null };
  }

  try {
    const { resolution, error: resError } = await getEffectiveMentor(studentId);
    if (!resError && resolution.mentor) {
      return { mentors: [resolution.mentor], error: null };
    }

    // Fallback to legacy mentor_students table
    const { data: pairings, error: pairError } = await supabase
      .from('mentor_students')
      .select('mentor_id')
      .eq('student_id', studentId)
      .eq('status', 'active');

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
