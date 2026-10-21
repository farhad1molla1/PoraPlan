import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Subject,
  StudyPlan,
  StudyPlanItem,
  Task,
  Assignment,
  Submission,
  Evaluation,
} from '../types/database';
import {
  getMockStudentAcademicProgress,
  getMockMentorScholarsProgress,
  getMockScholarProgressDetail,
} from './mockAuthStore';
import { getAssignedStudents } from './mentorship';

export type ActivityType =
  | 'task_completed'
  | 'task_created'
  | 'assignment_submitted'
  | 'assignment_reviewed'
  | 'evaluation_completed'
  | 'evaluation_scheduled';

export interface AcademicActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  timestamp: string; // ISO 8601 string
  subjectName?: string;
  details?: string;
  statusBadge?: {
    label: string;
    variant: 'teal' | 'gold' | 'navy' | 'paper' | 'muted';
  };
}

export interface SubjectProgressItem {
  subjectId: string;
  subjectName: string;
  subjectCode?: string | null;
  status: 'active' | 'archived';
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  assignments: {
    total: number;
    submitted: number;
    reviewed: number;
  };
  evaluations: {
    total: number;
    completed: number;
    averageScorePercentage: number | null;
  };
  studyPlansCount: number;
}

export interface StudentProgressSummary {
  studentId: string;
  studentName?: string;
  poraplanId?: string;
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    completionRate: number; // 0 to 100
  };
  assignments: {
    totalAssigned: number;
    submitted: number;
    unsubmitted: number;
    pendingReview: number;
    reviewed: number;
    submissionRate: number; // 0 to 100
    averageScorePercentage: number | null;
  };
  evaluations: {
    total: number;
    completed: number;
    scheduled: number;
    inProgress: number;
    cancelled: number;
    completionRate: number; // 0 to 100
    averageScorePercentage: number | null;
  };
  studyPlans: {
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    totalItems: number;
    completedItems: number;
    itemCompletionRate: number;
  };
  subjectsProgress: SubjectProgressItem[];
  recentActivity: AcademicActivityItem[];
}

export interface ScholarProgressOverview {
  studentId: string;
  studentName: string;
  poraplanId: string;
  studentEmail?: string;
  tasks: {
    total: number;
    completed: number;
    completionRate: number;
  };
  assignments: {
    totalAssigned: number;
    submitted: number;
    pendingReview: number;
  };
  evaluations: {
    total: number;
    completed: number;
    scheduled: number;
  };
  studyPlansCount: number;
  subjectsCount: number;
  lastActiveTimestamp?: string | null;
}

/**
 * Pure calculation helper: transforms raw persisted rows into a deterministic, truthful StudentProgressSummary.
 * Ensures zero division safety, no fake metrics, and truthful empty states.
 */
