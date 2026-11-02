/**
 * PoraPlan — Academic Progress Reports Service Layer (Milestone 12)
 *
 * Implements Weekly, Monthly, and Custom Academic Progress Reports for Students and Mentors.
 * Enforces strict role-based access boundaries:
 * - Students can strictly generate reports for their own learning journey.
 * - Mentors can strictly generate reports for students actively assigned to them.
 *
 * All date calculations use local calendar dates via formatLocalDate() to eliminate
 * UTC boundary slips (especially for Bangladesh UTC+6).
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
}

async function getSupabaseBackend(): Promise<SupabaseBackend> {
  if (typeof window === 'undefined') {
    return {
      isConfigured: false,
      supabase: null,
      getAssignedStudents: null,
      getAssignedMentors: null,
      getStudentEvaluations: null,
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
      };
    }
    const [mentorship, evals] = await Promise.all([
      import('./mentorship'),
      import('./evaluations'),
    ]);
    return {
      isConfigured: true,
      supabase: sb.supabase,
      getAssignedStudents: mentorship.getAssignedStudents,
      getAssignedMentors: mentorship.getAssignedMentors,
      getStudentEvaluations: evals.getStudentEvaluations,
    };
  } catch {
    return {
      isConfigured: false,
      supabase: null,
      getAssignedStudents: null,
      getAssignedMentors: null,
      getStudentEvaluations: null,
    };
  }
}

export type ReportPeriod = 'weekly' | 'monthly' | 'custom';

export interface ReportDateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
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
  tasksCompletionRate: number; // 0-100
  assignmentsTotal: number;
  assignmentsSubmitted: number;
  assignmentsReviewed: number;
  assignmentsAverageScore: number | null; // 0-100
  evaluationsCompleted: number;
  evaluationsAverageScore: number | null; // 0-100
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

export interface StudentAcademicReport {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
  programName?: string;
  cohortName?: string;
  mentorName?: string;
  period: ReportPeriod;
  dateRange: ReportDateRange;
  generatedAt: string; // ISO 8601
  taskMetrics: {
    totalAssigned: number;
    completed: number;
    pending: number;
    inProgress: number;
    overdue: number;
    completionRate: number; // 0-100
    totalEstimatedMinutes: number;
    previousPeriodCompletionRate?: number | null;
  };
  assignmentMetrics: {
    totalAssigned: number;
    submitted: number;
    unsubmitted: number;
    pendingReview: number;
    reviewed: number;
    submissionRate: number; // 0-100
    averageScorePercentage: number | null;
    scoredCount: number;
  };
  evaluationMetrics: {
    totalScheduled: number;
    completed: number;
    cancelled: number;
    upcoming: number;
    averageScorePercentage: number | null;
    scoredCount: number;
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
  };
  subjectBreakdown: SubjectReportItem[];
  studyActivityTimeline: ActivityDayItem[];
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
  evaluationsCompleted: number;
  evaluationsScheduled: number;
  averageScorePercentage: number | null;
  needsAttention: boolean;
  attentionReason?: string;
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
    // Last 7 days (including today)
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 6);
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
    // Last 30 days (including today)
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 29);
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
 * Parse date string YYYY-MM-DD or ISO timestamp to YYYY-MM-DD local format
 */
