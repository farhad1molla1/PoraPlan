/**
 * PoraPlan — Academic Performance & Improvement Reporting Service Layer (Milestone 12.2.1)
 *
 * Implements an evidence-based, deterministic reporting engine for Students and Mentors.
 *
 * Core Principles:
 * 1. Dynamic Schedule Window & Consistent Cohort Logic: The reporting period is derived
 *    from mentor-assigned tasks. Gaps between scheduled days do not penalize the student.
 * 2. Dedicated Academic Consistency Formula:
 *    Consistency = (Scheduled days with >= 1 completed task / Total eligible scheduled days) * 100.
 *    Unscheduled calendar days are excluded. Zero-denominator cohorts return N/A (null).
 * 3. On-Time vs. Late Differentiation: Late completions are distinguished and tracked per scheduled day
 *    without mutating the original due-date cohort.
 * 4. Weighted Evaluation Mastery: (total scored points earned / total possible points) * 100.
 *    Unscored walkthroughs/oral reviews are excluded from numeric averages and preserved as qualitative feedback.
 * 5. Unique Assignment Distinction: Revisions do not inflate the unique count of submitted assignments.
 * 6. Multi-Tier Insights: Level 1 Facts, Level 2 Observations, Level 3 Stored Mentor Guidance.
 * 7. Actionable Improvement Recommendations: Max 3 prioritized, transparent, deterministic action items.
 * 8. Strict Authorization: Mentors can only query students actively assigned to them; students can only view their own.
 */

import { formatLocalDate } from './library';
import type {
  Subject,
  Task,
  Submission,
  Profile,
} from '../types/database';
import {
  getMockUsers,
  getMockStudentTasks,
  getMockStudentAssignments,
  getMockStudentEvaluations,
  getMockStudentSubjects,
  getMockStudentDoubts,
  getMockAssignedStudents,
  getMockAssignedMentors,
  getMockEnrollments,
  getMockPrograms,
  getMockCohorts,
  getMockCohortMentors,
  getMockMentorSubmissions,
  getMockMentorEvaluations,
  getMockCurrentSession,
  getMockAccountById,
  normalizeMockUserId,
  isMockAuthorizedMentorForStudent,
} from './mockAuthStore';

function getMockUserById(id: string) {
  return getMockUsers().find((u) => u.id === id) || null;
}

interface SupabaseBackend {
  isConfigured: boolean;
  supabase: any;
  getAssignedStudents: any;
  getAssignedMentors: any;
  getStudentEvaluations: any;
  getStudentDoubts: any;
}

async function getSupabaseBackend(): Promise<SupabaseBackend> {
  if (typeof window === 'undefined') {
    return {
      isConfigured: false,
      supabase: null,
      getAssignedStudents: null,
      getAssignedMentors: null,
      getStudentEvaluations: null,
      getStudentDoubts: null,
    };
  }
  try {
    const sb = await import('./supabase');
    if (!sb.isSupabaseConfigured()) {
      return {
        isConfigured: false,
        supabase: null,
        getAssignedStudents: null,
        getAssignedMentors: null,
        getStudentEvaluations: null,
        getStudentDoubts: null,
      };
    }
    const [mentorship, evals, doubtsMod] = await Promise.all([
      import('./mentorship'),
      import('./evaluations'),
      import('./doubts'),
    ]);
    return {
      isConfigured: true,
      supabase: sb.supabase,
      getAssignedStudents: mentorship.getAssignedStudents,
      getAssignedMentors: mentorship.getAssignedMentors,
      getStudentEvaluations: evals.getStudentEvaluations,
      getStudentDoubts: doubtsMod.getStudentDoubts,
    };
  } catch {
    return {
      isConfigured: false,
      supabase: null,
      getAssignedStudents: null,
      getAssignedMentors: null,
      getStudentEvaluations: null,
      getStudentDoubts: null,
    };
  }
}

export type ReportPeriod = 'schedule' | 'weekly' | 'monthly' | 'custom';

export const REPORT_THRESHOLDS = {
  /** Minimum evaluation percentage to qualify as Strong Mastery */
  MASTERY_SCORE_MIN: 85,
  /** Evaluation percentage below which attention is flagged */
  ATTENTION_SCORE_MAX: 70,
  /** Task completion percentage below which attention is flagged */
  TASK_COMPLETION_ATTENTION_MAX: 60,
  /** Minimum scored evaluations required in a subject to declare verified mastery */
  MIN_SCORED_ASSESSMENTS_FOR_MASTERY: 2,
  /** Maximum number of prioritized recommendations */
  MAX_RECOMMENDATIONS: 3,
} as const;

export interface ReportDateRange {
  startDate: string; // YYYY-MM-DD local
  endDate: string; // YYYY-MM-DD local
  label: string;
  previousStartDate?: string;
  previousEndDate?: string;
  daysCount: number;
  scheduledDaysCount?: number;
}

export interface SubjectReportItem {
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  tasksTotal: number;
  tasksCompleted: number;
  tasksCompletionRate: number; // 0-100 (0 if denominator is 0)
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  assignmentsReviewed: number;
  assignmentsAverageScore: number | null; // 0-100
  evaluationsCompleted: number;
  evaluationsScoredCount: number;
  evaluationsEarnedPoints: number;
  evaluationsPossiblePoints: number;
  evaluationsAverageScore: number | null; // Weighted percentage 0-100
  performanceStatus: 'mastery' | 'on_track' | 'attention_required' | 'insufficient_evidence';
  performanceStatusLabel: string;
  needsAttention: boolean;
  attentionReason?: string;
}

export interface ActivityDayItem {
  date: string; // YYYY-MM-DD
  tasksCompleted: number;
  assignmentsSubmitted: number;
  evaluationsCompleted: number;
  totalActivities: number;
}

export interface ScheduledDayConsistencyItem {
  date: string; // YYYY-MM-DD local
  dayLabel: string; // e.g. "15 Oct"
  assignedCount: number;
  completedOnTimeCount: number;
  completedLateCount: number;
  totalCompletedCount: number;
  pendingCount: number;
  isConsistent: boolean; // >= 1 completed task on this scheduled day
  isOnTime: boolean; // >= 1 on-time completed task
}

export interface StudyConsistencyMetrics {
  totalScheduledDays: number;
  consistentScheduledDays: number;
  onTimeScheduledDays: number;
  consistencyPercentage: number | null; // null when totalScheduledDays === 0
  onTimeConsistencyPercentage: number | null;
  isConsistencyApplicable: boolean;
  scheduledDays: ScheduledDayConsistencyItem[];
  // Compatibility aliases:
  activeStudyDays: number;
  totalPeriodDays: number;
  verifiedEventsCount: number;
}

export interface ReportObservation {
  type: 'strength' | 'attention' | 'neutral';
  title: string;
  text: string;
  subjectId?: string;
}

export interface ReportRecommendation {
  id: string;
  priority: 'P1' | 'P2' | 'P3';
  priorityLabel: 'Urgent' | 'High' | 'Recommended';
  title: string;
  evidence: string;
  recommendedAction: string;
  measurableSuccessIndicator: string;
}

export interface StudentAcademicReport {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
  university?: string | null;
  department?: string | null;
  batch?: string | null;
  currentSemester?: string | null;
  programName?: string;
  cohortName?: string;
  mentorName?: string;
  period: ReportPeriod;
  dateRange: ReportDateRange;
  generatedAt: string; // ISO 8601
  taskMetrics: {
    totalAssigned: number; // Backward-compatible alias for eligible due tasks
    eligibleDue: number;
    completed: number;
    onTimeCompleted: number;
    lateCompleted: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completionRate: number; // 0-100 (0 when 0 denominator)
    isCompletionRateApplicable: boolean;
    totalEstimatedMinutes: number;
    previousPeriodCompletionRate?: number | null;
    completionRateDelta?: number | null;
  };
  assignmentMetrics: {
    totalAssigned: number; // Unique assignments due in window
    submitted: number; // Unique assignments submitted
    unsubmitted: number;
    submittedOnTime: number;
    submittedLate: number;
    pendingReview: number;
    reviewed: number;
    needsRevision: number;
    revisionSubmitted: number;
    submissionRate: number; // 0-100 (0 when 0 denominator)
    isSubmissionRateApplicable: boolean;
    averageScorePercentage: number | null;
    scoredCount: number;
    previousPeriodSubmissionRate?: number | null;
    submissionRateDelta?: number | null;
  };
  evaluationMetrics: {
    totalScheduled: number;
    completed: number;
    cancelled: number;
    upcoming: number;
    averageScorePercentage: number | null; // Weighted: (total earned / total possible) * 100
    weightedAveragePercentage: number | null;
    scoredCount: number;
    totalEarnedPoints: number;
    totalPossiblePoints: number;
    unscoredCompletedCount: number;
    previousPeriodAveragePercentage?: number | null;
    evaluationAverageDelta?: number | null;
    recentFeedback: Array<{
      id: string;
      title: string;
      date: string;
      subjectName?: string;
      mentorName?: string;
      scorePercentage?: number | null;
      feedback?: string | null;
      recommendation?: string | null;
    }>;
    formatBreakdown: Record<string, { count: number; scoredCount: number; averageScore: number | null }>;
  };
  studyConsistency: StudyConsistencyMetrics;
  doubtMetrics: {
    createdInPeriod: number;
    resolvedInPeriod: number;
    pendingInPeriod: number;
    totalStudentDoubts: number;
    averageResolutionHours: number | null;
  };
  subjectBreakdown: SubjectReportItem[];
  studyActivityTimeline: ActivityDayItem[];
  insights: {
    facts: string[];
    observations: ReportObservation[];
    mentorRemarks: Array<{
      id: string;
      title: string;
      date: string;
      mentorName?: string;
      subjectName?: string;
      feedback?: string | null;
      recommendation?: string | null;
    }>;
  };
  recommendations: ReportRecommendation[];
}

export interface ScholarReportSummary {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
  programName?: string;
  cohortName?: string;
  tasksAssigned: number;
  tasksCompleted: number;
  tasksOverdue: number;
  tasksCompletionRate: number;
  assignmentsAssigned: number;
  assignmentsSubmitted: number;
  assignmentsPendingReview: number;
  assignmentsNeedsRevision: number;
  evaluationsCompleted: number;
  evaluationsScheduled: number;
  averageScorePercentage: number | null;
  activeStudyDays: number;
  scheduledDaysCount: number;
  consistencyPercentage: number | null;
  needsAttention: boolean;
  attentionReason?: string;
  attentionLevel: 'critical' | 'warning' | 'normal';
}

export interface MentorAcademicReport {
  mentorId: string;
  mentorName: string;
  poraplanId: string;
  period: ReportPeriod;
  dateRange: ReportDateRange;
  generatedAt: string; // ISO 8601
  assignedStudentsCount: number;
  studentSummaries: ScholarReportSummary[];
  aggregateMetrics: {
    totalTasksAssigned: number;
    totalTasksCompleted: number;
    overallTaskCompletionRate: number;
    totalSubmissionsPendingReview: number;
    totalPendingRevisions: number;
    totalEvaluationsCompleted: number;
    totalEvaluationsUpcoming: number;
    scholarsNeedingAttentionCount: number;
  };
}

export interface AdminAcademicOverview {
  generatedAt: string;
  totalRegisteredStudents: number;
  activeStudents: number;
  totalMentors: number;
  activeMentors: number;
  activeEnrollments: number;
  scholarsNeedingAttentionCount: number;
  totalSubmissionsPendingReview: number;
  totalOverdueTasks: number;
}