export function calculateStudentProgress(params: {
  studentId: string;
  studentName?: string;
  poraplanId?: string;
  subjects: Subject[];
  plans: (StudyPlan & { items?: StudyPlanItem[] })[];
  tasks: (Task & { subjects?: { name: string } | null })[];
  assignments: (Assignment & { subjects?: { name: string } | null })[];
  submissions: (Submission & { assignments?: { title: string; total_points?: number | null; subject_id?: string | null; subjects?: { name: string } | null } | null })[];
  evaluations: (Evaluation & { subjects?: { name: string } | null })[];
}): StudentProgressSummary {
  const { studentId, studentName, poraplanId, subjects, plans, tasks, assignments, submissions, evaluations } = params;

  // 1. Task metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;
  const pendingTasks = tasks.filter((t) => t.status === 'pending').length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // 2. Assignment & Practice metrics
  const totalAssigned = assignments.length;
  const submittedCount = submissions.length;
  const unsubmittedCount = Math.max(0, totalAssigned - submittedCount);
  const pendingReviewCount = submissions.filter((s) => s.status === 'submitted' || s.status === 'under_review').length;
  const reviewedCount = submissions.filter((s) => s.status === 'reviewed' || s.status === 'needs_revision').length;
  const submissionRate = totalAssigned > 0 ? Math.round((submittedCount / totalAssigned) * 100) : 0;

  // Assignment average score: only evaluated submissions with valid points
  const gradedSubmissions = submissions.filter((s) => {
    const parentAssignment = assignments.find((a) => a.id === s.assignment_id) || s.assignments;
    const maxPts = parentAssignment?.total_points;
    return (
      (s.status === 'reviewed' || s.status === 'needs_revision') &&
      s.score !== null &&
      s.score !== undefined &&
      typeof maxPts === 'number' &&
      maxPts > 0
    );
  });

  let averageAssignmentScore: number | null = null;
  if (gradedSubmissions.length > 0) {
    const totalScorePct = gradedSubmissions.reduce((acc, s) => {
      const parentAssignment = assignments.find((a) => a.id === s.assignment_id) || s.assignments;
      const maxPts = Number(parentAssignment?.total_points || 100);
      return acc + (Number(s.score) / maxPts) * 100;
    }, 0);
    averageAssignmentScore = Math.round((totalScorePct / gradedSubmissions.length) * 10) / 10;
  }

  // 3. Milestone Evaluations metrics
  const totalEvaluations = evaluations.length;
  const completedEvaluations = evaluations.filter((e) => e.status === 'completed').length;
  const scheduledEvaluations = evaluations.filter((e) => e.status === 'scheduled').length;
  const inProgressEvaluations = evaluations.filter((e) => e.status === 'in_progress').length;
  const cancelledEvaluations = evaluations.filter((e) => e.status === 'cancelled').length;
  const nonCancelledEvals = totalEvaluations - cancelledEvaluations;
  const evaluationCompletionRate = nonCancelledEvals > 0 ? Math.round((completedEvaluations / nonCancelledEvals) * 100) : 0;

  const gradedEvaluations = evaluations.filter(
    (e) => e.status === 'completed' && e.score !== null && e.score !== undefined && e.total_points && Number(e.total_points) > 0
  );
  let averageEvaluationScore: number | null = null;
  if (gradedEvaluations.length > 0) {
    const totalEvalScorePct = gradedEvaluations.reduce((acc, e) => {
      const maxPts = Number(e.total_points || 100);
      return acc + (Number(e.score) / maxPts) * 100;
    }, 0);
    averageEvaluationScore = Math.round((totalEvalScorePct / gradedEvaluations.length) * 10) / 10;
  }

  // 4. Study Plans & Syllabus items
  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.status === 'active').length;
  const completedPlans = plans.filter((p) => p.status === 'completed').length;
  
  let totalPlanItems = 0;
  let completedPlanItems = 0;
  plans.forEach((p) => {
    if (p.items && Array.isArray(p.items)) {
      totalPlanItems += p.items.length;
      completedPlanItems += p.items.filter((item) => item.status === 'completed').length;
    }
  });
  const itemCompletionRate = totalPlanItems > 0 ? Math.round((completedPlanItems / totalPlanItems) * 100) : 0;

  // 5. Subject-wise breakdown
  const subjectsProgress: SubjectProgressItem[] = subjects.map((subj) => {
    const subjTasks = tasks.filter((t) => t.subject_id === subj.id);
    const subjCompletedTasks = subjTasks.filter((t) => t.status === 'completed').length;
    const subjTaskRate = subjTasks.length > 0 ? Math.round((subjCompletedTasks / subjTasks.length) * 100) : 0;

    const subjAssignments = assignments.filter((a) => a.subject_id === subj.id);
    const subjSubmissions = submissions.filter((s) => {
      const parentAssign = assignments.find((a) => a.id === s.assignment_id);
      return parentAssign?.subject_id === subj.id || s.assignments?.subject_id === subj.id;
    });
    const subjReviewedSubmissions = subjSubmissions.filter((s) => s.status === 'reviewed' || s.status === 'needs_revision').length;

    const subjEvaluations = evaluations.filter((e) => e.subject_id === subj.id);
    const subjCompletedEvals = subjEvaluations.filter((e) => e.status === 'completed');
    const subjGradedEvals = subjCompletedEvals.filter((e) => e.score !== null && e.score !== undefined && e.total_points && Number(e.total_points) > 0);
    let subjAvgScore: number | null = null;
    if (subjGradedEvals.length > 0) {
      const sumPct = subjGradedEvals.reduce((acc, e) => acc + (Number(e.score) / Number(e.total_points)) * 100, 0);
      subjAvgScore = Math.round((sumPct / subjGradedEvals.length) * 10) / 10;
    }

    const subjPlans = plans.filter((p) => p.subject_id === subj.id);

    return {
      subjectId: subj.id,
      subjectName: subj.name,
      subjectCode: subj.code,
      status: subj.status,
      tasks: {
        total: subjTasks.length,
        completed: subjCompletedTasks,
        completionRate: subjTaskRate,
      },
      assignments: {
        total: subjAssignments.length,
        submitted: subjSubmissions.length,
        reviewed: subjReviewedSubmissions,
      },
      evaluations: {
        total: subjEvaluations.length,
        completed: subjCompletedEvals.length,
        averageScorePercentage: subjAvgScore,
      },
      studyPlansCount: subjPlans.length,
    };
  });

  // 6. Chronological Recent Activity (Derived strictly from real timestamps)
  const activityList: AcademicActivityItem[] = [];

  tasks.forEach((t) => {
    const subjName = t.subjects?.name || subjects.find((s) => s.id === t.subject_id)?.name;
    if (t.completed_at) {
      activityList.push({
        id: `act-task-comp-${t.id}`,
        type: 'task_completed',
        title: `Completed Study Task: ${t.title}`,
        timestamp: t.completed_at,
        subjectName: subjName,
        details: 'Task marked completed by scholar.',
        statusBadge: { label: 'Task Done', variant: 'teal' },
      });
    } else if (t.created_at) {
      activityList.push({
        id: `act-task-creat-${t.id}`,
        type: 'task_created',
        title: `Assigned Study Task: ${t.title}`,
        timestamp: t.created_at,
        subjectName: subjName,
        details: `Priority: ${t.priority.toUpperCase()}`,
        statusBadge: { label: 'Task Active', variant: 'paper' },
      });
    }
  });

  submissions.forEach((s) => {
    const parent = assignments.find((a) => a.id === s.assignment_id) || s.assignments;
    const title = parent?.title || 'Practice Set';
    const subjName = parent?.subjects?.name || subjects.find((sub) => sub.id === parent?.subject_id)?.name;

    if (s.reviewed_at) {
      const scoreStr = s.score !== null ? `Score: ${s.score} pts.` : '';
      activityList.push({
        id: `act-subm-rev-${s.id}`,
        type: 'assignment_reviewed',
        title: `Mentor Feedback Received: ${title}`,
        timestamp: s.reviewed_at,
        subjectName: subjName,
        details: s.feedback ? `${s.feedback} ${scoreStr}`.trim() : scoreStr,
        statusBadge: { label: s.status === 'needs_revision' ? 'Revision Needed' : 'Reviewed', variant: s.status === 'needs_revision' ? 'gold' : 'teal' },
      });
    } else if (s.submitted_at) {
      activityList.push({
        id: `act-subm-sub-${s.id}`,
        type: 'assignment_submitted',
        title: `Submitted Practice Solution: ${title}`,
        timestamp: s.submitted_at,
        subjectName: subjName,
        details: `Type: ${s.submission_type.toUpperCase()}`,
        statusBadge: { label: 'Submitted', variant: 'navy' },
      });
    }
  });

  evaluations.forEach((e) => {
    const subjName = e.subjects?.name || subjects.find((s) => s.id === e.subject_id)?.name;
    if (e.evaluated_at && e.status === 'completed') {
      const scoreStr = e.score !== null ? `Result: ${e.score} / ${e.total_points ?? 100}` : '';
      activityList.push({
        id: `act-eval-comp-${e.id}`,
        type: 'evaluation_completed',
        title: `Milestone Assessment Completed: ${e.title}`,
        timestamp: e.evaluated_at,
        subjectName: subjName,
        details: e.feedback ? `${e.feedback} ${scoreStr}`.trim() : scoreStr,
        statusBadge: { label: 'Graded', variant: 'teal' },
      });
    } else if (e.created_at) {
      activityList.push({
        id: `act-eval-sched-${e.id}`,
        type: 'evaluation_scheduled',
        title: `Milestone Assessment Scheduled: ${e.title}`,
        timestamp: e.created_at,
        subjectName: subjName,
        details: `Format: ${e.format.toUpperCase()} · Scheduled for ${e.scheduled_date}`,
        statusBadge: { label: 'Scheduled', variant: 'gold' },
      });
    }
  });

  // Sort descending by real timestamp
  activityList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    studentId,
    studentName,
    poraplanId,
    tasks: {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      pending: pendingTasks,
      completionRate: taskCompletionRate,
    },
    assignments: {
      totalAssigned,
      submitted: submittedCount,
      unsubmitted: unsubmittedCount,
      pendingReview: pendingReviewCount,
      reviewed: reviewedCount,
      submissionRate,
      averageScorePercentage: averageAssignmentScore,
    },
    evaluations: {
      total: totalEvaluations,
      completed: completedEvaluations,
      scheduled: scheduledEvaluations,
      inProgress: inProgressEvaluations,
      cancelled: cancelledEvaluations,
      completionRate: evaluationCompletionRate,
      averageScorePercentage: averageEvaluationScore,
    },
    studyPlans: {
      totalPlans,
      activePlans,
      completedPlans,
      totalItems: totalPlanItems,
      completedItems: completedPlanItems,
      itemCompletionRate,
    },
    subjectsProgress,
    recentActivity: activityList.slice(0, 15),
  };
}

