/**
 * PoraPlan — Academic Performance & Improvement Reporting Service Layer (Milestone 12.2)
 *
 * Implements an evidence-based, deterministic reporting engine for Students and Mentors.
 *
 * Core Principles:
 * 1. Consistent Cohort Logic: Tasks and assignments due within the reporting window form
 *    the primary cohort denominator.
 * 2. Unambiguous Cohort Cutoffs: Distinguishes on-time vs. late completions and avoids mixing
 *    all-time backlog counts with window-filtered completion percentages.
 * 3. Weighted Evaluation Mastery: (total scored points earned / total possible points) * 100.
 *    Unscored walkthroughs/oral reviews are excluded from numeric averages and preserved as qualitative feedback.
 * 4. Unique Assignment Distinction: Revisions do not inflate the unique count of submitted assignments.
 * 5. Verified Study Consistency: Active study days are counted from verified task completions,
 *    assignment submissions, and evaluations on unique local calendar dates (UTC+6 Bangladesh Standard Time).
 * 6. Evidence-Based Insights (3 Tiers):
 *    - Tier 1: Calculated Academic Facts (pure deterministic numbers)
 *    - Tier 2: Rule-Based Observations (objective thresholds for strengths and attention areas)
 *    - Tier 3: Stored Mentor Judgment (actual feedback and recommendations from evaluation records)
 * 7. Actionable Improvement Recommendations: Max 3 prioritized, transparent, deterministic action items.
 * 8. Strict Authorization: Mentors can only query students actively assigned to them.
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

export type ReportPeriod = 'weekly' | 'monthly' | 'custom';

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
  studyConsistency: {
    activeStudyDays: number;
    totalPeriodDays: number;
    consistencyPercentage: number;
    verifiedEventsCount: number;
  };
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
 * Enforces role-based caller authorization when requesting user credentials are provided.
 */
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

  const dateRange = computeReportDateRange(period, customStart, customEnd, options?.referenceDate);
  const now = options?.referenceDate ? options.referenceDate.toISOString() : new Date().toISOString();
  const todayLocal = formatLocalDate(options?.referenceDate || new Date());

  const backend = await getSupabaseBackend();

  // Role Authorization Verification
  if (options?.requestingUserId && options?.requestingUserRole) {
    const { requestingUserId, requestingUserRole } = options;

    if (requestingUserRole === 'student') {
      const normReq = requestingUserId === 'PP001' ? 'mock-student-pp001' : requestingUserId;
      const normTarget = studentId === 'PP001' ? 'mock-student-pp001' : studentId;
      if (normReq !== normTarget && requestingUserId !== studentId) {
        return {
          report: null,
          error: new Error('Unauthorized: Students can only access their own academic reports.'),
        };
      }
    } else if (requestingUserRole === 'mentor') {
      let isAssigned = false;
      if (!backend.isConfigured || !backend.getAssignedStudents) {
        const mentees = getMockAssignedStudents(requestingUserId);
        isAssigned = mentees.some(
          (m) => m.id === studentId || m.poraplan_id === studentId || studentId === 'mock-student-pp001'
        );
      } else {
        const { students } = await backend.getAssignedStudents(requestingUserId);
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
    }
  }

  if (!backend.isConfigured || !backend.supabase) {
    return generateMockStudentReport(studentId, period, dateRange, now, todayLocal, options?.referenceDate);
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

    // Optional: Calculate previous period data for trend comparison
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

  // Also count any outstanding tasks across all time that are currently overdue (for backlog radar)
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
  // 4. VERIFIED STUDY CONSISTENCY (ACTIVE STUDY DAYS)
  // Count of distinct local calendar dates in Bangladesh (UTC+6) with >=1 verified completion
  // --------------------------------------------------------------------------
  const activeDatesSet = new Set<string>();
  const activityMap = new Map<string, { tasks: number; asgs: number; evals: number }>();

  function registerActivity(dateStr: string | null, type: 'tasks' | 'asgs' | 'evals') {
    if (!dateStr || !isDateInRange(dateStr, dateRange.startDate, dateRange.endDate)) return;
    activeDatesSet.add(dateStr);
    const curr = activityMap.get(dateStr) || { tasks: 0, asgs: 0, evals: 0 };
    curr[type]++;
    activityMap.set(dateStr, curr);
  }

  // A. Tasks completed
  params.tasks.forEach((t) => {
    if (t.status === 'completed' && t.completed_at) {
      registerActivity(toLocalDateStr(t.completed_at), 'tasks');
    }
  });

  // B. Assignments submitted
  eligibleAssignments.forEach((a) => {
    const rawList: Submission[] = Array.isArray(a.submissions)
      ? a.submissions
      : a.submissions
      ? [a.submissions]
      : [];
    const sub = rawList.find((s) => s.student_id === params.studentId) || a.submission;
    if (sub && sub.submitted_at) {
      registerActivity(toLocalDateStr(sub.submitted_at), 'asgs');
    }
  });

  // C. Evaluations completed
  completedEvals.forEach((e) => {
    const d = e.scheduled_date || toLocalDateStr(e.evaluated_at);
    registerActivity(d, 'evals');
  });

  const activeStudyDays = activeDatesSet.size;
  const consistencyPercentage =
    dateRange.daysCount > 0 ? Math.round((activeStudyDays / dateRange.daysCount) * 100) : 0;

  const studyActivityTimeline: ActivityDayItem[] = Array.from(activityMap.entries())
    .map(([date, counts]) => ({
      date,
      tasksCompleted: counts.tasks,
      assignmentsSubmitted: counts.asgs,
      evaluationsCompleted: counts.evals,
      totalActivities: counts.tasks + counts.asgs + counts.evals,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const verifiedEventsCount = studyActivityTimeline.reduce(
    (sum, d) => sum + d.totalActivities,
    0
  );

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
  // Level 1: Deterministic Calculated Facts
  // Level 2: Rule-Based Observations
  // Level 3: Stored Mentor Judgment
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

  facts.push(
    `Maintained an active study cadence on ${activeStudyDays} of ${dateRange.daysCount} calendar days (${consistencyPercentage}% consistency).`
  );

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
  // Transparent, deterministic, rule-driven next steps with measurable success indicators.
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
      evidence: `Strong study rhythm with ${activeStudyDays} active days in this reporting period.`,
      recommendedAction: 'Continue daily study sessions and prepare for the upcoming curriculum milestone.',
      measurableSuccessIndicator: `Maintain >= 80% task completion and active study cadence.`,
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
      activeStudyDays,
      totalPeriodDays: dateRange.daysCount,
      consistencyPercentage,
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
 * Mock implementation of Student Progress Report.
 */
function generateMockStudentReport(
  studentId: string,
  period: ReportPeriod,
  dateRange: ReportDateRange,
  now: string,
  todayLocal: string,
  _referenceDate?: Date
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

  // Caller Verification: if requestingUser is mentor, must match mentorId
  if (
    options?.requestingUserId &&
    options?.requestingUserRole === 'mentor' &&
    options.requestingUserId !== mentorId
  ) {
    return {
      report: null,
      error: new Error('Unauthorized: You can only generate reports for your own mentor account.'),
    };
  }

  const dateRange = computeReportDateRange(period, customStart, customEnd, options?.referenceDate);
  const now = options?.referenceDate ? options.referenceDate.toISOString() : new Date().toISOString();

  const backend = await getSupabaseBackend();

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
        requestingUserId: mentorId,
        requestingUserRole: 'mentor',
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
        activeStudyDays: sReport.studyConsistency.activeStudyDays,
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
