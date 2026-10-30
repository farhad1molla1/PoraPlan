import { supabase, isSupabaseConfigured } from './supabase';
import type {
  CohortMentorWithMeta,
  StudentMentorAssignmentWithMeta,
  EffectiveMentorResolution,
  MentorWorkloadSummary,
  Profile,
} from '../types/database';
import {
  getMockCohortMentors,
  getMockStudentMentorAssignments,
  getMockEffectiveMentorForStudent,
  getMockEffectiveStudentsForMentor,
  getMockEligibleMentorsForProgram,
  getMockMentorWorkload,
  adminAssignMockCohortMentor,
  adminEndMockCohortMentor,
  adminAssignMockIndividualMentor,
  adminEndMockIndividualMentor,
  getMockProfile,
  getMockCohorts,
  getMockProgramById,
  getMockEnrollments,
} from './mockAuthStore';
import { createNotification } from './notifications';

// ==============================================================================
// Helper Badge Variants & Formatters
// ==============================================================================

export function getAssignmentBadgeVariant(
  type: 'individual' | 'cohort' | 'none'
): 'teal' | 'gold' | 'paper' {
  switch (type) {
    case 'individual':
      return 'teal';
    case 'cohort':
      return 'gold';
    case 'none':
    default:
      return 'paper';
  }
}

export function getAssignmentLabel(type: 'individual' | 'cohort' | 'none'): string {
  switch (type) {
    case 'individual':
      return 'Individual Override';
    case 'cohort':
      return 'Cohort Default';
    case 'none':
    default:
      return 'Unassigned';
  }
}

// ==============================================================================
// Cohort Mentor Retrieval
// ==============================================================================

export async function getCohortMentors(filters?: {
  cohortId?: string;
  programId?: string;
  mentorId?: string;
  isActive?: boolean;
}): Promise<{ cohortMentors: CohortMentorWithMeta[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const list = getMockCohortMentors(filters);
    const enriched: CohortMentorWithMeta[] = list.map((cm) => {
      const mentor = getMockProfile(cm.mentor_id);
      const cohort = getMockCohorts().find((c) => c.id === cm.cohort_id) || null;
      const program = getMockProgramById(cm.program_id);
      const assignedBy = cm.assigned_by ? getMockProfile(cm.assigned_by) : null;
      const enrolledCount = getMockEnrollments({ cohortId: cm.cohort_id, status: 'active' }).length;

      return {
        ...cm,
        mentor,
        cohort,
        program,
        assigned_by_profile: assignedBy,
        enrolled_students_count: enrolledCount,
      };
    });

    return { cohortMentors: enriched, error: null };
  }

  try {
    let query = (supabase.from('cohort_mentors') as any).select(`
      *,
      profiles!mentor_id(id, full_name, email, role, poraplan_id, avatar_url, whatsapp_number, academic_background, expertise, status),
      cohorts(id, name, code, status, start_date, end_date),
      programs(id, name, slug, category)
    `);

    if (filters?.cohortId && filters.cohortId !== 'all') {
      query = query.eq('cohort_id', filters.cohortId);
    }
    if (filters?.programId && filters.programId !== 'all') {
      query = query.eq('program_id', filters.programId);
    }
    if (filters?.mentorId && filters.mentorId !== 'all') {
      query = query.eq('mentor_id', filters.mentorId);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    query = query.order('assigned_at', { ascending: false });

    const { data, error } = await query;
    if (error) return { cohortMentors: [], error };

    const cohortMentors: CohortMentorWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      cohort_id: row.cohort_id,
      mentor_id: row.mentor_id,
      program_id: row.program_id,
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
      ended_at: row.ended_at,
      is_active: row.is_active,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      mentor: row.profiles,
      cohort: row.cohorts,
      program: row.programs,
      assigned_by_profile: null,
      enrolled_students_count: 0,
    }));

    return { cohortMentors, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { cohortMentors: [], error };
  }
}

// ==============================================================================
// Student Mentor Assignments (Individual Overrides) Retrieval
// ==============================================================================

