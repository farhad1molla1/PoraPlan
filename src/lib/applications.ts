import { supabase, isSupabaseConfigured } from './supabase';
import type {
  ProgramApplication,
  ProgramApplicationInsert,
  ProgramEnrollment,
  ProgramApplicationWithMeta,
  ProgramEnrollmentWithMeta,
  ApplicationStatus,
  EnrollmentStatus,
} from '../types/database';
import {
  getMockApplications,
  getMockApplicationById,
  createMockApplication,
  adminReviewMockApplication,
  getMockEnrollments,
  updateMockEnrollmentStatus,
  getMockProfile,
  getMockProgramById,
  getMockCohorts,
} from './mockAuthStore';
import { createNotification } from './notifications';

// ==============================================================================
// Helper utilities and Badge Variants
// ==============================================================================

export function getApplicationStatusBadgeVariant(
  status: ApplicationStatus
): 'paper' | 'gold' | 'teal' | 'danger' {
  switch (status) {
    case 'pending':
      return 'paper';
    case 'under_review':
      return 'gold';
    case 'approved':
      return 'teal';
    case 'rejected':
      return 'danger';
    default:
      return 'paper';
  }
}

export function getApplicationStatusLabel(status: ApplicationStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending Review';
    case 'under_review':
      return 'Under Review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Declined';
    default:
      return status;
  }
}

export function getEnrollmentStatusBadgeVariant(
  status: EnrollmentStatus
): 'teal' | 'gold' | 'navy' | 'muted' {
  switch (status) {
    case 'active':
      return 'teal';
    case 'on_hold':
      return 'gold';
    case 'completed':
      return 'navy';
    case 'withdrawn':
      return 'muted';
    default:
      return 'gold';
  }
}

// ==============================================================================
// Applications Service Operations
// ==============================================================================

export async function getApplications(filters?: {
  applicantId?: string;
  programId?: string;
  cohortId?: string;
  status?: string;
  type?: string;
}): Promise<{ applications: ProgramApplicationWithMeta[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const list = getMockApplications(filters);
    const enriched: ProgramApplicationWithMeta[] = list.map((app) => {
      const applicant = getMockProfile(app.applicant_id);
      const program = getMockProgramById(app.program_id);
      const cohorts = getMockCohorts(app.program_id);
      const cohort = app.cohort_id ? cohorts.find((c) => c.id === app.cohort_id) || null : null;
      const reviewer = app.reviewed_by ? getMockProfile(app.reviewed_by) : null;
      const enrollments = getMockEnrollments({ studentId: app.applicant_id, programId: app.program_id });
      const enrollment = enrollments.find((e) => e.application_id === app.id) || null;

      return {
        ...app,
        applicant,
        program,
        cohort,
        reviewer,
        enrollment,
      };
    });

    return { applications: enriched, error: null };
  }

  try {
    let query = (supabase.from('program_applications') as any)
      .select('*, profiles!applicant_id(id, full_name, email, role, poraplan_id, avatar_url, university, department, batch, current_semester, academic_background, expertise, bio, whatsapp_number), programs(id, name, slug, category, publication_status, enrollment_status), cohorts(id, name, code, status, start_date, end_date, capacity), reviewer:profiles!reviewed_by(id, full_name, role)');

    if (filters?.applicantId) {
      query = query.eq('applicant_id', filters.applicantId);
    }
    if (filters?.programId && filters.programId !== 'all') {
      query = query.eq('program_id', filters.programId);
    }
    if (filters?.cohortId && filters.cohortId !== 'all') {
      query = query.eq('cohort_id', filters.cohortId);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }
    if (filters?.type && filters.type !== 'all') {
      query = query.eq('application_type', filters.type);
    }

    query = query.order('submitted_at', { ascending: false });

    const { data, error } = await query;
    if (error) return { applications: [], error };

    const applications: ProgramApplicationWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      applicant_id: row.applicant_id,
      application_type: row.application_type,
      program_id: row.program_id,
      cohort_id: row.cohort_id,
      status: row.status,
      application_message: row.application_message,
      experience: row.experience,
      additional_information: row.additional_information,
      admin_review_note: row.admin_review_note,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_at,
      submitted_at: row.submitted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      applicant: row.profiles,
      program: row.programs,
      cohort: row.cohorts,
      reviewer: row.reviewer,
    }));

    return { applications, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { applications: [], error };
  }
}