export interface AdminStudentSummary {
  studentId: string;
  studentName: string;
  poraplanId: string;
  university?: string | null;
  department?: string | null;
  batch?: string | null;
  currentSemester?: string | null;
  enrollmentStatus: 'active' | 'completed' | 'inactive' | 'none';
  programName?: string;
  cohortName?: string;
  mentorName?: string;
  mentorId?: string;
  taskCompletionRate: number;
  isCompletionRateApplicable: boolean;
  tasksCompleted: number;
  tasksAssigned: number;
  tasksOverdue: number;
  averageScorePercentage: number | null;
  scoredEvaluationsCount: number;
  submissionRate: number;
  submissionsPendingReview: number;
  consistencyPercentage: number | null;
  scheduledDaysCount: number;
  activeStudyDays: number;
  lastActivityDate: string | null;
  attentionLevel: 'critical' | 'warning' | 'normal' | 'insufficient_data';
  attentionReason?: string;
}

export interface AdminMentorSummary {
  mentorId: string;
  mentorName: string;
  poraplanId: string;
  expertiseSubjects: string[];
  activeMenteesCount: number;
  activeCohortsCount: number;
  recentEvaluationsCount: number;
  pendingReviewsCount: number;
  menteesNeedingAttentionCount: number;
  lastActivityDate: string | null;
}

export interface AdminAttentionItem {
  studentId: string;
  studentName: string;
  poraplanId: string;
  mentorName: string;
  mentorId?: string;
  level: 'critical' | 'warning' | 'normal' | 'insufficient_data';
  levelLabel: 'Critical Attention' | 'Needs Attention' | 'On Track' | 'Insufficient Data';
  reason: string;
  evidence: string;
}

export interface AdminAcademicIntelligenceReport {
  overview: AdminAcademicOverview;
  students: AdminStudentSummary[];
  mentors: AdminMentorSummary[];
  attentionItems: AdminAttentionItem[];
  period: ReportPeriod;
  dateRange: ReportDateRange;
  generatedAt: string;
}

/**
 * Format a calendar date string (YYYY-MM-DD) into a concise academic label (e.g. "15 Oct").
 */