export async function getStudentMentorAssignments(filters?: {
  studentId?: string;
  programId?: string;
  mentorId?: string;
  isActive?: boolean;
}): Promise<{ assignments: StudentMentorAssignmentWithMeta[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const list = getMockStudentMentorAssignments(filters);
    const enriched: StudentMentorAssignmentWithMeta[] = list.map((sma) => {
      const student = getMockProfile(sma.student_id);
      const mentor = getMockProfile(sma.mentor_id);
      const cohort = sma.cohort_id
        ? getMockCohorts().find((c) => c.id === sma.cohort_id) || null
        : null;
      const program = getMockProgramById(sma.program_id);
      const assignedBy = sma.assigned_by ? getMockProfile(sma.assigned_by) : null;

      return {
        ...sma,
        student,
        mentor,
        cohort,
        program,
        assigned_by_profile: assignedBy,
      };
    });

    return { assignments: enriched, error: null };
  }

  try {
    let query = (supabase.from('student_mentor_assignments') as any).select(`
      *,
      student:profiles!student_id(id, full_name, email, role, poraplan_id, avatar_url, university, department, batch, current_semester, whatsapp_number),
      mentor:profiles!mentor_id(id, full_name, email, role, poraplan_id, avatar_url, whatsapp_number, academic_background, expertise, status),
      cohorts(id, name, code, status),
      programs(id, name, slug, category)
    `);

    if (filters?.studentId && filters.studentId !== 'all') {
      query = query.eq('student_id', filters.studentId);
    }
    if (filters?.programId && filters.programId !== 'all') {
      query = query.eq('program_id', filters.programId);
    }
    if (filters?.mentorId && filters.mentorId !== 'all') {
      query = query.eq('mentor_id', filters.mentorId);
    }
    if (filters?.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    query = query.order('assigned_at', { ascending: false });

    const { data, error } = await query;
    if (error) return { assignments: [], error };

    const assignments: StudentMentorAssignmentWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      mentor_id: row.mentor_id,
      program_id: row.program_id,
      cohort_id: row.cohort_id,
      assignment_type: row.assignment_type,
      assigned_by: row.assigned_by,
      assigned_at: row.assigned_at,
      ended_at: row.ended_at,
      is_active: row.is_active,
      notes: row.notes,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student: row.student,
      mentor: row.mentor,
      cohort: row.cohorts,
      program: row.programs,
      assigned_by_profile: null,
    }));

    return { assignments, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { assignments: [], error };
  }
}

// ==============================================================================
// Centralized Effective Mentor Resolution
// Precedence: Individual Override ?? Cohort Default ?? None
// ==============================================================================

export async function getEffectiveMentor(
  studentId: string,
  programId?: string,
  callerId?: string
): Promise<{ resolution: EffectiveMentorResolution; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const res = getMockEffectiveMentorForStudent(studentId, programId, callerId);
    return { resolution: res, error: null };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('get_effective_mentor_for_student', {
      p_student_id: studentId,
      p_program_id: programId || null,
    });

    if (error) {
      // Fallback to direct client-side query if RPC not yet deployed
      const [overrideRes, enrollmentsRes] = await Promise.all([
        (supabase.from('student_mentor_assignments') as any)
          .select('*, profiles!mentor_id(*), programs(*), cohorts(*)')
          .eq('student_id', studentId)
          .eq('is_active', true)
          .maybeSingle(),
        (supabase.from('program_enrollments') as any)
          .select('cohort_id, program_id, programs(*), cohorts(*)')
          .eq('student_id', studentId)
          .eq('status', 'active')
          .limit(1),
      ]);

      if (overrideRes.data) {
        return {
          resolution: {
            student_id: studentId,
            mentor: overrideRes.data.profiles,
            assignment_type: 'individual',
            assignment_id: overrideRes.data.id,
            cohort: overrideRes.data.cohorts,
            program: overrideRes.data.programs,
            assigned_at: overrideRes.data.assigned_at,
            notes: overrideRes.data.notes,
          },
          error: null,
        };
      }

      if (enrollmentsRes.data && enrollmentsRes.data.length > 0) {
        const enr = enrollmentsRes.data[0];
        const { data: cohortMentor } = await (supabase.from('cohort_mentors') as any)
          .select('*, profiles!mentor_id(*)')
          .eq('cohort_id', enr.cohort_id)
          .eq('is_active', true)
          .maybeSingle();

        if (cohortMentor) {
          return {
            resolution: {
              student_id: studentId,
              mentor: cohortMentor.profiles,
              assignment_type: 'cohort',
              assignment_id: cohortMentor.id,
              cohort: enr.cohorts,
              program: enr.programs,
              assigned_at: cohortMentor.assigned_at,
              notes: cohortMentor.notes,
            },
            error: null,
          };
        }
      }

      return {
        resolution: {
          student_id: studentId,
          mentor: null,
          assignment_type: 'none',
        },
        error: null,
      };
    }

    if (data && data.length > 0) {
      const row = data[0];
      const mentor: Profile = {
        id: row.mentor_id,
        full_name: row.mentor_name,
        email: row.mentor_email,
        poraplan_id: row.mentor_poraplan_id,
        whatsapp_number: row.mentor_whatsapp,
        academic_background: row.mentor_background,
        role: 'mentor',
      };

      return {
        resolution: {
          student_id: studentId,
          mentor,
          assignment_type: row.assignment_type as any,
          assignment_id: row.assignment_id,
          cohort_id: row.cohort_id,
          program_id: row.program_id,
          assigned_at: row.assigned_at,
        },
        error: null,
      };
    }

    return {
      resolution: {
        student_id: studentId,
        mentor: null,
        assignment_type: 'none',
      },
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      resolution: {
        student_id: studentId,
        mentor: null,
        assignment_type: 'none',
      },
      error,
    };
  }
}