export async function getApplicationById(
  id: string
): Promise<{ application: ProgramApplicationWithMeta | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const app = getMockApplicationById(id);
    if (!app) return { application: null, error: new Error('Application not found') };

    const applicant = getMockProfile(app.applicant_id);
    const program = getMockProgramById(app.program_id);
    const cohorts = getMockCohorts(app.program_id);
    const cohort = app.cohort_id ? cohorts.find((c) => c.id === app.cohort_id) || null : null;
    const reviewer = app.reviewed_by ? getMockProfile(app.reviewed_by) : null;

    return {
      application: {
        ...app,
        applicant,
        program,
        cohort,
        reviewer,
      },
      error: null,
    };
  }

  try {
    const { data, error } = await (supabase.from('program_applications') as any)
      .select('*, profiles!applicant_id(*), programs(*), cohorts(*), reviewer:profiles!reviewed_by(*)')
      .eq('id', id)
      .maybeSingle();

    if (error) return { application: null, error };
    if (!data) return { application: null, error: null };

    return {
      application: {
        id: data.id,
        applicant_id: data.applicant_id,
        application_type: data.application_type,
        program_id: data.program_id,
        cohort_id: data.cohort_id,
        status: data.status,
        application_message: data.application_message,
        experience: data.experience,
        additional_information: data.additional_information,
        admin_review_note: data.admin_review_note,
        reviewed_by: data.reviewed_by,
        reviewed_at: data.reviewed_at,
        submitted_at: data.submitted_at,
        created_at: data.created_at,
        updated_at: data.updated_at,
        applicant: data.profiles,
        program: data.programs,
        cohort: data.cohorts,
        reviewer: data.reviewer,
      },
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { application: null, error };
  }
}

export async function submitApplication(
  params: ProgramApplicationInsert
): Promise<{ application: ProgramApplication | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return createMockApplication(params);
  }

  try {
    // 1. Check for existing active application to provide clean client error
    const { data: existing } = await supabase
      .from('program_applications')
      .select('id, status')
      .eq('applicant_id', params.applicant_id)
      .eq('program_id', params.program_id)
      .in('status', ['pending', 'under_review', 'approved'])
      .limit(1);

    if (existing && existing.length > 0) {
      return {
        application: null,
        error: new Error(`You already have an active application (${existing[0].status.replace('_', ' ')}) for this program.`),
      };
    }

    const { data, error } = await supabase
      .from('program_applications')
      .insert({
        applicant_id: params.applicant_id,
        application_type: params.application_type,
        program_id: params.program_id,
        cohort_id: params.cohort_id || null,
        application_message: params.application_message?.trim() || null,
        experience: params.experience?.trim() || null,
        additional_information: params.additional_information?.trim() || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) return { application: null, error };

    const createdApp = data as ProgramApplication;

    // Send in-app confirmation notification to applicant
    await createNotification({
      recipientId: params.applicant_id,
      actorId: null,
      type: 'system',
      title: 'Application Received',
      message: 'Your program application has been submitted and is pending administrative review.',
      link: params.application_type === 'student' ? '/student/applications' : '/mentor/applications',
    });

    return { application: createdApp, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { application: null, error };
  }
}

export async function adminReviewApplication(params: {
  applicationId: string;
  decision: 'under_review' | 'approved' | 'rejected';
  reviewNote?: string;
  adminId?: string;
}): Promise<{ success: boolean; message: string; enrollmentId?: string; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return adminReviewMockApplication(
      params.adminId || 'mock-admin-ppa001',
      params.applicationId,
      params.decision,
      params.reviewNote
    );
  }

  try {
    const { data, error } = await supabase.rpc('admin_review_application', {
      p_application_id: params.applicationId,
      p_decision: params.decision,
      p_review_note: params.reviewNote?.trim() || null,
    });

    if (error) {
      return { success: false, message: error.message, error };
    }

    const res = data as { success?: boolean; message?: string; status?: string; enrollment_id?: string };

    // Fetch the application row to deliver targeted notification
    const { data: appRow } = await supabase
      .from('program_applications')
      .select('applicant_id, application_type')
      .eq('id', params.applicationId)
      .single();

    if (appRow) {
      if (params.decision === 'approved') {
        await createNotification({
          recipientId: appRow.applicant_id,
          actorId: params.adminId || null,
          type: 'system',
          title: appRow.application_type === 'student' ? 'Application Approved — You Are Enrolled!' : 'Mentor Application Approved',
          message: appRow.application_type === 'student'
            ? 'Your application has been approved by the administration and your active enrollment has been created.'
            : 'Your mentor application has been approved! You are eligible to mentor in this program. Cohort assignment will follow.',
          link: appRow.application_type === 'student' ? '/student/applications' : '/mentor/applications',
        });
      } else if (params.decision === 'rejected') {
        await createNotification({
          recipientId: appRow.applicant_id,
          actorId: params.adminId || null,
          type: 'system',
          title: 'Application Update',
          message: 'Your program application has been reviewed and was not accepted for this intake.',
          link: appRow.application_type === 'student' ? '/student/applications' : '/mentor/applications',
        });
      }
    }

    return {
      success: Boolean(res?.success),
      message: res?.message || 'Application updated successfully.',
      enrollmentId: res?.enrollment_id,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, message: error.message, error };
  }
}