function toLocalDateStr(dateVal?: string | null): string | null {
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
function isDateInRange(targetDateStr: string | null | undefined, startDate: string, endDate: string): boolean {
  if (!targetDateStr) return false;
  const normalized = toLocalDateStr(targetDateStr);
  if (!normalized) return false;
  return normalized >= startDate && normalized <= endDate;
}

/**
 * Generates an Academic Progress Report for a Student.
 */
export async function generateStudentReport(
  studentId: string,
  period: ReportPeriod,
  customStart?: string,
  customEnd?: string,
  options?: { referenceDate?: Date }
): Promise<{ report: StudentAcademicReport | null; error: Error | null }> {
  if (!studentId) {
    return { report: null, error: new Error('Student ID is required.') };
  }

  const dateRange = computeReportDateRange(period, customStart, customEnd, options?.referenceDate);
  const now = options?.referenceDate ? options.referenceDate.toISOString() : new Date().toISOString();
  const todayLocal = formatLocalDate(options?.referenceDate || new Date());

  const backend = await getSupabaseBackend();
  if (!backend.isConfigured || !backend.supabase) {
    return generateMockStudentReport(studentId, period, dateRange, now, todayLocal);
  }

  const { supabase, getAssignedMentors, getStudentEvaluations } = backend;

  try {
    // 1. Fetch Student Profile
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, poraplan_id, email')
      .eq('id', studentId)
      .single();

    if (profileErr || !profile) {
      return { report: null, error: profileErr || new Error('Student profile not found.') };
    }

    // 2. Fetch Active Enrollment & Mentor
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

    const report = buildStudentReportFromData({
      studentId: profile.id,
      studentName: profile.full_name || 'Scholar',
      poraplanId: profile.poraplan_id || 'PP001',
      studentEmail: profile.email,
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
    });

    return { report, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { report: null, error };
  }
}

/**
 * Builds StudentAcademicReport from resolved collections.
 */
function buildStudentReportFromData(params: {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
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
}): StudentAcademicReport {
  const { dateRange, todayLocal } = params;

  // Filter tasks belonging to reporting window (due_date or created_at in range, or completed in range)
  const tasksInWindow = params.tasks.filter((t) => {
    const createdInRange = isDateInRange(t.created_at, dateRange.startDate, dateRange.endDate);
    const dueInRange = isDateInRange(t.due_date, dateRange.startDate, dateRange.endDate);
    const completedInRange = isDateInRange(t.completed_at, dateRange.startDate, dateRange.endDate);
    return createdInRange || dueInRange || completedInRange;
  });

  const totalAssignedTasks = tasksInWindow.length;
  const completedTasks = tasksInWindow.filter((t) => t.status === 'completed').length;
  const pendingTasks = tasksInWindow.filter((t) => t.status === 'pending').length;
  const inProgressTasks = tasksInWindow.filter((t) => t.status === 'in_progress').length;
  const overdueTasks = tasksInWindow.filter(
    (t) => t.due_date && t.due_date < todayLocal && t.status !== 'completed'
  ).length;
  const taskCompletionRate = totalAssignedTasks > 0 ? Math.round((completedTasks / totalAssignedTasks) * 100) : 0;
  const totalEstimatedMinutes = tasksInWindow
    .filter((t) => t.status === 'completed')
    .reduce((sum, t) => sum + (t.estimated_minutes || 0), 0);

  // Assignments & Submissions
  const asgsInWindow = params.assignments.filter((a) => {
    const createdInRange = isDateInRange(a.created_at, dateRange.startDate, dateRange.endDate);
    const dueInRange = isDateInRange(a.due_date, dateRange.startDate, dateRange.endDate);
    return createdInRange || dueInRange;
  });

  let totalAssignedAsgs = asgsInWindow.length;
  let submittedAsgs = 0;
  let unsubmittedAsgs = 0;
  let pendingReviewAsgs = 0;
  let reviewedAsgs = 0;
  let scoreSum = 0;
  let scoredCount = 0;

  asgsInWindow.forEach((a) => {
    const submissionsList = Array.isArray(a.submissions) ? a.submissions : a.submissions ? [a.submissions] : [];
    const submission = submissionsList.find((s: Submission) => s.student_id === params.studentId) || a.submission;

    if (submission) {
      submittedAsgs++;
      if (submission.status === 'reviewed') {
        reviewedAsgs++;
        if (typeof submission.score === 'number' && typeof a.total_points === 'number' && a.total_points > 0) {
          scoreSum += (submission.score / a.total_points) * 100;
          scoredCount++;
        }
      } else {
        pendingReviewAsgs++;
      }
    } else {
      unsubmittedAsgs++;
    }
  });

  const assignmentSubmissionRate =
    totalAssignedAsgs > 0 ? Math.round((submittedAsgs / totalAssignedAsgs) * 100) : 0;
  const assignmentAverageScore =
    scoredCount > 0 ? Math.round((scoreSum / scoredCount) * 10) / 10 : null;

  // Evaluations
  const evalsInWindow = params.evaluations.filter((e) =>
    isDateInRange(e.scheduled_date, dateRange.startDate, dateRange.endDate)
  );

  const totalScheduledEvals = evalsInWindow.length;
  const completedEvals = evalsInWindow.filter((e) => e.status === 'completed');
  const cancelledEvals = evalsInWindow.filter((e) => e.status === 'cancelled').length;
  const upcomingEvals = evalsInWindow.filter((e) => e.status === 'scheduled').length;

  let evalScoreSum = 0;
  let evalScoredCount = 0;
  completedEvals.forEach((e) => {
    if (typeof e.score === 'number' && typeof e.total_points === 'number' && e.total_points > 0) {
      evalScoreSum += (e.score / e.total_points) * 100;
      evalScoredCount++;
    }
  });

  const evalAverageScore =
    evalScoredCount > 0 ? Math.round((evalScoreSum / evalScoredCount) * 10) / 10 : null;

  const recentFeedback = completedEvals
    .filter((e) => Boolean(e.feedback || e.recommendation))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      title: e.title,
      date: e.scheduled_date,
      subjectName: e.subject_name || e.subjects?.name,
      mentorName: e.mentor_name,
      scorePercentage:
        typeof e.score === 'number' && e.total_points ? Math.round((e.score / e.total_points) * 100) : null,
      feedback: e.feedback,
      recommendation: e.recommendation,
    }));

  // Subject Breakdown
  const subjectBreakdown: SubjectReportItem[] = params.subjects.map((s) => {
    const sTasks = tasksInWindow.filter((t) => t.subject_id === s.id);
    const sTasksTotal = sTasks.length;
    const sTasksCompleted = sTasks.filter((t) => t.status === 'completed').length;
    const sTasksRate = sTasksTotal > 0 ? Math.round((sTasksCompleted / sTasksTotal) * 100) : 0;

    const sAsgs = asgsInWindow.filter((a) => a.subject_id === s.id);
    const sAsgsTotal = sAsgs.length;
    let sAsgsSubmitted = 0;
    let sAsgsReviewed = 0;
    let sAsgsScoreSum = 0;
    let sAsgsScoredCount = 0;

    sAsgs.forEach((a) => {
      const submissionsList = Array.isArray(a.submissions) ? a.submissions : a.submissions ? [a.submissions] : [];
      const subm = submissionsList.find((sub: Submission) => sub.student_id === params.studentId) || a.submission;
      if (subm) {
        sAsgsSubmitted++;
        if (subm.status === 'reviewed') {
          sAsgsReviewed++;
          if (typeof subm.score === 'number' && typeof a.total_points === 'number' && a.total_points > 0) {
            sAsgsScoreSum += (subm.score / a.total_points) * 100;
            sAsgsScoredCount++;
          }
        }
      }
    });

    const sAsgsAvg = sAsgsScoredCount > 0 ? Math.round((sAsgsScoreSum / sAsgsScoredCount) * 10) / 10 : null;

    const sEvals = completedEvals.filter((e) => e.subject_id === s.id);
    const sEvalsCount = sEvals.length;
    let sEvalsScoreSum = 0;
    let sEvalsScoredCount = 0;
    sEvals.forEach((e) => {
      if (typeof e.score === 'number' && typeof e.total_points === 'number' && e.total_points > 0) {
        sEvalsScoreSum += (e.score / e.total_points) * 100;
        sEvalsScoredCount++;
      }
    });
    const sEvalsAvg = sEvalsScoredCount > 0 ? Math.round((sEvalsScoreSum / sEvalsScoredCount) * 10) / 10 : null;

    // Attention condition: tasks completion rate < 60% with pending tasks, or eval score < 60%
    const needsAttention =
      (sTasksTotal > 0 && sTasksRate < 60) ||
      (sEvalsAvg !== null && sEvalsAvg < 60) ||
      (sAsgsTotal > 0 && sAsgsSubmitted < sAsgsTotal);

    let attentionReason: string | undefined = undefined;
    if (sTasksTotal > 0 && sTasksRate < 60) {
      attentionReason = `Low task completion rate (${sTasksRate}%).`;
    } else if (sAsgsTotal > sAsgsSubmitted) {
      attentionReason = `${sAsgsTotal - sAsgsSubmitted} unsubmitted practice assignment(s).`;
    } else if (sEvalsAvg !== null && sEvalsAvg < 60) {
      attentionReason = `Evaluation score average (${sEvalsAvg}%) below target threshold.`;
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
      evaluationsAverageScore: sEvalsAvg,
      needsAttention,
      attentionReason,
    };
  });

  // Daily Study Activity Timeline
  const activityMap = new Map<string, { tasks: number; asgs: number; evals: number }>();

  tasksInWindow.forEach((t) => {
    if (t.status === 'completed' && t.completed_at) {
      const d = toLocalDateStr(t.completed_at);
      if (d && d >= dateRange.startDate && d <= dateRange.endDate) {
        const curr = activityMap.get(d) || { tasks: 0, asgs: 0, evals: 0 };
        curr.tasks++;
        activityMap.set(d, curr);
      }
    }
  });

  asgsInWindow.forEach((a) => {
    const submissionsList = Array.isArray(a.submissions) ? a.submissions : a.submissions ? [a.submissions] : [];
    const subm = submissionsList.find((sub: Submission) => sub.student_id === params.studentId) || a.submission;
    if (subm && subm.submitted_at) {
      const d = toLocalDateStr(subm.submitted_at);
      if (d && d >= dateRange.startDate && d <= dateRange.endDate) {
        const curr = activityMap.get(d) || { tasks: 0, asgs: 0, evals: 0 };
        curr.asgs++;
        activityMap.set(d, curr);
      }
    }
  });

  completedEvals.forEach((e) => {
    const d = e.scheduled_date || toLocalDateStr(e.evaluated_at);
    if (d && d >= dateRange.startDate && d <= dateRange.endDate) {
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

  return {
    studentId: params.studentId,
    studentName: params.studentName,
    poraplanId: params.poraplanId,
    studentEmail: params.studentEmail,
    programName: params.programName,
    cohortName: params.cohortName,
    mentorName: params.mentorName,
    period: params.period,
    dateRange: params.dateRange,
    generatedAt: params.now,
    taskMetrics: {
      totalAssigned: totalAssignedTasks,
      completed: completedTasks,
      pending: pendingTasks,
      inProgress: inProgressTasks,
      overdue: overdueTasks,
      completionRate: taskCompletionRate,
      totalEstimatedMinutes,
    },
    assignmentMetrics: {
      totalAssigned: totalAssignedAsgs,
      submitted: submittedAsgs,
      unsubmitted: unsubmittedAsgs,
      pendingReview: pendingReviewAsgs,
      reviewed: reviewedAsgs,
      submissionRate: assignmentSubmissionRate,
      averageScorePercentage: assignmentAverageScore,
      scoredCount,
    },
    evaluationMetrics: {
      totalScheduled: totalScheduledEvals,
      completed: completedEvals.length,
      cancelled: cancelledEvals,
      upcoming: upcomingEvals,
      averageScorePercentage: evalAverageScore,
      scoredCount: evalScoredCount,
      recentFeedback,
    },
    subjectBreakdown,
    studyActivityTimeline,
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
  todayLocal: string
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

  // Active program / mentor
  const enrollments = getMockEnrollments({ studentId: normalizedId, status: 'active' });
  const activeEnr = enrollments[0];
  const program = activeEnr ? getMockPrograms().find((p) => p.id === activeEnr.program_id) : undefined;
  const cohort = activeEnr?.cohort_id ? getMockCohorts().find((c) => c.id === activeEnr.cohort_id) : undefined;
  const assignedMentors = getMockAssignedMentors(normalizedId);
  const mentor = assignedMentors[0];

  const report = buildStudentReportFromData({
    studentId: normalizedId,
    studentName: user.full_name || 'Scholar',
    poraplanId: user.poraplan_id || 'PP001',
    studentEmail: user.email,
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
  options?: { referenceDate?: Date }
): Promise<{ report: MentorAcademicReport | null; error: Error | null }> {
  if (!mentorId) {
    return { report: null, error: new Error('Mentor ID is required.') };
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
  let totalEvaluationsCompleted = 0;
  let totalEvaluationsUpcoming = 0;
  let scholarsNeedingAttentionCount = 0;

  for (const student of assignedStudents) {
    const { report: sReport } = await generateStudentReport(
      student.id,
      period,
      customStart,
      customEnd,
      options
    );

    if (sReport) {
      totalTasksAssigned += sReport.taskMetrics.totalAssigned;
      totalTasksCompleted += sReport.taskMetrics.completed;
      totalSubmissionsPendingReview += sReport.assignmentMetrics.pendingReview;
      totalEvaluationsCompleted += sReport.evaluationMetrics.completed;
      totalEvaluationsUpcoming += sReport.evaluationMetrics.upcoming;

      const needsAttention =
        sReport.taskMetrics.overdue > 0 ||
        sReport.taskMetrics.completionRate < 60 ||
        (sReport.evaluationMetrics.averageScorePercentage !== null &&
          sReport.evaluationMetrics.averageScorePercentage < 60);

      let attentionReason: string | undefined = undefined;
      if (sReport.taskMetrics.overdue > 0) {
        attentionReason = `${sReport.taskMetrics.overdue} overdue task(s) in backlog.`;
      } else if (sReport.taskMetrics.completionRate < 60) {
        attentionReason = `Low task completion rate (${sReport.taskMetrics.completionRate}%).`;
      } else if (
        sReport.evaluationMetrics.averageScorePercentage !== null &&
        sReport.evaluationMetrics.averageScorePercentage < 60
      ) {
        attentionReason = `Average evaluation score (${sReport.evaluationMetrics.averageScorePercentage}%) below target.`;
      }

      if (needsAttention) {
        scholarsNeedingAttentionCount++;
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
        evaluationsCompleted: sReport.evaluationMetrics.completed,
        evaluationsScheduled: sReport.evaluationMetrics.upcoming,
        averageScorePercentage: sReport.evaluationMetrics.averageScorePercentage,
        needsAttention,
        attentionReason,
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
        totalEvaluationsCompleted,
        totalEvaluationsUpcoming,
        scholarsNeedingAttentionCount,
      },
    },
    error: null,
  };
}