// ==============================================================================
// Assigned / Effective Students for a Mentor
// ==============================================================================

export async function getEffectiveStudentsForMentor(mentorId: string): Promise<{
  students: {
    student: Profile;
    cohort: any;
    program: any;
    assignmentType: 'individual' | 'cohort';
    assignedAt: string;
  }[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const list = getMockEffectiveStudentsForMentor(mentorId);
    return { students: list, error: null };
  }

  try {
    // 1. Fetch individual overrides for this mentor
    const { data: overrides } = await (supabase.from('student_mentor_assignments') as any)
      .select('*, student:profiles!student_id(*), cohorts(*), programs(*)')
      .eq('mentor_id', mentorId)
      .eq('is_active', true);

    const result: any[] = [];
    const processedStudentIds = new Set<string>();

    for (const ov of overrides || []) {
      if (ov.student) {
        result.push({
          student: ov.student,
          cohort: ov.cohorts,
          program: ov.programs,
          assignmentType: 'individual',
          assignedAt: ov.assigned_at,
        });
        processedStudentIds.add(ov.student.id);
      }
    }

    // 2. Fetch cohorts where mentor is default cohort mentor
    const { data: cohortAssignments } = await (supabase.from('cohort_mentors') as any)
      .select('cohort_id, program_id, assigned_at, cohorts(*), programs(*)')
      .eq('mentor_id', mentorId)
      .eq('is_active', true);

    for (const ca of cohortAssignments || []) {
      const { data: enrollments } = await (supabase.from('program_enrollments') as any)
        .select('*, student:profiles!student_id(*)')
        .eq('cohort_id', ca.cohort_id)
        .eq('status', 'active');

      for (const enr of enrollments || []) {
        if (!processedStudentIds.has(enr.student_id)) {
          // Verify student does not have an active override to someone else
          const { data: otherOverride } = await (supabase.from('student_mentor_assignments') as any)
            .select('id')
            .eq('student_id', enr.student_id)
            .eq('is_active', true)
            .neq('mentor_id', mentorId)
            .maybeSingle();

          if (!otherOverride && enr.student) {
            result.push({
              student: enr.student,
              cohort: ca.cohorts,
              program: ca.programs,
              assignmentType: 'cohort',
              assignedAt: ca.assigned_at,
            });
            processedStudentIds.add(enr.student_id);
          }
        }
      }
    }

    return { students: result, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { students: [], error };
  }
}

// ==============================================================================
// Eligible Mentors & Workload
// ==============================================================================

export async function getEligibleMentorsForProgram(
  programId: string
): Promise<{ mentors: Profile[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const mentors = getMockEligibleMentorsForProgram(programId);
    return { mentors, error: null };
  }

  try {
    const { data: apps, error } = await (supabase.from('program_applications') as any)
      .select('applicant_id, profiles!applicant_id(*)')
      .eq('program_id', programId)
      .eq('application_type', 'mentor')
      .eq('status', 'approved');

    if (error) return { mentors: [], error };

    const mentors: Profile[] = (apps || [])
      .map((a: any) => a.profiles)
      .filter((p: any) => p && p.role === 'mentor' && p.status !== 'suspended');

    return { mentors, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { mentors: [], error };
  }
}

export async function getMentorWorkloadSummary(): Promise<{
  workload: MentorWorkloadSummary[];
  error: Error | null;
}> {
  if (!isSupabaseConfigured()) {
    const workload = getMockMentorWorkload();
    return { workload, error: null };
  }

  try {
    const { data: mentors, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'mentor');

    if (error) return { workload: [], error };

    const workload: MentorWorkloadSummary[] = [];

    for (const mentor of (mentors as Profile[]) || []) {
      const { students } = await getEffectiveStudentsForMentor(mentor.id);
      const { data: cms } = await (supabase.from('cohort_mentors') as any)
        .select('cohort_id, cohorts(name, code), programs(name)')
        .eq('mentor_id', mentor.id)
        .eq('is_active', true);
      const { data: overrides } = await (supabase.from('student_mentor_assignments') as any)
        .select('id')
        .eq('mentor_id', mentor.id)
        .eq('is_active', true);

      const cohortsDetail = (cms || []).map((c: any) => ({
        id: c.cohort_id,
        name: c.cohorts?.name || 'Cohort',
        code: c.cohorts?.code || 'N/A',
        programName: c.programs?.name || 'Program',
        studentCount: 0,
      }));

      workload.push({
        mentor,
        activeCohortsCount: (cms || []).length,
        individualOverridesCount: (overrides || []).length,
        totalEffectiveMenteesCount: students.length,
        cohorts: cohortsDetail,
        isEligible: true,
      });
    }

    return { workload, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { workload: [], error };
  }
}

// ==============================================================================
// Admin Mutations (Assign, End, Override) with Notification Integration
// ==============================================================================

export async function assignCohortMentor(input: {
  cohortId: string;
  mentorId: string;
  cohortName?: string;
  programName?: string;
  mentorName?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; assignmentId?: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const res = adminAssignMockCohortMentor(input.cohortId, input.mentorId, input.notes);
    if (res.success) {
      // In-app notifications
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'New Cohort Mentorship Allocation',
        message: `You have been allocated as lead mentor for ${input.cohortName || 'Cohort'} (${input.programName || 'Academic Program'}).`,
        link: '/mentor/dashboard',
      });
    }
    return { ...res, error: null };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('admin_assign_cohort_mentor', {
      p_cohort_id: input.cohortId,
      p_mentor_id: input.mentorId,
      p_notes: input.notes || null,
    });

    if (error) {
      return { success: false, message: error.message, error };
    }

    // Trigger in-app notification
    await createNotification({
      recipientId: input.mentorId,
      type: 'system',
      title: 'New Cohort Mentorship Allocation',
      message: `You have been allocated as lead mentor for ${input.cohortName || 'Cohort'} (${input.programName || 'Academic Program'}).`,
      link: '/mentor/dashboard',
    });

    return {
      success: Boolean(data?.success),
      message: data?.message || 'Cohort mentor assigned successfully.',
      assignmentId: data?.assignment_id,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, message: error.message, error };
  }
}

export async function endCohortMentor(input: {
  cohortId: string;
  mentorId?: string;
  cohortName?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const res = adminEndMockCohortMentor(input.cohortId, input.notes);
    if (res.success && input.mentorId) {
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'Cohort Mentorship Concluded',
        message: `Your cohort mentor assignment for ${input.cohortName || 'Cohort'} has concluded.`,
        link: '/mentor/dashboard',
      });
    }
    return { ...res, error: null };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('admin_end_cohort_mentor', {
      p_cohort_id: input.cohortId,
      p_notes: input.notes || null,
    });

    if (error) {
      return { success: false, message: error.message, error };
    }

    if (input.mentorId) {
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'Cohort Mentorship Concluded',
        message: `Your cohort mentor assignment for ${input.cohortName || 'Cohort'} has concluded.`,
        link: '/mentor/dashboard',
      });
    }

    return {
      success: Boolean(data?.success),
      message: data?.message || 'Cohort mentor assignment ended.',
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, message: error.message, error };
  }
}