// ==============================================================================
// Enrollments Service Operations
// ==============================================================================

export async function getEnrollments(filters?: {
  studentId?: string;
  programId?: string;
  cohortId?: string;
  status?: string;
}): Promise<{ enrollments: ProgramEnrollmentWithMeta[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    const list = getMockEnrollments(filters);
    const enriched: ProgramEnrollmentWithMeta[] = list.map((enr) => {
      const student = getMockProfile(enr.student_id);
      const program = getMockProgramById(enr.program_id);
      const cohorts = getMockCohorts(enr.program_id);
      const cohort = enr.cohort_id ? cohorts.find((c) => c.id === enr.cohort_id) || null : null;
      const application = enr.application_id ? getMockApplicationById(enr.application_id) : null;

      return {
        ...enr,
        student,
        program,
        cohort,
        application,
      };
    });

    return { enrollments: enriched, error: null };
  }

  try {
    let query = (supabase.from('program_enrollments') as any)
      .select('*, profiles!student_id(id, full_name, email, role, poraplan_id, avatar_url, university, department, batch, current_semester, whatsapp_number), programs(id, name, slug, category), cohorts(id, name, code, status, start_date, end_date), program_applications(id, status, submitted_at)');

    if (filters?.studentId) {
      query = query.eq('student_id', filters.studentId);
    }
    if (filters?.programId && filters.programId !== 'all') {
      query = query.eq('program_id', filters.programId);
    }
    if (filters?.cohortId && filters.cohortId !== 'all') {
      query = query.eq('cohort_id', filters.cohortId);
    }
    if (filters?.status && filters.status !== 'all') {
      query = query.eq('status', filters.status);
    }

    query = query.order('enrolled_at', { ascending: false });

    const { data, error } = await query;
    if (error) return { enrollments: [], error };

    const enrollments: ProgramEnrollmentWithMeta[] = (data || []).map((row: any) => ({
      id: row.id,
      student_id: row.student_id,
      program_id: row.program_id,
      cohort_id: row.cohort_id,
      application_id: row.application_id,
      status: row.status,
      enrolled_at: row.enrolled_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      student: row.profiles,
      program: row.programs,
      cohort: row.cohorts,
      application: row.program_applications,
    }));

    return { enrollments, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { enrollments: [], error };
  }
}

export async function updateEnrollmentStatus(
  id: string,
  status: EnrollmentStatus
): Promise<{ enrollment: ProgramEnrollment | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return updateMockEnrollmentStatus(id, status);
  }

  try {
    const { data, error } = await supabase
      .from('program_enrollments')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { enrollment: null, error };
    return { enrollment: data as ProgramEnrollment, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { enrollment: null, error };
  }
}
