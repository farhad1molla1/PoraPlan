import { supabase, isSupabaseConfigured } from './supabase';
import type {
  CohortMentorWithMeta,
  StudentMentorAssignmentWithMeta,
  EffectiveMentorResolution,
  MentorWorkloadSummary,
  Profile,
  ProgramEnrollmentWithMeta,
} from '../types/database';
import {
  DEFAULT_PAGE,
  type PaginationMeta,
  type PaginationParams,
} from '../types/pagination';
import {
  createPaginationMeta,
} from './pagination';
import {
  getEnrollmentsPaginated,
} from './applications';
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
// Pagination & Composite Key Constants & Helpers
// ==============================================================================

export const DEFAULT_ADMIN_MENTOR_ALLOCATIONS_PAGE_SIZE = 25;

/**
 * Creates a deterministic, multi-program-safe lookup key for effective mentor resolutions.
 * Format: `${studentId}:${programId}` if programId is provided, or `${studentId}`.
 */
export function makeEffectiveMentorKey(
  studentId: string,
  programId?: string | null
): string {
  if (studentId && programId) {
    return `${studentId}:${programId}`;
  }
  return studentId || '';
}

export interface EffectiveMentorResolutionTarget {
  studentId: string;
  programId?: string | null;
  cohortId?: string | null;
}

export interface BulkEffectiveMentorResult {
  resolutions: Record<string, EffectiveMentorResolution>;
  error: Error | null;
}

export interface AdminMentorAllocationsPaginatedParams extends PaginationParams {
  programId?: string;
  cohortId?: string;
  status?: string;
  search?: string;
}

export interface AdminMentorAllocationsPaginatedResult {
  enrollments: ProgramEnrollmentWithMeta[];
  resolutions: Record<string, EffectiveMentorResolution>;
  pagination: PaginationMeta;
  error: Error | null;
}

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
// Bulk Effective Mentor Resolution & Paginated Admin Allocations
// ==============================================================================

/**
 * Resolves effective mentors for multiple students in bulk (eliminates sequential N+1 queries).
 * Precedence: Individual Override ?? Cohort Default ?? None.
 * Returns results keyed by both `${studentId}:${programId}` and `${studentId}`.
 */