export async function assignIndividualMentor(input: {
  studentId: string;
  mentorId: string;
  programId: string;
  cohortId?: string;
  studentName?: string;
  mentorName?: string;
  programName?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; assignmentId?: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const res = adminAssignMockIndividualMentor(
      input.studentId,
      input.mentorId,
      input.programId,
      input.cohortId,
      input.notes
    );

    if (res.success) {
      // Notify student
      await createNotification({
        recipientId: input.studentId,
        type: 'system',
        title: 'Personal Academic Mentor Assigned',
        message: `${input.mentorName || 'A mentor'} has been specifically assigned as your dedicated mentor in ${input.programName || 'your program'}.`,
        link: '/student/dashboard',
      });

      // Notify mentor
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'New Individual Mentee Assignment',
        message: `You have been individually assigned to mentor ${input.studentName || 'Student'} in ${input.programName || 'Program'}.`,
        link: '/mentor/dashboard',
      });
    }

    return { ...res, error: null };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('admin_assign_individual_mentor', {
      p_student_id: input.studentId,
      p_mentor_id: input.mentorId,
      p_program_id: input.programId,
      p_cohort_id: input.cohortId || null,
      p_notes: input.notes || null,
    });

    if (error) {
      return { success: false, message: error.message, error };
    }

    // In-app notifications
    await Promise.all([
      createNotification({
        recipientId: input.studentId,
        type: 'system',
        title: 'Personal Academic Mentor Assigned',
        message: `${input.mentorName || 'A mentor'} has been specifically assigned as your dedicated mentor in ${input.programName || 'your program'}.`,
        link: '/student/dashboard',
      }),
      createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'New Individual Mentee Assignment',
        message: `You have been individually assigned to mentor ${input.studentName || 'Student'} in ${input.programName || 'Program'}.`,
        link: '/mentor/dashboard',
      }),
    ]);

    return {
      success: Boolean(data?.success),
      message: data?.message || 'Individual mentor override assigned successfully.',
      assignmentId: data?.assignment_id,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, message: error.message, error };
  }
}