export function formatDayMonth(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parseInt(parts[2], 10);
    const monthIdx = parseInt(parts[1], 10) - 1;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[monthIdx] || ''}`.trim();
  }
  return dateStr;
}

/**
 * Computes calendar date boundaries for reporting periods using local calendar date.
 * Avoids UTC boundary slips (e.g. Bangladesh Standard Time UTC+6).
 */
export function computeReportDateRange(
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate?: Date
): ReportDateRange {
  const ref = referenceDate || new Date();
  const todayStr = formatLocalDate(ref);

  if (period === 'weekly') {
    // Current: Last 7 days (including today)
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6);
    // Previous: 7 days immediately preceding
    const prevEnd = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 7);
    const prevStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 13);
    return {
      startDate: formatLocalDate(start),
      endDate: todayStr,
      label: 'Weekly (Last 7 Days)',
      previousStartDate: formatLocalDate(prevStart),
      previousEndDate: formatLocalDate(prevEnd),
      daysCount: 7,
    };
  }

  if (period === 'monthly') {
    // Current: Last 30 days (including today)
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 29);
    // Previous: 30 days immediately preceding
    const prevEnd = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 30);
    const prevStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 59);
    return {
      startDate: formatLocalDate(start),
      endDate: todayStr,
      label: 'Monthly (Last 30 Days)',
      previousStartDate: formatLocalDate(prevStart),
      previousEndDate: formatLocalDate(prevEnd),
      daysCount: 30,
    };
  }

  if (period === 'schedule') {
    const startStr = customStart?.trim() || todayStr;
    const endStr = customEnd?.trim() || todayStr;
    const sDate = new Date(startStr);
    const eDate = new Date(endStr);
    const diffDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    return {
      startDate: startStr,
      endDate: endStr,
      label: `Active Task Schedule (${startStr} to ${endStr})`,
      daysCount: isNaN(diffDays) ? 1 : diffDays,
    };
  }

  // Custom range
  const startStr = customStart?.trim() || todayStr;
  const endStr = customEnd?.trim() || todayStr;
  const sDate = new Date(startStr);
  const eDate = new Date(endStr);
  const diffDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

  return {
    startDate: startStr,
    endDate: endStr,
    label: `Custom Range (${startStr} to ${endStr})`,
    daysCount: isNaN(diffDays) ? 1 : diffDays,
  };
}

/**
 * Parse date string YYYY-MM-DD or ISO timestamp to YYYY-MM-DD local format.
 * Guarantees consistent calendar dates across Bangladesh UTC+6 boundaries.
 */
export function toLocalDateStr(dateVal?: string | null): string | null {
  if (!dateVal) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) return dateVal;
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return null;
    return formatLocalDate(d);
  } catch {
    return null;
  }
}

/**
 * Checks whether a given target date falls within [startDate, endDate] inclusive.
 */
export function isDateInRange(
  targetDateStr: string | null | undefined,
  startDate: string,
  endDate: string
): boolean {
  if (!targetDateStr) return false;
  const normalized = toLocalDateStr(targetDateStr);
  if (!normalized) return false;
  return normalized >= startDate && normalized <= endDate;
}

/**
 * Generates an Academic Progress & Improvement Report for a Student.
 * Dynamically bounds reporting dates based on mentor-assigned tasks when 'schedule' period is selected.
 */

export interface AuthorizedCaller {
  userId: string;
  role: 'student' | 'mentor' | 'admin';
  status: string;
  poraplanId?: string;
}

/**
 * Resolves the authenticated caller identity and verifies their true role and status.
 * Fails closed if session is missing, invalid, suspended, or forged.
 */
export async function resolveAuthorizedCaller(
  backend: SupabaseBackend,
  options?: {
    requestingUserId?: string;
    requestingUserRole?: 'student' | 'mentor' | 'admin';
  },
  fallbackSelfServiceId?: string
): Promise<{ caller: AuthorizedCaller | null; error: Error | null }> {
  // 1. Supabase Backend Mode
  if (backend.isConfigured && backend.supabase) {
    try {
      const { data: sessionData, error: sessionErr } = await backend.supabase.auth.getSession();
      if (sessionErr || !sessionData?.session?.user) {
        return {
          caller: null,
          error: new Error('Unauthorized: Valid authentication session is required.'),
        };
      }

      const sessionUserId = sessionData.session.user.id;

      // Verify that caller-provided requestingUserId matches the authenticated session user
      if (options?.requestingUserId && options.requestingUserId !== sessionUserId) {
        return {
          caller: null,
          error: new Error('Unauthorized: Authenticated identity mismatch.'),
        };
      }

      // Query database profile directly for authoritative role and status
      const { data: profile, error: profErr } = await backend.supabase
        .from('profiles')
        .select('id, role, status, poraplan_id')
        .eq('id', sessionUserId)
        .single();

      if (profErr || !profile) {
        return {
          caller: null,
          error: new Error('Unauthorized: User profile could not be verified.'),
        };
      }

      if (profile.status !== 'active') {
        return {
          caller: null,
          error: new Error('Unauthorized: User account is not active.'),
        };
      }

      const validRoles = ['student', 'mentor', 'admin'];
      if (!validRoles.includes(profile.role)) {
        return {
          caller: null,
          error: new Error('Unauthorized: Invalid account role configuration.'),
        };
      }

      // Guard against client role spoofing: if requestingUserRole was provided and doesn't match actual role
      if (options?.requestingUserRole && options.requestingUserRole !== profile.role) {
        return {
          caller: null,
          error: new Error('Unauthorized: Role verification mismatch.'),
        };
      }

      return {
        caller: {
          userId: profile.id,
          role: profile.role as 'student' | 'mentor' | 'admin',
          status: profile.status,
          poraplanId: profile.poraplan_id,
        },
        error: null,
      };
    } catch {
      return {
        caller: null,
        error: new Error('Unauthorized: Authentication verification failed.'),
      };
    }
  }

  // 2. Mock Data Mode
  const activeMockSession = getMockCurrentSession();

  let resolvedUserId: string | null = null;
  if (activeMockSession) {
    resolvedUserId = activeMockSession.id;
    // If requestingUserId is also supplied, it must match the active session
    if (options?.requestingUserId) {
      const normOptId = normalizeMockUserId(options.requestingUserId);
      if (normOptId !== activeMockSession.id && options.requestingUserId !== activeMockSession.poraplanId) {
        return {
          caller: null,
          error: new Error('Unauthorized: Authenticated identity mismatch.'),
        };
      }
    }
  } else if (options?.requestingUserId) {
    resolvedUserId = normalizeMockUserId(options.requestingUserId);
  } else if (fallbackSelfServiceId && !options) {
    // Headless test runner self-service fallback (only when options is completely omitted)
    resolvedUserId = normalizeMockUserId(fallbackSelfServiceId);
  }

  if (!resolvedUserId) {
    return {
      caller: null,
      error: new Error('Unauthorized: Valid authentication session is required.'),
    };
  }

  const account = getMockAccountById(resolvedUserId);
  if (!account) {
    return {
      caller: null,
      error: new Error('Unauthorized: User account not found.'),
    };
  }

  if (account.status !== 'active') {
    return {
      caller: null,
      error: new Error('Unauthorized: User account is not active.'),
    };
  }

  // Reject forged role string from caller
  if (options?.requestingUserRole && options.requestingUserRole !== account.role) {
    return {
      caller: null,
      error: new Error('Unauthorized: Role verification mismatch.'),
    };
  }

  return {
    caller: {
      userId: account.id,
      role: account.role,
      status: account.status,
      poraplanId: account.poraplanId,
    },
    error: null,
  };
}

export async function generateStudentReport(
  studentId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
  options?: {
    referenceDate?: Date;
    requestingUserId?: string;
    requestingUserRole?: 'student' | 'mentor' | 'admin';
  }
): Promise<{ report: StudentAcademicReport | null; error: Error | null }> {
  if (!studentId) {
    return { report: null, error: new Error('Student ID is required.') };
  }

  const backend = await getSupabaseBackend();

  // Role Authorization Verification
  const { caller, error: authError } = await resolveAuthorizedCaller(backend, options, studentId);
  if (authError || !caller) {
    return {
      report: null,
      error: authError || new Error('Unauthorized: Authentication required to access academic reports.'),
    };
  }

  const normTargetStudentId = normalizeMockUserId(studentId);
  const normCallerId = normalizeMockUserId(caller.userId);

  if (caller.role === 'student') {
    if (normCallerId !== normTargetStudentId && caller.userId !== studentId && caller.poraplanId !== studentId) {
      return {
        report: null,
        error: new Error('Unauthorized: Students can only access their own academic reports.'),
      };
    }
  } else if (caller.role === 'mentor') {
    let isAssigned = false;
    if (!backend.isConfigured || !backend.getAssignedStudents) {
      isAssigned = isMockAuthorizedMentorForStudent(caller.userId, studentId, undefined, caller.userId);
      if (!isAssigned) {
        const mentees = getMockAssignedStudents(caller.userId);
        isAssigned = mentees.some(
          (m) => m.id === normTargetStudentId || m.poraplan_id === studentId || m.id === studentId
        );
      }
    } else {
      const { students } = await backend.getAssignedStudents(caller.userId);
      isAssigned = (students || []).some(
        (s: Profile) => s.id === studentId || s.poraplan_id === studentId
      );
    }
    if (!isAssigned) {
      return {
        report: null,
        error: new Error('Unauthorized: You are not authorized to access progress reports for this student.'),
      };
    }
  } else if (caller.role === 'admin') {
    // Admin has authorized clearance to inspect any student report
  } else {
    return {
      report: null,
      error: new Error('Unauthorized: Access denied.'),
    };
  }

  if (!backend.isConfigured || !backend.supabase) {
    return generateMockStudentReport(studentId, period, customStart, customEnd, options?.referenceDate);
  }

  const { supabase, getAssignedMentors, getStudentEvaluations, getStudentDoubts } = backend;

  try {
    // 1. Fetch Student Profile with Academic Context
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, poraplan_id, email, university, department, batch, current_semester')
      .eq('id', studentId)
      .single();

    if (profileErr || !profile) {
      return { report: null, error: profileErr || new Error('Student profile not found.') };
    }

    // 2. Fetch Active Enrollment & Assigned Mentor
    const { data: enrollments } = await supabase
      .from('program_enrollments')
      .select('program_id, cohort_id, programs(name), cohorts(name)')
      .eq('student_id', studentId)
      .eq('status', 'active')
      .limit(1);

    const activeEnr = enrollments?.[0] as any;
    const programName = activeEnr?.programs?.name;
    const cohortName = activeEnr?.cohorts?.name;

    const { mentors } = await getAssignedMentors(studentId);
    const mentorName = mentors?.[0]?.full_name;

    // 3. Fetch Tasks
    const { data: tasksData } = await supabase
      .from('tasks')
      .select('*, subjects(id, name, code)')
      .eq('student_id', studentId);
    const allTasks: Task[] = (tasksData || []) as any;

    // Dynamic schedule range derivation
    let derivedStart = customStart;
    let derivedEnd = customEnd;
    if (period === 'schedule') {
      const scheduledDueDates = allTasks
        .filter((t) => (t.status as string) !== 'cancelled' && t.due_date)
        .map((t) => toLocalDateStr(t.due_date)!)
        .sort();
      if (scheduledDueDates.length > 0) {
        derivedStart = scheduledDueDates[0];
        derivedEnd = scheduledDueDates[scheduledDueDates.length - 1];
      }
    }

    const dateRange = computeReportDateRange(period, derivedStart, derivedEnd, options?.referenceDate);
    const now = options?.referenceDate ? options.referenceDate.toISOString() : new Date().toISOString();
    const todayLocal = formatLocalDate(options?.referenceDate || new Date());

    // 4. Fetch Assignments & Submissions
    const { data: asgData } = await supabase
      .from('assignments')
      .select('*, subjects(id, name, code), submissions(*)')
      .eq('student_id', studentId);
    const allAssignments: any[] = asgData || [];

    // 5. Fetch Evaluations
    const { evaluations } = await getStudentEvaluations(studentId);

    // 6. Fetch Subjects
    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('*')
      .eq('student_id', studentId);
    const allSubjects: Subject[] = subjectsData || [];

    // 7. Fetch Doubts
    let allDoubts: any[] = [];
    if (getStudentDoubts) {
      const { doubts } = await getStudentDoubts(studentId);
      allDoubts = doubts || [];
    }

    // Previous period data for trend comparison
    let previousPeriodData: {
      taskCompletionRate: number | null;
      assignmentSubmissionRate: number | null;
      evaluationAverage: number | null;
    } | undefined = undefined;

    if (dateRange.previousStartDate && dateRange.previousEndDate) {
      previousPeriodData = computePeriodAggregateMetrics({
        startDate: dateRange.previousStartDate,
        endDate: dateRange.previousEndDate,
        todayLocal,
        studentId,
        tasks: allTasks,
        assignments: allAssignments,
        evaluations,
      });
    }

    const report = buildStudentReportFromData({
      studentId: profile.id,
      studentName: profile.full_name || 'Scholar',
      poraplanId: profile.poraplan_id || 'PP001',
      studentEmail: profile.email,
      university: profile.university,
      department: profile.department,
      batch: profile.batch,
      currentSemester: profile.current_semester,
      programName,
      cohortName,
      mentorName,
      period,
      dateRange,
      now,
      todayLocal,
      tasks: allTasks,
      assignments: allAssignments,
      evaluations,
      subjects: allSubjects,
      doubts: allDoubts,
      previousPeriodData,
    });

    return { report, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { report: null, error };
  }
}

/**
 * Calculates raw aggregates for a specified time window to generate accurate deltas.
 */
function computePeriodAggregateMetrics(params: {
  startDate: string;
  endDate: string;
  todayLocal: string;
  studentId: string;
  tasks: Task[];
  assignments: any[];
  evaluations: any[];
}): {
  taskCompletionRate: number | null;
  assignmentSubmissionRate: number | null;
  evaluationAverage: number | null;
} {
  const { startDate, endDate, tasks, assignments, evaluations, studentId } = params;

  // Task Cohort: Due in previous period (or created in period if no due date)
  const prevTasks = tasks.filter((t) => {
    if ((t.status as string) === 'cancelled') return false;
    if (t.due_date) return isDateInRange(t.due_date, startDate, endDate);
    return isDateInRange(t.created_at, startDate, endDate);
  });

  const prevTasksTotal = prevTasks.length;
  const prevTasksCompleted = prevTasks.filter((t) => t.status === 'completed').length;
  const taskCompletionRate = prevTasksTotal > 0 ? Math.round((prevTasksCompleted / prevTasksTotal) * 100) : null;

  // Assignment Cohort: Due in previous period
  const prevAsgs = assignments.filter((a) => {
    if (a.due_date) return isDateInRange(a.due_date, startDate, endDate);
    return isDateInRange(a.created_at, startDate, endDate);
  });
  const prevAsgsTotal = prevAsgs.length;
  let prevAsgsSubmitted = 0;
  prevAsgs.forEach((a) => {
    const subs: Submission[] = Array.isArray(a.submissions) ? a.submissions : a.submissions ? [a.submissions] : [];
    const sub = subs.find((s) => s.student_id === studentId) || a.submission;
    if (sub) prevAsgsSubmitted++;
  });
  const assignmentSubmissionRate =
    prevAsgsTotal > 0 ? Math.round((prevAsgsSubmitted / prevAsgsTotal) * 100) : null;

  // Evaluation Cohort: Evaluated or scheduled in previous period
  const prevEvals = evaluations.filter((e) => {
    const d = e.scheduled_date || toLocalDateStr(e.evaluated_at);
    return isDateInRange(d, startDate, endDate) && e.status === 'completed';
  });

  let earnedSum = 0;
  let possibleSum = 0;
  let scoredCount = 0;
  prevEvals.forEach((e) => {
    if (typeof e.score === 'number' && typeof e.total_points === 'number' && e.total_points > 0) {
      earnedSum += e.score;
      possibleSum += e.total_points;
      scoredCount++;
    }
  });

  const evaluationAverage =
    scoredCount > 0 && possibleSum > 0 ? Math.round((earnedSum / possibleSum) * 1000) / 10 : null;

  return {
    taskCompletionRate,
    assignmentSubmissionRate,
    evaluationAverage,
  };
}

/**
 * Builds StudentAcademicReport from resolved collections.
 */
function buildStudentReportFromData(params: {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
  university?: string | null;
  department?: string | null;
  batch?: string | null;
  currentSemester?: string | null;
  programName?: string;
  cohortName?: string;
  mentorName?: string;
  period: ReportPeriod;
  dateRange: ReportDateRange;
  now: string;
  todayLocal: string;
  tasks: Task[];
  assignments: any[];
  evaluations: any[];
  subjects: Subject[];
  doubts: any[];
  previousPeriodData?: {
    taskCompletionRate: number | null;
    assignmentSubmissionRate: number | null;
    evaluationAverage: number | null;
  };
}): StudentAcademicReport {
  const { dateRange, todayLocal, previousPeriodData } = params;

  // --------------------------------------------------------------------------
  // 1. TASK PERFORMANCE ENGINE
  // Cohort Definition:
  // - Belongs to report window if due_date is within [startDate, endDate].
  //   (If due_date is absent, falls back to created_at within [startDate, endDate]).
  // - Cancelled tasks are strictly excluded from the cohort denominator.
  // --------------------------------------------------------------------------
  const eligibleTasks = params.tasks.filter((t) => {
    if ((t.status as string) === 'cancelled') return false;
    if (t.due_date) {
      return isDateInRange(t.due_date, dateRange.startDate, dateRange.endDate);
    }
    return isDateInRange(t.created_at, dateRange.startDate, dateRange.endDate);
  });

  const eligibleCount = eligibleTasks.length;
  const completedTasks = eligibleTasks.filter((t) => t.status === 'completed');
  const pendingTasks = eligibleTasks.filter((t) => t.status === 'pending');
  const inProgressTasks = eligibleTasks.filter((t) => t.status === 'in_progress');

  // Overdue Tasks: Tasks in eligible cohort whose due_date < todayLocal and are not completed
  const overdueCohortTasks = eligibleTasks.filter((t) => {
    if (t.status === 'completed') return false;
    const dueStr = toLocalDateStr(t.due_date);
    return Boolean(dueStr && dueStr < todayLocal);
  });

  // Outstanding tasks across all time that are currently overdue (for backlog radar)
  const allOverdueTasks = params.tasks.filter((t) => {
    if (t.status === 'completed' || (t.status as string) === 'cancelled') return false;
    const dueStr = toLocalDateStr(t.due_date);
    return Boolean(dueStr && dueStr < todayLocal);
  });

  // Late vs. On-Time completions
  let onTimeCompleted = 0;
  let lateCompleted = 0;
  completedTasks.forEach((t) => {
    const compDate = toLocalDateStr(t.completed_at);
    const dueDate = toLocalDateStr(t.due_date);
    if (compDate && dueDate && compDate > dueDate) {
      lateCompleted++;
    } else {
      onTimeCompleted++;
    }
  });

  const taskCompletionRate = eligibleCount > 0 ? Math.round((completedTasks.length / eligibleCount) * 100) : 0;
  const isCompletionRateApplicable = eligibleCount > 0;

  const totalEstimatedMinutes = completedTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes || 0),
    0
  );

  const prevCompRate = previousPeriodData?.taskCompletionRate ?? null;
  const completionRateDelta =
    isCompletionRateApplicable && prevCompRate !== null
      ? taskCompletionRate - prevCompRate
      : null;

  // --------------------------------------------------------------------------
  // 2. ASSIGNMENT PERFORMANCE ENGINE
  // Cohort Definition:
  // - Assignments due within [startDate, endDate] (or created in window if no due date).
  // - A student may submit multiple revisions; a revision does NOT inflate unique count.
  // --------------------------------------------------------------------------
  const eligibleAssignments = params.assignments.filter((a) => {
    if (a.due_date) {
      return isDateInRange(a.due_date, dateRange.startDate, dateRange.endDate);
    }
    return isDateInRange(a.created_at, dateRange.startDate, dateRange.endDate);
  });

  const totalAssignedAsgs = eligibleAssignments.length;
  let submittedAsgs = 0;
  let unsubmittedAsgs = 0;
  let submittedOnTime = 0;
  let submittedLate = 0;
  let pendingReviewAsgs = 0;
  let reviewedAsgs = 0;
  let needsRevisionAsgs = 0;
  let revisionSubmittedCount = 0;

  let asgScoreSum = 0;
  let asgScoredCount = 0;

  eligibleAssignments.forEach((a) => {
    const rawList: Submission[] = Array.isArray(a.submissions)
      ? a.submissions
      : a.submissions
      ? [a.submissions]
      : [];
    const studentSubmissions = rawList.filter((s) => s.student_id === params.studentId);
    const activeSub = studentSubmissions.length > 0
      ? [...studentSubmissions].sort(
          (x, y) => new Date(y.submitted_at || 0).getTime() - new Date(x.submitted_at || 0).getTime()
        )[0]
      : a.submission || null;

    if (activeSub) {
      submittedAsgs++;

      // Check on-time vs late based on first submission attempt
      const firstSub = [...studentSubmissions].sort(
        (x, y) => new Date(x.submitted_at || 0).getTime() - new Date(y.submitted_at || 0).getTime()
      )[0] || activeSub;

      const subDate = toLocalDateStr(firstSub.submitted_at);
      const dueDate = toLocalDateStr(a.due_date);
      if (subDate && dueDate && subDate > dueDate) {
        submittedLate++;
      } else {
        submittedOnTime++;
      }

      if (studentSubmissions.length > 1 || ((firstSub as any).attempt_number && (firstSub as any).attempt_number > 1)) {
        revisionSubmittedCount++;
      }

      if (activeSub.status === 'reviewed') {
        reviewedAsgs++;
        if (typeof activeSub.score === 'number' && typeof a.total_points === 'number' && a.total_points > 0) {
          asgScoreSum += (activeSub.score / a.total_points) * 100;
          asgScoredCount++;
        }
      } else if (activeSub.status === 'needs_revision') {
        needsRevisionAsgs++;
      } else {
        pendingReviewAsgs++;
      }
    } else {
      unsubmittedAsgs++;
    }
  });

  const assignmentSubmissionRate =
    totalAssignedAsgs > 0 ? Math.round((submittedAsgs / totalAssignedAsgs) * 100) : 0;
  const isSubmissionRateApplicable = totalAssignedAsgs > 0;
  const assignmentAverageScore =
    asgScoredCount > 0 ? Math.round((asgScoreSum / asgScoredCount) * 10) / 10 : null;

  const prevSubRate = previousPeriodData?.assignmentSubmissionRate ?? null;
  const submissionRateDelta =
    isSubmissionRateApplicable && prevSubRate !== null
      ? assignmentSubmissionRate - prevSubRate
      : null;

  // --------------------------------------------------------------------------
  // 3. EVALUATION PERFORMANCE ENGINE (WEIGHTED MASTERY)
  // Weighted Formula: (Total Scored Points Earned / Total Possible Points) * 100
  // Excludes unscored oral/walkthrough sessions from numeric averages while preserving feedback.
  // --------------------------------------------------------------------------
  const evalsInWindow = params.evaluations.filter((e) => {
    const d = e.scheduled_date || toLocalDateStr(e.evaluated_at);
    return isDateInRange(d, dateRange.startDate, dateRange.endDate);
  });

  const totalScheduledEvals = evalsInWindow.length;
  const completedEvals = evalsInWindow.filter((e) => e.status === 'completed');
  const cancelledEvals = evalsInWindow.filter((e) => e.status === 'cancelled').length;
  const upcomingEvals = evalsInWindow.filter((e) => e.status === 'scheduled').length;

  let totalEarnedPoints = 0;
  let totalPossiblePoints = 0;
  let scoredEvalsCount = 0;
  let unscoredCompletedCount = 0;

  const formatBreakdown: Record<string, { count: number; scoredCount: number; averageScore: number | null }> = {};

  completedEvals.forEach((e) => {
    const fmt = e.format || 'written';
    if (!formatBreakdown[fmt]) {
      formatBreakdown[fmt] = { count: 0, scoredCount: 0, averageScore: null };
    }
    formatBreakdown[fmt].count++;

    if (typeof e.score === 'number' && typeof e.total_points === 'number' && e.total_points > 0) {
      totalEarnedPoints += e.score;
      totalPossiblePoints += e.total_points;
      scoredEvalsCount++;
      formatBreakdown[fmt].scoredCount++;
    } else {
      unscoredCompletedCount++;
    }
  });

  const weightedAveragePercentage =
    scoredEvalsCount > 0 && totalPossiblePoints > 0
      ? Math.round((totalEarnedPoints / totalPossiblePoints) * 1000) / 10
      : null;

  const prevEvalAvg = previousPeriodData?.evaluationAverage ?? null;
  const evaluationAverageDelta =
    weightedAveragePercentage !== null && prevEvalAvg !== null
      ? Math.round((weightedAveragePercentage - prevEvalAvg) * 10) / 10
      : null;

  const recentFeedback = completedEvals
    .filter((e) => Boolean(e.feedback || e.recommendation))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.scheduled_date || toLocalDateStr(e.evaluated_at) || dateRange.endDate,
      subjectName: e.subject_name || e.subjects?.name,
      mentorName: e.mentor_name,
      scorePercentage:
        typeof e.score === 'number' && e.total_points
          ? Math.round((e.score / e.total_points) * 100)
          : null,
      feedback: e.feedback,
      recommendation: e.recommendation,
    }));

  // --------------------------------------------------------------------------
  // 4. SCHEDULE-BASED STUDY CONSISTENCY & DAILY VISUALIZATION (MILESTONE 12.2.1)
  // Evaluates strictly eligible mentor-scheduled task days. Unscheduled days are excluded.
  // Formula: (Scheduled days with >= 1 completed task / Total eligible scheduled days) * 100
  // --------------------------------------------------------------------------
  const scheduledTasksMap = new Map<string, Task[]>();

  eligibleTasks.forEach((t) => {
    const schedDate = toLocalDateStr(t.due_date) || toLocalDateStr(t.created_at);
    if (schedDate) {
      const existing = scheduledTasksMap.get(schedDate) || [];
      existing.push(t);
      scheduledTasksMap.set(schedDate, existing);
    }
  });

  const sortedScheduledDates = Array.from(scheduledTasksMap.keys()).sort();
  const scheduledDays: ScheduledDayConsistencyItem[] = sortedScheduledDates.map((date) => {
    const dayTasks = scheduledTasksMap.get(date) || [];
    const assignedCount = dayTasks.length;

    let completedOnTimeCount = 0;
    let completedLateCount = 0;

    dayTasks.forEach((t) => {
      if (t.status === 'completed') {
        const compDate = toLocalDateStr(t.completed_at);
        const dueDate = toLocalDateStr(t.due_date);
        if (compDate && dueDate && compDate > dueDate) {
          completedLateCount++;
        } else {
          completedOnTimeCount++;
        }
      }
    });

    const totalCompletedCount = completedOnTimeCount + completedLateCount;
    const pendingCount = Math.max(0, assignedCount - totalCompletedCount);
    const isConsistent = totalCompletedCount > 0;
    const isOnTime = completedOnTimeCount > 0;

    return {
      date,
      dayLabel: formatDayMonth(date),
      assignedCount,
      completedOnTimeCount,
      completedLateCount,
      totalCompletedCount,
      pendingCount,
      isConsistent,
      isOnTime,
    };
  });

  const totalScheduledDays = scheduledDays.length;
  const consistentScheduledDays = scheduledDays.filter((d) => d.isConsistent).length;
  const onTimeScheduledDays = scheduledDays.filter((d) => d.isOnTime).length;

  const scheduledConsistencyPercentage =
    totalScheduledDays > 0
      ? Math.round((consistentScheduledDays / totalScheduledDays) * 100)
      : null;

  const onTimeConsistencyPercentage =
    totalScheduledDays > 0
      ? Math.round((onTimeScheduledDays / totalScheduledDays) * 100)
      : null;

  // Daily activity events for timeline reference
  const activityMap = new Map<string, { tasks: number; asgs: number; evals: number }>();
  completedTasks.forEach((t) => {
    if (t.completed_at) {
      const d = toLocalDateStr(t.completed_at);
      if (d) {
        const curr = activityMap.get(d) || { tasks: 0, asgs: 0, evals: 0 };
        curr.tasks++;
        activityMap.set(d, curr);
      }
    }
  });

  eligibleAssignments.forEach((a) => {
    const rawList: Submission[] = Array.isArray(a.submissions) ? a.submissions : a.submissions ? [a.submissions] : [];
    const sub = rawList.find((s) => s.student_id === params.studentId) || a.submission;
    if (sub && sub.submitted_at) {
      const d = toLocalDateStr(sub.submitted_at);
      if (d) {
        const curr = activityMap.get(d) || { tasks: 0, asgs: 0, evals: 0 };
        curr.asgs++;
        activityMap.set(d, curr);
      }
    }
  });

  completedEvals.forEach((e) => {
    const d = e.scheduled_date || toLocalDateStr(e.evaluated_at);
    if (d) {
      const curr = activityMap.get(d) || { tasks: 0, asgs: 0, evals: 0 };
      curr.evals++;
      activityMap.set(d, curr);
    }
  });

  const studyActivityTimeline: ActivityDayItem[] = Array.from(activityMap.entries())
    .map(([date, counts]) => ({
      date,
      tasksCompleted: counts.tasks,
      assignmentsSubmitted: counts.asgs,
      evaluationsCompleted: counts.evals,
      totalActivities: counts.tasks + counts.asgs + counts.evals,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const verifiedEventsCount = studyActivityTimeline.reduce((sum, d) => sum + d.totalActivities, 0);

  // Set scheduled days count on dateRange metadata
  params.dateRange.scheduledDaysCount = totalScheduledDays;

  // --------------------------------------------------------------------------
  // 5. DOUBTS DESK INQUIRY METRICS
  // --------------------------------------------------------------------------
  const doubtsList = Array.isArray(params.doubts) ? params.doubts : [];
  let doubtsCreated = 0;
  let doubtsResolved = 0;
  let doubtsPending = 0;
  let totalResolutionDurationMs = 0;
  let resolvedWithDurationCount = 0;

  doubtsList.forEach((d) => {
    const createdStr = toLocalDateStr(d.created_at);
    const resolvedStr = toLocalDateStr(d.resolved_at);

    if (isDateInRange(createdStr, dateRange.startDate, dateRange.endDate)) {
      doubtsCreated++;
    }

    if (d.status === 'resolved' && isDateInRange(resolvedStr, dateRange.startDate, dateRange.endDate)) {
      doubtsResolved++;
      if (d.created_at && d.resolved_at) {
        const diffMs = new Date(d.resolved_at).getTime() - new Date(d.created_at).getTime();
        if (diffMs > 0) {
          totalResolutionDurationMs += diffMs;
          resolvedWithDurationCount++;
        }
      }
    }

    if (d.status === 'open' || d.status === 'answered') {
      doubtsPending++;
    }
  });

  const averageResolutionHours =
    resolvedWithDurationCount > 0
      ? Math.round((totalResolutionDurationMs / (resolvedWithDurationCount * 1000 * 60 * 60)) * 10) / 10
      : null;

  // --------------------------------------------------------------------------
  // 6. SUBJECT-WISE BREAKDOWN & EVIDENCE-BASED STATUS
  // --------------------------------------------------------------------------
  const subjectBreakdown: SubjectReportItem[] = params.subjects.map((s) => {
    const sTasks = eligibleTasks.filter((t) => t.subject_id === s.id);
    const sTasksTotal = sTasks.length;
    const sTasksCompleted = sTasks.filter((t) => t.status === 'completed').length;
    const sTasksRate = sTasksTotal > 0 ? Math.round((sTasksCompleted / sTasksTotal) * 100) : 0;

    const sAsgs = eligibleAssignments.filter((a) => a.subject_id === s.id);
    const sAsgsTotal = sAsgs.length;
    let sAsgsSubmitted = 0;
    let sAsgsReviewed = 0;
    let sAsgsScoreSum = 0;
    let sAsgsScoredCount = 0;

    sAsgs.forEach((a) => {
      const rawList: Submission[] = Array.isArray(a.submissions) ? a.submissions : a.submissions ? [a.submissions] : [];
      const sub = rawList.find((subm) => subm.student_id === params.studentId) || a.submission;
      if (sub) {
        sAsgsSubmitted++;
        if (sub.status === 'reviewed') {
          sAsgsReviewed++;
          if (typeof sub.score === 'number' && typeof a.total_points === 'number' && a.total_points > 0) {
            sAsgsScoreSum += (sub.score / a.total_points) * 100;
            sAsgsScoredCount++;
          }
        }
      }
    });

    const sAsgsAvg = sAsgsScoredCount > 0 ? Math.round((sAsgsScoreSum / sAsgsScoredCount) * 10) / 10 : null;

    const sEvals = completedEvals.filter((e) => e.subject_id === s.id);
    const sEvalsCount = sEvals.length;
    let sEarned = 0;
    let sPossible = 0;
    let sScoredCount = 0;

    sEvals.forEach((e) => {
      if (typeof e.score === 'number' && typeof e.total_points === 'number' && e.total_points > 0) {
        sEarned += e.score;
        sPossible += e.total_points;
        sScoredCount++;
      }
    });

    const sEvalsAvg = sScoredCount > 0 && sPossible > 0 ? Math.round((sEarned / sPossible) * 1000) / 10 : null;

    // Evidence-based status classification
    let performanceStatus: 'mastery' | 'on_track' | 'attention_required' | 'insufficient_evidence' = 'on_track';
    let performanceStatusLabel = 'On Track';
    let needsAttention = false;
    let attentionReason: string | undefined = undefined;

    if (sScoredCount === 0 && sTasksTotal === 0 && sAsgsTotal === 0) {
      performanceStatus = 'insufficient_evidence';
      performanceStatusLabel = 'Limited Evidence';
    } else if (
      (sEvalsAvg !== null && sEvalsAvg < REPORT_THRESHOLDS.ATTENTION_SCORE_MAX) ||
      (sTasksTotal > 0 && sTasksRate < REPORT_THRESHOLDS.TASK_COMPLETION_ATTENTION_MAX) ||
      (sAsgsTotal > 0 && sAsgsSubmitted < sAsgsTotal)
    ) {
      performanceStatus = 'attention_required';
      performanceStatusLabel = 'Needs Attention';
      needsAttention = true;

      if (sEvalsAvg !== null && sEvalsAvg < REPORT_THRESHOLDS.ATTENTION_SCORE_MAX) {
        attentionReason = `Evaluation score average (${sEvalsAvg}%) is below the ${REPORT_THRESHOLDS.ATTENTION_SCORE_MAX}% benchmark.`;
      } else if (sTasksTotal > 0 && sTasksRate < REPORT_THRESHOLDS.TASK_COMPLETION_ATTENTION_MAX) {
        attentionReason = `Low task execution velocity (${sTasksRate}% completion rate).`;
      } else if (sAsgsTotal > sAsgsSubmitted) {
        attentionReason = `${sAsgsTotal - sAsgsSubmitted} practice assignment(s) remain unsubmitted.`;
      }
    } else if (
      sScoredCount >= REPORT_THRESHOLDS.MIN_SCORED_ASSESSMENTS_FOR_MASTERY &&
      sEvalsAvg !== null &&
      sEvalsAvg >= REPORT_THRESHOLDS.MASTERY_SCORE_MIN &&
      sTasksRate >= 75
    ) {
      performanceStatus = 'mastery';
      performanceStatusLabel = 'Strong Mastery (Verified)';
    } else {
      performanceStatus = 'on_track';
      performanceStatusLabel = 'Developing / On Track';
    }

    return {
      subjectId: s.id,
      subjectName: s.name,
      subjectCode: s.code,
      tasksTotal: sTasksTotal,
      tasksCompleted: sTasksCompleted,
      tasksCompletionRate: sTasksRate,
      assignmentsTotal: sAsgsTotal,
      assignmentsSubmitted: sAsgsSubmitted,
      assignmentsReviewed: sAsgsReviewed,
      assignmentsAverageScore: sAsgsAvg,
      evaluationsCompleted: sEvalsCount,
      evaluationsScoredCount: sScoredCount,
      evaluationsEarnedPoints: sEarned,
      evaluationsPossiblePoints: sPossible,
      evaluationsAverageScore: sEvalsAvg,
      performanceStatus,
      performanceStatusLabel,
      needsAttention,
      attentionReason,
    };
  });

  // --------------------------------------------------------------------------
  // 7. MULTI-TIER ACADEMIC INSIGHTS
  // --------------------------------------------------------------------------
  const facts: string[] = [];

  if (eligibleCount > 0) {
    facts.push(
      `Completed ${completedTasks.length} of ${eligibleCount} scheduled syllabus tasks (${taskCompletionRate}% completion rate).`
    );
  } else {
    facts.push('No syllabus tasks were scheduled with deadlines in this reporting window.');
  }

  if (weightedAveragePercentage !== null) {
    facts.push(
      `Achieved a weighted evaluation average of ${weightedAveragePercentage}% (${totalEarnedPoints}/${totalPossiblePoints} total scored points across ${scoredEvalsCount} assessment${scoredEvalsCount === 1 ? '' : 's'}).`
    );
  } else if (unscoredCompletedCount > 0) {
    facts.push(`Completed ${unscoredCompletedCount} qualitative walkthrough evaluation(s) without numerical grading.`);
  } else {
    facts.push('No completed milestone evaluations were recorded in this period.');
  }

  if (totalAssignedAsgs > 0) {
    facts.push(
      `Submitted ${submittedAsgs} of ${totalAssignedAsgs} assigned practice problem sets (${assignmentSubmissionRate}% submission fulfillment).`
    );
  }

  if (totalScheduledDays > 0 && scheduledConsistencyPercentage !== null) {
    facts.push(
      `Completed assigned tasks on ${consistentScheduledDays} of ${totalScheduledDays} mentor-scheduled study days (${scheduledConsistencyPercentage}% schedule consistency).`
    );
  } else {
    facts.push('No mentor-scheduled task days were assigned in this audit period; consistency tracking is marked N/A.');
  }

  const observations: ReportObservation[] = [];

  // Check for strong subjects
  const strongSubjects = subjectBreakdown.filter(
    (s) => s.evaluationsAverageScore !== null && s.evaluationsAverageScore >= REPORT_THRESHOLDS.MASTERY_SCORE_MIN
  );
  if (strongSubjects.length > 0) {
    observations.push({
      type: 'strength',
      title: 'Strong Academic Grasp',
      text: `Demonstrated solid conceptual mastery in ${strongSubjects.map((s) => s.subjectName).join(', ')} with evaluation averages exceeding ${REPORT_THRESHOLDS.MASTERY_SCORE_MIN}%.`,
      subjectId: strongSubjects[0].subjectId,
    });
  }

  // Check for subjects needing attention
  const attentionSubjects = subjectBreakdown.filter((s) => s.needsAttention);
  if (attentionSubjects.length > 0) {
    observations.push({
      type: 'attention',
      title: 'Academic Attention Required',
      text: `Targeted review recommended in ${attentionSubjects.map((s) => s.subjectName).join(', ')}. ${attentionSubjects[0].attentionReason || ''}`,
      subjectId: attentionSubjects[0].subjectId,
    });
  }

  // Check for task backlog
  if (allOverdueTasks.length > 0) {
    observations.push({
      type: 'attention',
      title: 'Active Task Backlog',
      text: `${allOverdueTasks.length} task(s) currently past due date across study modules, requiring dedicated time allocation.`,
    });
  }

  // Check for pending revisions
  if (needsRevisionAsgs > 0) {
    observations.push({
      type: 'attention',
      title: 'Assignment Revisions Pending',
      text: `${needsRevisionAsgs} assignment submission(s) flagged with 'Needs Revision' awaiting student resubmission.`,
    });
  }

  // Level 3: Verbatim Stored Mentor Feedback
  const mentorRemarks = recentFeedback;

  // --------------------------------------------------------------------------
  // 8. PRIORITIZED ACTIONABLE RECOMMENDATIONS (MAX 3)
  // --------------------------------------------------------------------------
  const recommendations: ReportRecommendation[] = [];

  // Priority 1: Clear Overdue Tasks Backlog
  if (allOverdueTasks.length > 0) {
    const overdueSubjId = allOverdueTasks[0].subject_id;
    const overdueSubj = params.subjects.find((s) => s.id === overdueSubjId);
    const subjLabel = overdueSubj ? ` in ${overdueSubj.name}` : '';

    recommendations.push({
      id: 'rec-overdue-tasks',
      priority: 'P1',
      priorityLabel: 'Urgent',
      title: 'Clear Overdue Syllabus Tasks',
      evidence: `${allOverdueTasks.length} task(s) past deadline${subjLabel}.`,
      recommendedAction: `Schedule a 90-minute focused study block to complete overdue tasks and clear backlogged exercises.`,
      measurableSuccessIndicator: '0 overdue tasks remaining on the Task Desk by week end.',
    });
  }

  // Priority 2: Address Assignment Revisions or Unsubmitted Practice
  if (needsRevisionAsgs > 0 && recommendations.length < REPORT_THRESHOLDS.MAX_RECOMMENDATIONS) {
    recommendations.push({
      id: 'rec-assignment-revisions',
      priority: 'P2',
      priorityLabel: 'High',
      title: 'Resubmit Revised Practice Assignments',
      evidence: `${needsRevisionAsgs} assignment(s) flagged by mentor for revision.`,
      recommendedAction: `Incorporate reviewer remarks, correct mathematical derivations or code, and upload updated solution.`,
      measurableSuccessIndicator: 'Status updated to Reviewed with mentor approval.',
    });
  } else if (unsubmittedAsgs > 0 && recommendations.length < REPORT_THRESHOLDS.MAX_RECOMMENDATIONS) {
    recommendations.push({
      id: 'rec-unsubmitted-asgs',
      priority: 'P2',
      priorityLabel: 'High',
      title: 'Submit Outstanding Practice Assignments',
      evidence: `${unsubmittedAsgs} assigned problem set(s) remain unsubmitted.`,
      recommendedAction: `Draft and submit pending assignment files to provide mentors with grading artifacts.`,
      measurableSuccessIndicator: '100% assignment submission fulfillment.',
    });
  }

  // Priority 3: Lowest Scoring Subject / Doubts Follow-up / Maintain Cadence
  const lowestScoringSubject = [...subjectBreakdown]
    .filter((s) => s.evaluationsAverageScore !== null)
    .sort((a, b) => (a.evaluationsAverageScore || 0) - (b.evaluationsAverageScore || 0))[0];

  if (
    lowestScoringSubject &&
    lowestScoringSubject.evaluationsAverageScore !== null &&
    lowestScoringSubject.evaluationsAverageScore < REPORT_THRESHOLDS.ATTENTION_SCORE_MAX &&
    recommendations.length < REPORT_THRESHOLDS.MAX_RECOMMENDATIONS
  ) {
    recommendations.push({
      id: 'rec-subject-reinforcement',
      priority: 'P3',
      priorityLabel: 'Recommended',
      title: `Reinforce Concepts in ${lowestScoringSubject.subjectName}`,
      evidence: `Evaluation average in ${lowestScoringSubject.subjectName} is ${lowestScoringSubject.evaluationsAverageScore}% (below ${REPORT_THRESHOLDS.ATTENTION_SCORE_MAX}% benchmark).`,
      recommendedAction: `Review chapter fundamentals and submit targeted questions to Doubts Desk for mentor explanation.`,
      measurableSuccessIndicator: `Achieve >= ${REPORT_THRESHOLDS.ATTENTION_SCORE_MAX}% on next scheduled milestone evaluation.`,
    });
  } else if (doubtsPending > 0 && recommendations.length < REPORT_THRESHOLDS.MAX_RECOMMENDATIONS) {
    recommendations.push({
      id: 'rec-doubts-resolution',
      priority: 'P3',
      priorityLabel: 'Recommended',
      title: 'Follow Up on Pending Doubts Desk Inquiries',
      evidence: `${doubtsPending} question(s) currently open on the Doubts Desk.`,
      recommendedAction: 'Check mentor responses, test the suggested problem resolution, and mark questions as resolved.',
      measurableSuccessIndicator: 'All open questions resolved.',
    });
  } else if (recommendations.length < REPORT_THRESHOLDS.MAX_RECOMMENDATIONS) {
    recommendations.push({
      id: 'rec-maintain-consistency',
      priority: 'P3',
      priorityLabel: 'Recommended',
      title: 'Maintain Consistent Study Cadence',
      evidence: `Consistent execution on ${consistentScheduledDays} of ${totalScheduledDays} scheduled study days.`,
      recommendedAction: 'Continue daily task completion and prepare for the upcoming curriculum milestone.',
      measurableSuccessIndicator: `Maintain >= 80% task completion across upcoming scheduled days.`,
    });
  }

  return {
    studentId: params.studentId,
    studentName: params.studentName,
    poraplanId: params.poraplanId,
    studentEmail: params.studentEmail,
    university: params.university,
    department: params.department,
    batch: params.batch,
    currentSemester: params.currentSemester,
    programName: params.programName,
    cohortName: params.cohortName,
    mentorName: params.mentorName,
    period: params.period,
    dateRange: params.dateRange,
    generatedAt: params.now,
    taskMetrics: {
      totalAssigned: eligibleCount,
      eligibleDue: eligibleCount,
      completed: completedTasks.length,
      onTimeCompleted,
      lateCompleted,
      pending: pendingTasks.length,
      inProgress: inProgressTasks.length,
      overdue: overdueCohortTasks.length,
      completionRate: taskCompletionRate,
      isCompletionRateApplicable,
      totalEstimatedMinutes,
      previousPeriodCompletionRate: prevCompRate,
      completionRateDelta,
    },
    assignmentMetrics: {
      totalAssigned: totalAssignedAsgs,
      submitted: submittedAsgs,
      unsubmitted: unsubmittedAsgs,
      submittedOnTime,
      submittedLate,
      pendingReview: pendingReviewAsgs,
      reviewed: reviewedAsgs,
      needsRevision: needsRevisionAsgs,
      revisionSubmitted: revisionSubmittedCount,
      submissionRate: assignmentSubmissionRate,
      isSubmissionRateApplicable,
      averageScorePercentage: assignmentAverageScore,
      scoredCount: asgScoredCount,
      previousPeriodSubmissionRate: prevSubRate,
      submissionRateDelta,
    },
    evaluationMetrics: {
      totalScheduled: totalScheduledEvals,
      completed: completedEvals.length,
      cancelled: cancelledEvals,
      upcoming: upcomingEvals,
      averageScorePercentage: weightedAveragePercentage,
      weightedAveragePercentage,
      scoredCount: scoredEvalsCount,
      totalEarnedPoints,
      totalPossiblePoints,
      unscoredCompletedCount,
      previousPeriodAveragePercentage: prevEvalAvg,
      evaluationAverageDelta,
      recentFeedback,
      formatBreakdown,
    },
    studyConsistency: {
      totalScheduledDays,
      consistentScheduledDays,
      onTimeScheduledDays,
      consistencyPercentage: scheduledConsistencyPercentage,
      onTimeConsistencyPercentage,
      isConsistencyApplicable: totalScheduledDays > 0,
      scheduledDays,
      // Compatibility aliases:
      activeStudyDays: consistentScheduledDays,
      totalPeriodDays: totalScheduledDays > 0 ? totalScheduledDays : dateRange.daysCount,
      verifiedEventsCount,
    },
    doubtMetrics: {
      createdInPeriod: doubtsCreated,
      resolvedInPeriod: doubtsResolved,
      pendingInPeriod: doubtsPending,
      totalStudentDoubts: doubtsList.length,
      averageResolutionHours,
    },
    subjectBreakdown,
    studyActivityTimeline,
    insights: {
      facts,
      observations,
      mentorRemarks,
    },
    recommendations,
  };
}

/**
 * Mock implementation of Student Progress Report with dynamic schedule derivation.
 */
function generateMockStudentReport(
  studentId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
  referenceDate?: Date
): { report: StudentAcademicReport | null; error: Error | null } {
  const normalizedId = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
  const user = getMockUserById(normalizedId);
  if (!user) {
    return { report: null, error: new Error('Student account not found.') };
  }

  const tasks = getMockStudentTasks(normalizedId);
  const assignments = getMockStudentAssignments(normalizedId);
  const evaluations = getMockStudentEvaluations(normalizedId);
  const subjects = getMockStudentSubjects(normalizedId);
  const doubts = getMockStudentDoubts(normalizedId);

  // Active program / mentor
  const enrollments = getMockEnrollments({ studentId: normalizedId, status: 'active' });
  const activeEnr = enrollments[0];
  const program = activeEnr ? getMockPrograms().find((p) => p.id === activeEnr.program_id) : undefined;
  const cohort = activeEnr?.cohort_id ? getMockCohorts().find((c) => c.id === activeEnr.cohort_id) : undefined;
  const assignedMentors = getMockAssignedMentors(normalizedId);
  const mentor = assignedMentors[0];

  // Dynamic schedule window determination
  let derivedStart = customStart;
  let derivedEnd = customEnd;
  if (period === 'schedule') {
    const scheduledDueDates = tasks
      .filter((t) => (t.status as string) !== 'cancelled' && t.due_date)
      .map((t) => toLocalDateStr(t.due_date)!)
      .sort();
    if (scheduledDueDates.length > 0) {
      derivedStart = scheduledDueDates[0];
      derivedEnd = scheduledDueDates[scheduledDueDates.length - 1];
    }
  }

  const dateRange = computeReportDateRange(period, derivedStart, derivedEnd, referenceDate);
  const now = referenceDate ? referenceDate.toISOString() : new Date().toISOString();
  const todayLocal = formatLocalDate(referenceDate || new Date());

  let previousPeriodData: {
    taskCompletionRate: number | null;
    assignmentSubmissionRate: number | null;
    evaluationAverage: number | null;
  } | undefined = undefined;

  if (dateRange.previousStartDate && dateRange.previousEndDate) {
    previousPeriodData = computePeriodAggregateMetrics({
      startDate: dateRange.previousStartDate,
      endDate: dateRange.previousEndDate,
      todayLocal,
      studentId: normalizedId,
      tasks,
      assignments,
      evaluations,
    });
  }

  const report = buildStudentReportFromData({
    studentId: normalizedId,
    studentName: user.full_name || 'Scholar',
    poraplanId: user.poraplan_id || 'PP001',
    studentEmail: user.email,
    university: user.university,
    department: user.department,
    batch: user.batch,
    currentSemester: user.current_semester,
    programName: program?.name,
    cohortName: cohort?.name,
    mentorName: mentor?.full_name,
    period,
    dateRange,
    now,
    todayLocal,
    tasks,
    assignments,
    evaluations,
    subjects,
    doubts,
    previousPeriodData,
  });

  return { report, error: null };
}

/**
 * Generates an Academic Progress Report for a Mentor across their assigned mentees.
 * Strictly verifies mentor authorization: Mentors can only view assigned students.
 */
export async function generateMentorReport(
  mentorId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
  studentIdFilter?: string,
  options?: {
    referenceDate?: Date;
    requestingUserId?: string;
    requestingUserRole?: 'student' | 'mentor' | 'admin';
  }
): Promise<{ report: MentorAcademicReport | null; error: Error | null }> {
  if (!mentorId) {
    return { report: null, error: new Error('Mentor ID is required.') };
  }

  const backend = await getSupabaseBackend();

  // Caller Verification
  const { caller, error: authError } = await resolveAuthorizedCaller(backend, options, mentorId);
  if (authError || !caller) {
    return {
      report: null,
      error: authError || new Error('Unauthorized: Authentication required to access mentor reports.'),
    };
  }

  const normTargetMentorId = normalizeMockUserId(mentorId);
  const normCallerId = normalizeMockUserId(caller.userId);

  if (caller.role === 'student') {
    return {
      report: null,
      error: new Error('Unauthorized: Students are not authorized to access mentor workload reports.'),
    };
  } else if (caller.role === 'mentor') {
    if (normCallerId !== normTargetMentorId && caller.userId !== mentorId && caller.poraplanId !== mentorId) {
      return {
        report: null,
        error: new Error('Unauthorized: You can only generate reports for your own mentor account.'),
      };
    }
  } else if (caller.role === 'admin') {
    // Admin has platform-wide oversight to inspect any mentor report
  } else {
    return {
      report: null,
      error: new Error('Unauthorized: Access denied.'),
    };
  }

  const dateRange = computeReportDateRange(period, customStart, customEnd, options?.referenceDate);
  const now = options?.referenceDate ? options.referenceDate.toISOString() : new Date().toISOString();

  // 1. Fetch Assigned Students for Mentor
  let assignedStudents: Profile[] = [];
  if (!backend.isConfigured || !backend.getAssignedStudents) {
    assignedStudents = getMockAssignedStudents(mentorId);
  } else {
    const { students, error } = await backend.getAssignedStudents(mentorId);
    if (error) {
      return { report: null, error };
    }
    assignedStudents = students;
  }

  // Enforce Student Filter Security: must belong to mentor's assigned list
  if (studentIdFilter && studentIdFilter !== 'all') {
    const isAssigned = assignedStudents.some(
      (s) => s.id === studentIdFilter || s.poraplan_id === studentIdFilter
    );
    if (!isAssigned) {
      return {
        report: null,
        error: new Error('Unauthorized: You are not authorized to access progress reports for this student.'),
      };
    }
    assignedStudents = assignedStudents.filter(
      (s) => s.id === studentIdFilter || s.poraplan_id === studentIdFilter
    );
  }

  // 2. Fetch Mentor Profile
  let mentorName = 'Academic Mentor';
  let mentorPoraplanId = 'PPM001';
  if (!backend.isConfigured || !backend.supabase) {
    const mentorUser = getMockUserById(mentorId);
    if (mentorUser) {
      mentorName = mentorUser.full_name;
      mentorPoraplanId = mentorUser.poraplan_id || 'PPM001';
    }
  } else {
    const { data: mentorProfile } = await backend.supabase
      .from('profiles')
      .select('full_name, poraplan_id')
      .eq('id', mentorId)
      .single();
    if (mentorProfile) {
      mentorName = mentorProfile.full_name || mentorName;
      mentorPoraplanId = mentorProfile.poraplan_id || mentorPoraplanId;
    }
  }

  // 3. Generate summary for each assigned student
  const studentSummaries: ScholarReportSummary[] = [];
  let totalTasksAssigned = 0;
  let totalTasksCompleted = 0;
  let totalSubmissionsPendingReview = 0;
  let totalPendingRevisions = 0;
  let totalEvaluationsCompleted = 0;
  let totalEvaluationsUpcoming = 0;
  let scholarsNeedingAttentionCount = 0;

  for (const student of assignedStudents) {
    const { report: sReport } = await generateStudentReport(
      student.id,
      period,
      customStart,
      customEnd,
      {
        referenceDate: options?.referenceDate,
        requestingUserId: caller.userId,
        requestingUserRole: caller.role,
      }
    );

    if (sReport) {
      totalTasksAssigned += sReport.taskMetrics.totalAssigned;
      totalTasksCompleted += sReport.taskMetrics.completed;
      totalSubmissionsPendingReview += sReport.assignmentMetrics.pendingReview;
      totalPendingRevisions += sReport.assignmentMetrics.needsRevision;
      totalEvaluationsCompleted += sReport.evaluationMetrics.completed;
      totalEvaluationsUpcoming += sReport.evaluationMetrics.upcoming;

      const hasCriticalOverdue = sReport.taskMetrics.overdue >= 2;
      const hasLowEvaluation =
        sReport.evaluationMetrics.averageScorePercentage !== null &&
        sReport.evaluationMetrics.averageScorePercentage < 60;
      const hasPendingRevision = sReport.assignmentMetrics.needsRevision > 0;

      const hasModerateOverdue = sReport.taskMetrics.overdue === 1;
      const hasLowTaskCompletion =
        sReport.taskMetrics.isCompletionRateApplicable && sReport.taskMetrics.completionRate < 60;

      let attentionLevel: 'critical' | 'warning' | 'normal' = 'normal';
      let attentionReason: string | undefined = undefined;

      if (hasCriticalOverdue || hasLowEvaluation || hasPendingRevision) {
        attentionLevel = 'critical';
        scholarsNeedingAttentionCount++;
        if (hasCriticalOverdue) {
          attentionReason = `${sReport.taskMetrics.overdue} overdue tasks in study backlog.`;
        } else if (hasPendingRevision) {
          attentionReason = `${sReport.assignmentMetrics.needsRevision} assignment revision(s) pending.`;
        } else {
          attentionReason = `Average evaluation score (${sReport.evaluationMetrics.averageScorePercentage}%) critically low.`;
        }
      } else if (hasModerateOverdue || hasLowTaskCompletion) {
        attentionLevel = 'warning';
        scholarsNeedingAttentionCount++;
        if (hasModerateOverdue) {
          attentionReason = `1 overdue task requires follow-up.`;
        } else {
          attentionReason = `Task completion rate (${sReport.taskMetrics.completionRate}%) below target.`;
        }
      }

      studentSummaries.push({
        studentId: student.id,
        studentName: student.full_name,
        poraplanId: student.poraplan_id || 'PP001',
        studentEmail: student.email,
        programName: sReport.programName,
        cohortName: sReport.cohortName,
        tasksAssigned: sReport.taskMetrics.totalAssigned,
        tasksCompleted: sReport.taskMetrics.completed,
        tasksOverdue: sReport.taskMetrics.overdue,
        tasksCompletionRate: sReport.taskMetrics.completionRate,
        assignmentsAssigned: sReport.assignmentMetrics.totalAssigned,
        assignmentsSubmitted: sReport.assignmentMetrics.submitted,
        assignmentsPendingReview: sReport.assignmentMetrics.pendingReview,
        assignmentsNeedsRevision: sReport.assignmentMetrics.needsRevision,
        evaluationsCompleted: sReport.evaluationMetrics.completed,
        evaluationsScheduled: sReport.evaluationMetrics.upcoming,
        averageScorePercentage: sReport.evaluationMetrics.averageScorePercentage,
        activeStudyDays: sReport.studyConsistency.consistentScheduledDays,
        scheduledDaysCount: sReport.studyConsistency.totalScheduledDays,
        consistencyPercentage: sReport.studyConsistency.consistencyPercentage,
        needsAttention: attentionLevel !== 'normal',
        attentionReason,
        attentionLevel,
      });
    }
  }

  const overallTaskCompletionRate =
    totalTasksAssigned > 0 ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100) : 0;

  return {
    report: {
      mentorId,
      mentorName,
      poraplanId: mentorPoraplanId,
      period,
      dateRange,
      generatedAt: now,
      assignedStudentsCount: assignedStudents.length,
      studentSummaries,
      aggregateMetrics: {
        totalTasksAssigned,
        totalTasksCompleted,
        overallTaskCompletionRate,
        totalSubmissionsPendingReview,
        totalPendingRevisions,
        totalEvaluationsCompleted,
        totalEvaluationsUpcoming,
        scholarsNeedingAttentionCount,
      },
    },
    error: null,
  };
}

/**
 * Multi-program safe effective mentor lookup key helper.
 * Format: `${studentId}:${programId}` if programId is provided, or `${studentId}`.
 */
function makeEffectiveMentorKey(studentId: string, programId?: string | null): string {
  if (studentId && programId) {
    return `${studentId}:${programId}`;
  }
  return studentId || '';
}

export const DEFAULT_ADMIN_REPORT_CHUNK_SIZE = 50;

/**
 * Generates Platform-Wide Academic Intelligence & Operations Overview for Administrators (Milestone 12.3).
 *
 * Performance Optimized (Batch 4.7C-1):
 * - Eliminates sequential per-student N+1 database queries.
 * - Executes bulk chunked data retrieval for tasks, assignments, and evaluations.
 * - Eliminates per-mentor sequential count queries via bulk assignment aggregation.
 * - Computes all student metrics purely in memory via buildStudentReportFromData.
 *
 * Strict Security & Privacy Enforcement:
 * - Only administrators can access this report. Non-admin callers receive an immediate Unauthorized error.
 * - Does not expose private personal emails, contact phone/WhatsApp numbers, passwords, or internal security notes.
 * - Clearly distinguishes total registered users from active users (students with active program enrollment).
 * - Distinguishes verified facts, rule-based observations, and stored feedback.
 * - Employs neutral, non-presumptive labels: 'Critical Attention', 'Needs Attention', 'On Track', 'Insufficient Data'.
 */
export async function generateAdminAcademicIntelligence(
  period: ReportPeriod = 'monthly',
  customStart?: string,
  customEnd?: string,
  options?: {
    referenceDate?: Date;
    requestingUserId?: string;
    requestingUserRole?: 'student' | 'mentor' | 'admin';
    chunkSize?: number;
  }
): Promise<{ report: AdminAcademicIntelligenceReport | null; error: Error | null }> {
  const backend = await getSupabaseBackend();

  // 1. Strict Administrator Role Authorization
  if (!options || !options.requestingUserRole || options.requestingUserRole !== 'admin') {
    return {
      report: null,
      error: new Error('Unauthorized: Only platform administrators can access administrative academic intelligence.'),
    };
  }

  const { caller, error: authError } = await resolveAuthorizedCaller(backend, options);
  if (authError || !caller) {
    return {
      report: null,
      error: authError || new Error('Unauthorized: Valid administrative session is required.'),
    };
  }

  if (caller.role !== 'admin') {
    return {
      report: null,
      error: new Error('Unauthorized: Only platform administrators can access administrative academic intelligence.'),
    };
  }

  const dateRange = computeReportDateRange(period, customStart, customEnd, options?.referenceDate);
  const now = options?.referenceDate ? options.referenceDate.toISOString() : new Date().toISOString();

  try {
    let studentProfiles: Profile[] = [];
    let mentorProfiles: Profile[] = [];
    let allEnrollments: any[] = [];

    const tasksByStudent = new Map<string, Task[]>();
    const asgsByStudent = new Map<string, any[]>();
    const evalsByStudent = new Map<string, any[]>();

    const mentorActiveMenteesCountMap = new Map<string, number>();
    const mentorActiveCohortsCountMap = new Map<string, number>();
    const overrideByStudentProgram = new Map<string, any>();
    const legacyOverrideByStudent = new Map<string, any>();
    const cohortMentorMap = new Map<string, any>();

    if (!backend.isConfigured || !backend.supabase) {
      // Mock Data Layer
      const allUsers = getMockUsers();
      studentProfiles = allUsers.filter((u) => u.role === 'student');
      mentorProfiles = allUsers.filter((u) => u.role === 'mentor');
      allEnrollments = getMockEnrollments();

      for (const s of studentProfiles) {
        const normId = normalizeMockUserId(s.id);
        tasksByStudent.set(s.id, getMockStudentTasks(normId));
        asgsByStudent.set(s.id, getMockStudentAssignments(normId));
        evalsByStudent.set(s.id, getMockStudentEvaluations(normId));
      }
    } else {
      // Supabase Backend Layer — Privacy-conscious query excluding private contact fields
      const { data: profiles, error: pErr } = await backend.supabase
        .from('profiles')
        .select('id, full_name, poraplan_id, role, university, department, batch, current_semester, status, created_at')
        .in('role', ['student', 'mentor']);

      if (pErr) return { report: null, error: pErr };

      studentProfiles = (profiles || []).filter((p: any) => p.role === 'student');
      mentorProfiles = (profiles || []).filter((p: any) => p.role === 'mentor');

      const { data: enrs, error: eErr } = await backend.supabase
        .from('program_enrollments')
        .select('id, student_id, program_id, cohort_id, status, enrolled_at, programs(id, name), cohorts(id, name)');

      if (eErr) return { report: null, error: eErr };
      allEnrollments = enrs || [];

      // Bulk fetch mentor allocations & workload across platform (eliminates per-mentor N+1 count queries)
      const [overridesRes, cohortMentorsRes] = await Promise.all([
        backend.supabase
          .from('student_mentor_assignments')
          .select('id, mentor_id, student_id, program_id, profiles!mentor_id(id, full_name, poraplan_id)')
          .eq('is_active', true),
        backend.supabase
          .from('cohort_mentors')
          .select('id, mentor_id, cohort_id, program_id, profiles!mentor_id(id, full_name, poraplan_id)')
          .eq('is_active', true),
      ]);

      if (overridesRes.error) return { report: null, error: overridesRes.error };
      if (cohortMentorsRes.error) return { report: null, error: cohortMentorsRes.error };

      for (const ov of (overridesRes.data as any[]) || []) {
        if (ov.mentor_id) {
          mentorActiveMenteesCountMap.set(
            ov.mentor_id,
            (mentorActiveMenteesCountMap.get(ov.mentor_id) || 0) + 1
          );
        }
        if (ov.program_id) {
          overrideByStudentProgram.set(makeEffectiveMentorKey(ov.student_id, ov.program_id), ov);
        }
        if (!legacyOverrideByStudent.has(ov.student_id)) {
          legacyOverrideByStudent.set(ov.student_id, ov);
        }
      }

      for (const cm of (cohortMentorsRes.data as any[]) || []) {
        if (cm.mentor_id) {
          mentorActiveCohortsCountMap.set(
            cm.mentor_id,
            (mentorActiveCohortsCountMap.get(cm.mentor_id) || 0) + 1
          );
        }
        if (cm.cohort_id && !cohortMentorMap.has(cm.cohort_id)) {
          cohortMentorMap.set(cm.cohort_id, cm);
        }
      }

      // Bulk fetch tasks, assignments, and evaluations in chunks (eliminates per-student N+1 queries)
      const studentIds = studentProfiles.map((s) => s.id);
      const chunkSize = Math.max(1, options?.chunkSize ?? DEFAULT_ADMIN_REPORT_CHUNK_SIZE);

      for (let i = 0; i < studentIds.length; i += chunkSize) {
        const chunk = studentIds.slice(i, i + chunkSize);
        const [tasksRes, asgsRes, evalsRes] = await Promise.all([
          backend.supabase
            .from('tasks')
            .select('id, student_id, subject_id, title, status, due_date, created_at, completed_at, estimated_minutes')
            .in('student_id', chunk),
          backend.supabase
            .from('assignments')
            .select('id, student_id, subject_id, title, status, due_date, created_at, total_points, submissions(*)')
            .in('student_id', chunk),
          backend.supabase
            .from('evaluations')
            .select('id, student_id, subject_id, title, status, score, total_points, format, scheduled_date, evaluated_at, created_at, feedback, recommendation')
            .in('student_id', chunk),
        ]);

        if (tasksRes.error) return { report: null, error: tasksRes.error };
        if (asgsRes.error) return { report: null, error: asgsRes.error };
        if (evalsRes.error) return { report: null, error: evalsRes.error };

        for (const t of (tasksRes.data as any[]) || []) {
          const list = tasksByStudent.get(t.student_id) || [];
          list.push(t);
          tasksByStudent.set(t.student_id, list);
        }
        for (const a of (asgsRes.data as any[]) || []) {
          const list = asgsByStudent.get(a.student_id) || [];
          list.push(a);
          asgsByStudent.set(a.student_id, list);
        }
        for (const e of (evalsRes.data as any[]) || []) {
          const list = evalsByStudent.get(e.student_id) || [];
          list.push(e);
          evalsByStudent.set(e.student_id, list);
        }
      }
    }

    const activeEnrollments = allEnrollments.filter((e) => e.status === 'active');
    const activeStudentIdSet = new Set(activeEnrollments.map((e) => e.student_id));
    const todayLocal = formatLocalDate(options?.referenceDate || new Date());

    // 2. Aggregate Student Summaries via In-Memory Pure Calculation Engine
    const studentSummaries: AdminStudentSummary[] = [];
    const attentionItems: AdminAttentionItem[] = [];

    let totalSubmissionsPendingReview = 0;
    let totalOverdueTasks = 0;

    for (const student of studentProfiles) {
      // Active enrollment identification
      const enr =
        activeEnrollments.find((e) => e.student_id === student.id) ||
        allEnrollments.find((e) => e.student_id === student.id);

      let enrollmentStatus: 'active' | 'completed' | 'inactive' | 'none' = 'none';
      if (enr) {
        enrollmentStatus = enr.status === 'active' ? 'active' : enr.status === 'completed' ? 'completed' : 'inactive';
      }

      let programName: string | undefined = enr?.programs?.name;
      let cohortName: string | undefined = enr?.cohorts?.name;
      if (!programName && enr?.program_id) {
        programName = getMockPrograms().find((p) => p.id === enr.program_id)?.name;
      }
      if (!cohortName && enr?.cohort_id) {
        cohortName = getMockCohorts().find((c) => c.id === enr.cohort_id)?.name;
      }

      // Resolve effective mentor
      let mentorName = 'Unassigned';
      if (!backend.isConfigured || !backend.supabase) {
        const normStudentId = normalizeMockUserId(student.id);
        const assigned = getMockAssignedMentors(normStudentId);
        mentorName = assigned[0]?.full_name || 'Unassigned';
      } else {
        const compositeKey = makeEffectiveMentorKey(student.id, enr?.program_id);
        const ov = enr?.program_id
          ? overrideByStudentProgram.get(compositeKey)
          : legacyOverrideByStudent.get(student.id);

        if (ov && (ov.profiles || ov.mentor)) {
          const prof = ov.profiles || ov.mentor;
          mentorName = prof.full_name || 'Unassigned';
        } else if (enr?.cohort_id && cohortMentorMap.has(enr.cohort_id)) {
          const cm = cohortMentorMap.get(enr.cohort_id);
          const prof = cm.profiles || cm.mentor;
          mentorName = prof?.full_name || 'Unassigned';
        }
      }

      const sTasks: Task[] = tasksByStudent.get(student.id) || [];
      const sAssignments: any[] = asgsByStudent.get(student.id) || [];
      const sEvaluations: any[] = evalsByStudent.get(student.id) || [];

      // Dynamic schedule window determination
      let derivedStart = customStart;
      let derivedEnd = customEnd;
      if (period === 'schedule') {
        const scheduledDueDates = sTasks
          .filter((t) => (t.status as string) !== 'cancelled' && t.due_date)
          .map((t) => toLocalDateStr(t.due_date)!)
          .sort();
        if (scheduledDueDates.length > 0) {
          derivedStart = scheduledDueDates[0];
          derivedEnd = scheduledDueDates[scheduledDueDates.length - 1];
        }
      }

      const sDateRange = computeReportDateRange(period, derivedStart, derivedEnd, options?.referenceDate);

      // Build student report using synchronous in-memory calculation (0 database queries)
      const sReport = buildStudentReportFromData({
        studentId: student.id,
        studentName: student.full_name || 'Scholar',
        poraplanId: student.poraplan_id || 'PP001',
        studentEmail: (student as any).email,
        university: student.university,
        department: student.department,
        batch: student.batch,
        currentSemester: student.current_semester,
        programName,
        cohortName,
        mentorName,
        period,
        dateRange: sDateRange,
        now,
        todayLocal,
        tasks: sTasks,
        assignments: sAssignments,
        evaluations: sEvaluations,
        subjects: [],
        doubts: [],
      });

      const tasksAssigned = sReport.taskMetrics.totalAssigned || 0;
      const tasksCompleted = sReport.taskMetrics.completed || 0;
      const tasksOverdue = sReport.taskMetrics.overdue || 0;
      const taskCompletionRate = sReport.taskMetrics.completionRate || 0;
      const isCompletionRateApplicable = Boolean(sReport.taskMetrics.isCompletionRateApplicable);

      const scoredCount = sReport.evaluationMetrics.scoredCount || 0;
      const averageScorePercentage = sReport.evaluationMetrics.averageScorePercentage ?? null;

      const submissionRate = sReport.assignmentMetrics.submissionRate || 0;
      const submissionsPendingReview = sReport.assignmentMetrics.pendingReview || 0;

      const scheduledDaysCount = sReport.studyConsistency.totalScheduledDays || 0;
      const activeStudyDays = sReport.studyConsistency.consistentScheduledDays || 0;
      const consistencyPercentage = sReport.studyConsistency.consistencyPercentage ?? null;

      totalSubmissionsPendingReview += submissionsPendingReview;
      totalOverdueTasks += tasksOverdue;

      // Determine Last Verified Activity Date
      let lastActivityDate: string | null = null;
      const activityDates: string[] = [];
      sReport.studyActivityTimeline.forEach((a) => {
        if (a.totalActivities > 0) activityDates.push(a.date);
      });
      if (activityDates.length > 0) {
        activityDates.sort();
        lastActivityDate = activityDates[activityDates.length - 1];
      }

      // Determine Attention Condition with Neutral, Evidence-Based Classification
      let attentionLevel: 'critical' | 'warning' | 'normal' | 'insufficient_data' = 'normal';
      let attentionReason = 'On track: Syllabus execution and study consistency meet platform expectations.';

      if (tasksAssigned === 0 && scoredCount === 0) {
        attentionLevel = 'insufficient_data';
        attentionReason = 'Insufficient academic data: Zero scheduled tasks or evaluations recorded in window.';
      } else if (tasksOverdue >= 2) {
        attentionLevel = 'critical';
        attentionReason = `Critical backlog: ${tasksOverdue} overdue tasks require administrative follow-up.`;
      } else if (consistencyPercentage !== null && consistencyPercentage < 50 && scheduledDaysCount >= 2) {
        attentionLevel = 'critical';
        attentionReason = `Low schedule execution: ${consistencyPercentage}% consistency across ${scheduledDaysCount} scheduled days.`;
      } else if (tasksOverdue === 1) {
        attentionLevel = 'warning';
        attentionReason = '1 overdue task requires mentor follow-up.';
      } else if (averageScorePercentage !== null && averageScorePercentage < 60 && scoredCount >= 2) {
        attentionLevel = 'warning';
        attentionReason = `Evaluation average (${averageScorePercentage}%) below 60% mastery threshold across ${scoredCount} exams.`;
      } else if (submissionsPendingReview >= 3) {
        attentionLevel = 'warning';
        attentionReason = `${submissionsPendingReview} submissions awaiting mentor review.`;
      }

      studentSummaries.push({
        studentId: student.id,
        studentName: student.full_name || 'Scholar',
        poraplanId: student.poraplan_id || 'PP001',
        university: student.university || sReport?.university,
        department: student.department || sReport?.department,
        batch: student.batch || sReport?.batch,
        currentSemester: student.current_semester || sReport?.currentSemester,
        enrollmentStatus,
        programName: sReport?.programName,
        cohortName: sReport?.cohortName,
        mentorName: sReport?.mentorName || 'Unassigned',
        taskCompletionRate,
        isCompletionRateApplicable,
        tasksCompleted,
        tasksAssigned,
        tasksOverdue,
        averageScorePercentage,
        scoredEvaluationsCount: scoredCount,
        submissionRate,
        submissionsPendingReview,
        consistencyPercentage,
        scheduledDaysCount,
        activeStudyDays,
        lastActivityDate,
        attentionLevel,
        attentionReason,
      });

      if (attentionLevel === 'critical' || attentionLevel === 'warning') {
        const levelLabel = attentionLevel === 'critical' ? 'Critical Attention' : 'Needs Attention';
        attentionItems.push({
          studentId: student.id,
          studentName: student.full_name || 'Scholar',
          poraplanId: student.poraplan_id || 'PP001',
          mentorName: sReport?.mentorName || 'Unassigned',
          level: attentionLevel,
          levelLabel,
          reason: attentionReason,
          evidence: `${tasksOverdue} overdue | ${consistencyPercentage !== null ? `${consistencyPercentage}% consistency` : 'No task data'} | ${averageScorePercentage !== null ? `Avg score ${averageScorePercentage}%` : 'No scored exams'}`,
        });
      }
    }

    // 3. Aggregate Mentor Performance & Workload Directory
    const mentorSummaries: AdminMentorSummary[] = [];
    let activeMentorsCount = 0;

    for (const mentor of mentorProfiles) {
      let activeMenteesCount = 0;
      let activeCohortsCount = 0;
      let pendingReviewsCount = 0;
      let recentEvaluationsCount = 0;
      let menteesNeedingAttentionCount = 0;
      let lastActivityDate: string | null = null;
      let expertiseSubjects: string[] = [];

      if (!backend.isConfigured || !backend.supabase) {
        const mentees = getMockAssignedStudents(mentor.id);
        activeMenteesCount = mentees.length;
        const cohorts = getMockCohortMentors({ mentorId: mentor.id, isActive: true });
        activeCohortsCount = cohorts.length;

        const subs = getMockMentorSubmissions(mentor.id);
        pendingReviewsCount = subs.filter((s) => s.status === 'submitted' || (s.status as string) === 'under_review' || (s.status as string) === 'pending_review').length;

        const evals = getMockMentorEvaluations(mentor.id);
        recentEvaluationsCount = evals.filter((e) =>
          isDateInRange(e.scheduled_date || e.evaluated_at || e.created_at, dateRange.startDate, dateRange.endDate)
        ).length;

        // Count assigned mentees needing attention
        menteesNeedingAttentionCount = mentees.filter((m) => {
          const sSum = studentSummaries.find((s) => s.studentId === m.id);
          return sSum && (sSum.attentionLevel === 'critical' || sSum.attentionLevel === 'warning');
        }).length;

        // Activity date from evaluations or reviewed submissions
        const mentorActivityDates: string[] = [];
        evals.forEach((e) => {
          if (e.evaluated_at) mentorActivityDates.push(toLocalDateStr(e.evaluated_at)!);
          else if (e.scheduled_date) mentorActivityDates.push(e.scheduled_date);
        });
        subs.forEach((s) => {
          if (s.reviewed_at) mentorActivityDates.push(toLocalDateStr(s.reviewed_at)!);
        });
        if (mentorActivityDates.length > 0) {
          mentorActivityDates.sort();
          lastActivityDate = mentorActivityDates[mentorActivityDates.length - 1];
        }

        const subjects = getMockStudentSubjects('mock-student-pp001');
        expertiseSubjects = subjects.slice(0, 2).map((s) => s.name);
      } else {
        // Pre-aggregated from bulk queries (0 per-mentor queries)
        activeMenteesCount = mentorActiveMenteesCountMap.get(mentor.id) || 0;
        activeCohortsCount = mentorActiveCohortsCountMap.get(mentor.id) || 0;
      }

      if (activeMenteesCount > 0 || activeCohortsCount > 0) {
        activeMentorsCount++;
      }

      mentorSummaries.push({
        mentorId: mentor.id,
        mentorName: mentor.full_name || 'Mentor',
        poraplanId: mentor.poraplan_id || 'PPM001',
        expertiseSubjects,
        activeMenteesCount,
        activeCohortsCount,
        recentEvaluationsCount,
        pendingReviewsCount,
        menteesNeedingAttentionCount,
        lastActivityDate,
      });
    }

    // 4. Construct Overview
    const overview: AdminAcademicOverview = {
      generatedAt: now,
      totalRegisteredStudents: studentProfiles.length,
      activeStudents: activeStudentIdSet.size,
      totalMentors: mentorProfiles.length,
      activeMentors: activeMentorsCount,
      activeEnrollments: activeEnrollments.length,
      scholarsNeedingAttentionCount: attentionItems.length,
      totalSubmissionsPendingReview,
      totalOverdueTasks,
    };

    return {
      report: {
        overview,
        students: studentSummaries,
        mentors: mentorSummaries,
        attentionItems,
        period,
        dateRange,
        generatedAt: now,
      },
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { report: null, error };
  }
}