export async function resolveEffectiveMentorsBulk(
  targets: EffectiveMentorResolutionTarget[]
): Promise<BulkEffectiveMentorResult> {
  if (!targets || targets.length === 0) {
    return { resolutions: {}, error: null };
  }

  if (!isSupabaseConfigured()) {
    const resolutions: Record<string, EffectiveMentorResolution> = {};
    for (const t of targets) {
      if (!t.studentId) continue;
      const res = getMockEffectiveMentorForStudent(t.studentId, t.programId || undefined);
      const compositeKey = makeEffectiveMentorKey(t.studentId, t.programId);
      resolutions[compositeKey] = res;
      if (!resolutions[t.studentId]) {
        resolutions[t.studentId] = res;
      }
    }
    return { resolutions, error: null };
  }

  try {
    const uniqueStudentIds = Array.from(new Set(targets.map((t) => t.studentId).filter(Boolean)));
    if (uniqueStudentIds.length === 0) {
      return { resolutions: {}, error: null };
    }

    // 1. Fetch active individual overrides for these students
    const { data: overrides, error: ovError } = await (supabase.from('student_mentor_assignments') as any)
      .select('*, profiles!mentor_id(*), programs(*), cohorts(*)')
      .in('student_id', uniqueStudentIds)
      .eq('is_active', true);

    if (ovError) {
      return { resolutions: {}, error: ovError };
    }

    // 2. Fetch active enrollments for any targets missing cohortId
    const targetsNeedingCohort = targets.filter((t) => !t.cohortId);
    const enrollmentCohortMap = new Map<string, { cohortId: string; cohort: any; program: any }>();

    if (targetsNeedingCohort.length > 0) {
      const missingStudentIds = Array.from(new Set(targetsNeedingCohort.map((t) => t.studentId).filter(Boolean)));
      const { data: enrs, error: enrError } = await (supabase.from('program_enrollments') as any)
        .select('student_id, program_id, cohort_id, cohorts(*), programs(*)')
        .in('student_id', missingStudentIds)
        .eq('status', 'active');

      if (!enrError && enrs) {
        for (const enr of enrs) {
          const key = makeEffectiveMentorKey(enr.student_id, enr.program_id);
          enrollmentCohortMap.set(key, {
            cohortId: enr.cohort_id,
            cohort: enr.cohorts,
            program: enr.programs,
          });
          if (!enrollmentCohortMap.has(enr.student_id)) {
            enrollmentCohortMap.set(enr.student_id, {
              cohortId: enr.cohort_id,
              cohort: enr.cohorts,
              program: enr.programs,
            });
          }
        }
      }
    }

    // Collect all unique cohort IDs
    const cohortIdSet = new Set<string>();
    for (const t of targets) {
      if (t.cohortId) {
        cohortIdSet.add(t.cohortId);
      } else {
        const enrInfo = enrollmentCohortMap.get(makeEffectiveMentorKey(t.studentId, t.programId))
          || enrollmentCohortMap.get(t.studentId);
        if (enrInfo?.cohortId) {
          cohortIdSet.add(enrInfo.cohortId);
        }
      }
    }

    const uniqueCohortIds = Array.from(cohortIdSet).filter(Boolean);

    // 3. Fetch active cohort mentors for these cohorts
    let cohortMentors: any[] = [];
    if (uniqueCohortIds.length > 0) {
      const { data: cms, error: cmError } = await (supabase.from('cohort_mentors') as any)
        .select('*, profiles!mentor_id(*), programs(*), cohorts(*)')
        .in('cohort_id', uniqueCohortIds)
        .eq('is_active', true);

      if (cmError) {
        return { resolutions: {}, error: cmError };
      }
      cohortMentors = cms || [];
    }

    // Build lookup maps
    const overrideByStudentProgram = new Map<string, any>();
    const overrideByStudent = new Map<string, any>();
    for (const ov of overrides || []) {
      if (ov.program_id) {
        overrideByStudentProgram.set(makeEffectiveMentorKey(ov.student_id, ov.program_id), ov);
      }
      if (!overrideByStudent.has(ov.student_id)) {
        overrideByStudent.set(ov.student_id, ov);
      }
    }

    const cohortMentorMap = new Map<string, any>();
    for (const cm of cohortMentors) {
      if (!cohortMentorMap.has(cm.cohort_id)) {
        cohortMentorMap.set(cm.cohort_id, cm);
      }
    }

    // 4. Resolve each target in memory
    const resolutions: Record<string, EffectiveMentorResolution> = {};

    for (const t of targets) {
      if (!t.studentId) continue;
      const compositeKey = makeEffectiveMentorKey(t.studentId, t.programId);

      // Check override first
      const ov = (t.programId ? overrideByStudentProgram.get(compositeKey) : null)
        || overrideByStudent.get(t.studentId);

      if (ov) {
        const res: EffectiveMentorResolution = {
          student_id: t.studentId,
          mentor: ov.profiles || ov.mentor || null,
          assignment_type: 'individual',
          assignment_id: ov.id,
          cohort: ov.cohorts || null,
          program: ov.programs || null,
          assigned_at: ov.assigned_at,
          notes: ov.notes,
        };
        resolutions[compositeKey] = res;
        if (!resolutions[t.studentId]) {
          resolutions[t.studentId] = res;
        }
        continue;
      }

      // Check cohort default
      let effectiveCohortId = t.cohortId;
      let effectiveCohortMeta: any = null;
      let effectiveProgramMeta: any = null;

      if (!effectiveCohortId) {
        const enrInfo = enrollmentCohortMap.get(compositeKey) || enrollmentCohortMap.get(t.studentId);
        if (enrInfo) {
          effectiveCohortId = enrInfo.cohortId;
          effectiveCohortMeta = enrInfo.cohort;
          effectiveProgramMeta = enrInfo.program;
        }
      }

      const cm = effectiveCohortId ? cohortMentorMap.get(effectiveCohortId) : null;
      if (cm) {
        const res: EffectiveMentorResolution = {
          student_id: t.studentId,
          mentor: cm.profiles || cm.mentor || null,
          assignment_type: 'cohort',
          assignment_id: cm.id,
          cohort: cm.cohorts || effectiveCohortMeta,
          program: cm.programs || effectiveProgramMeta,
          assigned_at: cm.assigned_at,
          notes: cm.notes,
        };
        resolutions[compositeKey] = res;
        if (!resolutions[t.studentId]) {
          resolutions[t.studentId] = res;
        }
        continue;
      }

      // Unassigned
      const unassigned: EffectiveMentorResolution = {
        student_id: t.studentId,
        mentor: null,
        assignment_type: 'none',
      };
      resolutions[compositeKey] = unassigned;
      if (!resolutions[t.studentId]) {
        resolutions[t.studentId] = unassigned;
      }
    }

    return { resolutions, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { resolutions: {}, error };
  }
}

/**
 * Retrieves paginated program enrollments and resolves their effective mentors
 * in a bounded, O(1) query pattern without N+1 loops.
 */
export async function getAdminMentorAllocationsPaginated(
  params?: AdminMentorAllocationsPaginatedParams
): Promise<AdminMentorAllocationsPaginatedResult> {
  const page = params?.page ?? DEFAULT_PAGE;
  const pageSize = params?.pageSize ?? DEFAULT_ADMIN_MENTOR_ALLOCATIONS_PAGE_SIZE;
  const status = params?.status ?? 'active';

  const emptyMeta = createPaginationMeta({
    page,
    pageSize,
    totalCount: 0,
  });

  try {
    const enrRes = await getEnrollmentsPaginated({
      page,
      pageSize,
      programId: params?.programId,
      cohortId: params?.cohortId,
      status,
      search: params?.search,
    });

    if (enrRes.error) {
      return {
        enrollments: [],
        resolutions: {},
        pagination: enrRes.pagination || emptyMeta,
        error: enrRes.error,
      };
    }

    if (!enrRes.enrollments || enrRes.enrollments.length === 0) {
      return {
        enrollments: [],
        resolutions: {},
        pagination: enrRes.pagination || emptyMeta,
        error: null,
      };
    }

    const targets: EffectiveMentorResolutionTarget[] = enrRes.enrollments.map((enr) => ({
      studentId: enr.student_id,
      programId: enr.program_id,
      cohortId: enr.cohort_id,
    }));

    const { resolutions, error: resError } = await resolveEffectiveMentorsBulk(targets);

    return {
      enrollments: enrRes.enrollments,
      resolutions,
      pagination: enrRes.pagination,
      error: resError,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      enrollments: [],
      resolutions: {},
      pagination: emptyMeta,
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
    const processedStudentProgramKeys = new Set<string>();

    for (const ov of overrides || []) {
      if (ov.student) {
        result.push({
          student: ov.student,
          cohort: ov.cohorts,
          program: ov.programs,
          assignmentType: 'individual',
          assignedAt: ov.assigned_at,
        });
        processedStudentProgramKeys.add(`${ov.student.id}:${ov.program_id}`);
      }
    }

    // 2. Fetch cohorts where mentor is default cohort mentor
    const { data: cohortAssignments } = await (supabase.from('cohort_mentors') as any)
      .select('cohort_id, program_id, assigned_at, cohorts(*), programs(*)')
      .eq('mentor_id', mentorId)
      .eq('is_active', true);

    if (cohortAssignments && cohortAssignments.length > 0) {
      const cohortIds = cohortAssignments.map((ca: any) => ca.cohort_id).filter(Boolean);
      const cohortMap = new Map<string, any>();
      for (const ca of cohortAssignments) {
        cohortMap.set(ca.cohort_id, ca);
      }

      // Batch query 1: Fetch all active enrollments across all assigned cohorts in ONE query (eliminates per-cohort queries)
      const { data: enrollments } = await (supabase.from('program_enrollments') as any)
        .select('*, student:profiles!student_id(*)')
        .in('cohort_id', cohortIds)
        .eq('status', 'active');

      if (enrollments && enrollments.length > 0) {
        const candidateStudentIds = Array.from(
          new Set(enrollments.map((enr: any) => enr.student_id).filter(Boolean))
        );

        // Batch query 2: Fetch all other-mentor active overrides across candidates in ONE query (eliminates per-student N+1 queries)
        let overrideQuery = (supabase.from('student_mentor_assignments') as any)
          .select('student_id, program_id')
          .in('student_id', candidateStudentIds)
          .eq('is_active', true)
          .neq('mentor_id', mentorId);

        const programIds = Array.from(new Set(cohortAssignments.map((ca: any) => ca.program_id).filter(Boolean)));
        if (cohortAssignments.length === 1 && cohortAssignments[0]) {
          const ca = cohortAssignments[0];
          overrideQuery = overrideQuery.eq('program_id', ca.program_id);
        } else if (programIds.length > 0) {
          overrideQuery = overrideQuery.in('program_id', programIds);
        }

        const { data: otherOverrides } = await overrideQuery;

        const excludedKeys = new Set<string>();
        for (const ov of otherOverrides || []) {
          excludedKeys.add(`${ov.student_id}:${ov.program_id}`);
        }

        for (const enr of enrollments) {
          const ca = cohortMap.get(enr.cohort_id);
          if (!ca) continue;
          const studentProgramKey = `${enr.student_id}:${ca.program_id}`;
          if (
            !processedStudentProgramKeys.has(studentProgramKey) &&
            !excludedKeys.has(studentProgramKey) &&
            enr.student
          ) {
            result.push({
              student: enr.student,
              cohort: ca.cohorts,
              program: ca.programs,
              assignmentType: 'cohort',
              assignedAt: ca.assigned_at,
            });
            processedStudentProgramKeys.add(studentProgramKey);
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
  _programId?: string
): Promise<{ mentors: Profile[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const mentors = getMockEligibleMentorsForProgram(_programId);
    return { mentors, error: null };
  }

  try {
    const { data: mentorsData, error } = await (supabase.from('profiles') as any)
      .select('*')
      .eq('role', 'mentor')
      .neq('status', 'suspended')
      .order('full_name', { ascending: true });

    if (error) return { mentors: [], error };

    const mentors: Profile[] = (mentorsData as Profile[]) || [];
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
    // Bulk Query 1: Fetch all mentors
    const { data: mentors, error: mentorsError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, poraplan_id, avatar_url, whatsapp_number, academic_background, expertise, status')
      .eq('role', 'mentor');

    if (mentorsError) return { workload: [], error: mentorsError };
    if (!mentors || mentors.length === 0) return { workload: [], error: null };

    // Bulk Query 2: Fetch all active cohort mentors
    const { data: activeCohortMentors, error: cmError } = await (supabase.from('cohort_mentors') as any)
      .select('id, cohort_id, mentor_id, program_id, assigned_at, cohorts(name, code), programs(name)')
      .eq('is_active', true);

    if (cmError) return { workload: [], error: cmError };

    // Bulk Query 3: Fetch all active individual overrides
    const { data: activeOverrides, error: ovError } = await (supabase.from('student_mentor_assignments') as any)
      .select('id, student_id, mentor_id, program_id, cohort_id, assigned_at')
      .eq('is_active', true);

    if (ovError) return { workload: [], error: ovError };

    // Bulk Query 4: Fetch all active enrollments for active cohorts to compute student counts and effective mentees
    const activeCohortIds = Array.from(
      new Set((activeCohortMentors || []).map((cm: any) => cm.cohort_id).filter(Boolean))
    );

    let activeEnrollments: any[] = [];
    if (activeCohortIds.length > 0) {
      const { data: enrs, error: enrError } = await (supabase.from('program_enrollments') as any)
        .select('student_id, cohort_id, program_id')
        .in('cohort_id', activeCohortIds)
        .eq('status', 'active');

      if (enrError) return { workload: [], error: enrError };
      activeEnrollments = enrs || [];
    }

    // Group enrollments by cohort_id
    const enrollmentsByCohort = new Map<string, any[]>();
    for (const enr of activeEnrollments) {
      const list = enrollmentsByCohort.get(enr.cohort_id) || [];
      list.push(enr);
      enrollmentsByCohort.set(enr.cohort_id, list);
    }

    // Map overrides: key `${ov.student_id}:${ov.program_id}` -> mentor_id
    const overrideMentorByStudentProgram = new Map<string, string>();
    const overrideMentorByStudent = new Map<string, string>();
    const overridesByMentor = new Map<string, any[]>();

    for (const ov of activeOverrides || []) {
      if (ov.program_id) {
        overrideMentorByStudentProgram.set(makeEffectiveMentorKey(ov.student_id, ov.program_id), ov.mentor_id);
      }
      if (!overrideMentorByStudent.has(ov.student_id)) {
        overrideMentorByStudent.set(ov.student_id, ov.mentor_id);
      }
      const list = overridesByMentor.get(ov.mentor_id) || [];
      list.push(ov);
      overridesByMentor.set(ov.mentor_id, list);
    }

    // Group cohort mentors by mentor_id
    const cohortMentorsByMentor = new Map<string, any[]>();
    for (const cm of activeCohortMentors || []) {
      const list = cohortMentorsByMentor.get(cm.mentor_id) || [];
      list.push(cm);
      cohortMentorsByMentor.set(cm.mentor_id, list);
    }

    // Build workload summary for each mentor in memory (0 additional DB round-trips)
    const workload: MentorWorkloadSummary[] = [];

    for (const mentor of (mentors as Profile[]) || []) {
      const mentorCMs = cohortMentorsByMentor.get(mentor.id) || [];
      const mentorOverrides = overridesByMentor.get(mentor.id) || [];

      // Track distinct effective mentees for this mentor
      const effectiveMenteeKeys = new Set<string>();

      // A. Individual overrides assigned to this mentor
      for (const ov of mentorOverrides) {
        effectiveMenteeKeys.add(makeEffectiveMentorKey(ov.student_id, ov.program_id));
      }

      // B. Cohort default mentees for cohorts assigned to this mentor
      const cohortsDetail = mentorCMs.map((cm: any) => {
        const cohortEnrollments = enrollmentsByCohort.get(cm.cohort_id) || [];
        const studentCount = cohortEnrollments.length;

        for (const enr of cohortEnrollments) {
          const key = makeEffectiveMentorKey(enr.student_id, cm.program_id);
          const overrideMentorId = overrideMentorByStudentProgram.get(key)
            || overrideMentorByStudent.get(enr.student_id);

          if (!overrideMentorId) {
            // No override: cohort mentor gets the mentee
            effectiveMenteeKeys.add(key);
          } else if (overrideMentorId === mentor.id) {
            // Override points to this mentor
            effectiveMenteeKeys.add(key);
          }
          // If override points to another mentor, this mentor DOES NOT get this mentee
        }

        return {
          id: cm.cohort_id,
          name: cm.cohorts?.name || 'Cohort',
          code: cm.cohorts?.code || 'N/A',
          programName: cm.programs?.name || 'Program',
          studentCount,
        };
      });

      workload.push({
        mentor,
        activeCohortsCount: mentorCMs.length,
        individualOverridesCount: mentorOverrides.length,
        totalEffectiveMenteesCount: effectiveMenteeKeys.size,
        cohorts: cohortsDetail,
        isEligible: mentor.status !== 'suspended',
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
      const assignmentKey = res.assignmentId || `${input.cohortId}:${input.mentorId}`;
      // In-app notifications
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'New Cohort Mentorship Allocation',
        message: `You have been allocated as lead mentor for ${input.cohortName || 'Cohort'} (${input.programName || 'Academic Program'}).`,
        link: '/mentor/dashboard',
        idempotencyKey: `cohort_mentor_alloc:${assignmentKey}`,
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

    const assignmentKey = data?.assignment_id || `${input.cohortId}:${input.mentorId}`;
    // Trigger in-app notification
    await createNotification({
      recipientId: input.mentorId,
      type: 'system',
      title: 'New Cohort Mentorship Allocation',
      message: `You have been allocated as lead mentor for ${input.cohortName || 'Cohort'} (${input.programName || 'Academic Program'}).`,
      link: '/mentor/dashboard',
      idempotencyKey: `cohort_mentor_alloc:${assignmentKey}`,
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
        idempotencyKey: `cohort_mentor_ended:${input.cohortId}:${input.mentorId}`,
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
        idempotencyKey: `cohort_mentor_ended:${input.cohortId}:${input.mentorId}`,
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
      const assignmentKey = res.assignmentId || `${input.studentId}:${input.mentorId}:${input.programId}`;
      // Notify student
      await createNotification({
        recipientId: input.studentId,
        type: 'system',
        title: 'Personal Academic Mentor Assigned',
        message: `${input.mentorName || 'A mentor'} has been specifically assigned as your dedicated mentor in ${input.programName || 'your program'}.`,
        link: '/student/dashboard',
        idempotencyKey: `ind_mentor_student:${assignmentKey}`,
      });

      // Notify mentor
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'New Individual Mentee Assignment',
        message: `You have been individually assigned to mentor ${input.studentName || 'Student'} in ${input.programName || 'Program'}.`,
        link: '/mentor/dashboard',
        idempotencyKey: `ind_mentor_assigned:${assignmentKey}`,
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

    const assignmentKey = data?.assignment_id || `${input.studentId}:${input.mentorId}:${input.programId}`;
    // In-app notifications
    await Promise.all([
      createNotification({
        recipientId: input.studentId,
        type: 'system',
        title: 'Personal Academic Mentor Assigned',
        message: `${input.mentorName || 'A mentor'} has been specifically assigned as your dedicated mentor in ${input.programName || 'your program'}.`,
        link: '/student/dashboard',
        idempotencyKey: `ind_mentor_student:${assignmentKey}`,
      }),
      createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'New Individual Mentee Assignment',
        message: `You have been individually assigned to mentor ${input.studentName || 'Student'} in ${input.programName || 'Program'}.`,
        link: '/mentor/dashboard',
        idempotencyKey: `ind_mentor_assigned:${assignmentKey}`,
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
          idempotencyKey: `ind_mentor_ended_student:${input.assignmentId}`,
        });
      }
      if (input.mentorId) {
        await createNotification({
          recipientId: input.mentorId,
          type: 'system',
          title: 'Individual Mentorship Concluded',
          message: `Your individual mentorship assignment with ${input.studentName || 'Student'} has concluded.`,
          link: '/mentor/dashboard',
          idempotencyKey: `ind_mentor_ended_mentor:${input.assignmentId}`,
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
        idempotencyKey: `ind_mentor_ended_student:${input.assignmentId}`,
      });
    }

    if (input.mentorId) {
      await createNotification({
        recipientId: input.mentorId,
        type: 'system',
        title: 'Individual Mentorship Concluded',
        message: `Your individual mentorship assignment with ${input.studentName || 'Student'} has concluded.`,
        link: '/mentor/dashboard',
        idempotencyKey: `ind_mentor_ended_mentor:${input.assignmentId}`,
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