export async function endIndividualMentor(input: {
  assignmentId: string;
  studentId?: string;
  mentorId?: string;
  studentName?: string;
  notes?: string;
}): Promise<{ success: boolean; message: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const res = adminEndMockIndividualMentor(input.assignmentId, input.notes);
    if (res.success) {
      if (input.studentId) {
        await createNotification({
          recipientId: input.studentId,
          type: 'system',
          title: 'Mentorship Assignment Updated',
          message:
            'Your individual mentorship override has concluded. You have reverted to your cohort default mentor.',
          link: '/student/dashboard',
        });
      }
      if (input.mentorId) {
        await createNotification({
          recipientId: input.mentorId,
          type: 'system',
          title: 'Individual Mentorship Concluded',
          message: `Your individual mentorship assignment with ${input.studentName || 'Student'} has concluded.`,
          link: '/mentor/dashboard',
        });
      }
    }
    return { ...res, error: null };
  }

  try {
    const { data, error } = await (supabase.rpc as any)('admin_end_individual_mentor', {
      p_assignment_id: input.assignmentId,
      p_notes: input.notes || null,
    });

    if (error) {
      return { success: false, message: error.message, error };
    }

    if (input.studentId) {
      await createNotification({
        recipientId: input.studentId,
        type: 'system',
        title: 'Mentorship Assignment Updated',
        message:
          'Your individual mentorship override has concluded. You have reverted to your cohort default mentor.',
        link: '/student/dashboard',
      });
    }

    if (input.mentorId) {
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'Individual Mentorship Concluded',
        message: `Your individual mentorship assignment with ${input.studentName || 'Student'} has concluded.`,
        link: '/mentor/dashboard',
      });
    }

    return {
      success: Boolean(data?.success),
      message: data?.message || 'Individual override ended.',
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, message: error.message, error };
  }
}