/**
 * Fetch complete academic progress summary for a student.
 * Enforces database authorization and Supabase RLS.
 */
export async function getStudentAcademicProgress(studentId: string): Promise<{
  progress: StudentProgressSummary | null;
  error: Error | null;
}> {
  if (!studentId) {
    return { progress: null, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const summary = getMockStudentAcademicProgress(studentId);
    return { progress: summary, error: null };
  }

  try {
    // Parallel authorized queries over existing tables (RLS protected)
    const [profileRes, subjectsRes, plansRes, tasksRes, assignmentsRes, submissionsRes, evaluationsRes] = await Promise.all([
      supabase.from('profiles').select('full_name, poraplan_id').eq('id', studentId).maybeSingle(),
      supabase.from('subjects').select('*').eq('student_id', studentId).order('name'),
      supabase.from('study_plans').select('*, study_plan_items(*)').eq('student_id', studentId),
      supabase.from('tasks').select('*, subjects(name)').eq('student_id', studentId),
      supabase.from('assignments').select('*, subjects(name)').eq('student_id', studentId),
      supabase.from('submissions').select('*, assignments(title, total_points, subject_id, subjects(name))').eq('student_id', studentId),
      supabase.from('evaluations').select('*, subjects(name)').eq('student_id', studentId),
    ]);

    if (subjectsRes.error) throw subjectsRes.error;
    if (plansRes.error) throw plansRes.error;
    if (tasksRes.error) throw tasksRes.error;
    if (assignmentsRes.error) throw assignmentsRes.error;
    if (submissionsRes.error) throw submissionsRes.error;
    if (evaluationsRes.error) throw evaluationsRes.error;

    const formattedPlans = (plansRes.data || []).map((row: any) => ({
      ...row,
      items: row.study_plan_items || [],
    }));

    const progress = calculateStudentProgress({
      studentId,
      studentName: profileRes.data?.full_name,
      poraplanId: profileRes.data?.poraplan_id || undefined,
      subjects: (subjectsRes.data as Subject[]) || [],
      plans: formattedPlans,
      tasks: tasksRes.data || [],
      assignments: assignmentsRes.data || [],
      submissions: submissionsRes.data || [],
      evaluations: evaluationsRes.data || [],
    });

    return { progress, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { progress: null, error };
  }
}

/**
 * Fetch progress overview for all students assigned to the mentor.
 * Mentors view only their assigned students.
 */
export async function getMentorScholarsProgress(mentorId: string): Promise<{
  scholars: ScholarProgressOverview[];
  error: Error | null;
}> {
  if (!mentorId) {
    return { scholars: [], error: new Error('Mentor ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockMentorScholarsProgress(mentorId);
    return { scholars: list, error: null };
  }

  try {
    // 1. Fetch assigned students through mentor_students relationship
    const { students, error: pairingError } = await getAssignedStudents(mentorId);
    if (pairingError) throw pairingError;
    if (!students || students.length === 0) {
      return { scholars: [], error: null };
    }

    const overviews: ScholarProgressOverview[] = [];

    // 2. Fetch progress summaries for each assigned student
    for (const student of students) {
      const { progress } = await getStudentAcademicProgress(student.id);
      if (progress) {
        const lastActivity = progress.recentActivity.length > 0 ? progress.recentActivity[0].timestamp : null;
        overviews.push({
          studentId: student.id,
          studentName: student.full_name,
          poraplanId: student.poraplan_id || 'PP000',
          studentEmail: student.email,
          tasks: {
            total: progress.tasks.total,
            completed: progress.tasks.completed,
            completionRate: progress.tasks.completionRate,
          },
          assignments: {
            totalAssigned: progress.assignments.totalAssigned,
            submitted: progress.assignments.submitted,
            pendingReview: progress.assignments.pendingReview,
          },
          evaluations: {
            total: progress.evaluations.total,
            completed: progress.evaluations.completed,
            scheduled: progress.evaluations.scheduled,
          },
          studyPlansCount: progress.studyPlans.totalPlans,
          subjectsCount: progress.subjectsProgress.length,
          lastActiveTimestamp: lastActivity,
        });
      }
    }

    return { scholars: overviews, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { scholars: [], error };
  }
}

/**
 * Fetch detailed progress for a specific student, checking mentor authorization.
 */
export async function getScholarProgressDetail(
  mentorId: string,
  studentId: string
): Promise<{
  summary: StudentProgressSummary | null;
  error: Error | null;
}> {
  if (!mentorId || !studentId) {
    return { summary: null, error: new Error('Mentor ID and Student ID are required.') };
  }

  if (!isSupabaseConfigured()) {
    return getMockScholarProgressDetail(mentorId, studentId);
  }

  try {
    // Validate that student is paired with mentor (or mentor is admin)
    const { students, error: pairError } = await getAssignedStudents(mentorId);
    if (pairError) throw pairError;

    const isAssigned = students.some((s) => s.id === studentId);
    if (!isAssigned) {
      // Check if admin
      const { data: adminProfile } = await supabase.from('profiles').select('role').eq('id', mentorId).maybeSingle();
      if (adminProfile?.role !== 'admin') {
        return { summary: null, error: new Error('You are not authorized to view progress for this student.') };
      }
    }

    const { progress, error } = await getStudentAcademicProgress(studentId);
    return { summary: progress, error };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { summary: null, error };
  }
}
