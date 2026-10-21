import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentAcademicProgress,
  type StudentProgressSummary,
} from '../../lib/progress';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  TrendingUp,
  ListTodo,
  FileText,
  Calendar,
  Compass,
  BookOpen,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronRight,
  ArrowRight,
  Users,
  Award,
  Sparkles,
  FileCheck,
} from 'lucide-react';

export const StudentProgressPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  const [progress, setProgress] = useState<StudentProgressSummary | null>(null);
  const [assignedMentor, setAssignedMentor] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [progRes, mentorsRes] = await Promise.all([
          getStudentAcademicProgress(studentId),
          getAssignedMentors(studentId),
        ]);

        if (!isMounted) return;

        if (progRes.error) {
          setErrorMessage(progRes.error.message);
        } else {
          setProgress(progRes.progress);
        }

        if (mentorsRes.mentors && mentorsRes.mentors.length > 0) {
          setAssignedMentor(mentorsRes.mentors[0]);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleRefresh = async () => {
    if (!studentId) return;
    setRefreshing(true);
    setErrorMessage(null);
    const res = await getStudentAcademicProgress(studentId);
    if (res.error) {
      setErrorMessage(res.error.message);
    } else {
      setProgress(res.progress);
    }
    setRefreshing(false);
  };

  const hasAnyActivity =
    progress &&
    (progress.tasks.total > 0 ||
      progress.assignments.totalAssigned > 0 ||
      progress.evaluations.total > 0 ||
      progress.studyPlans.totalPlans > 0 ||
      progress.subjectsProgress.length > 0);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER                                                            */}
      {/* ========================================================================= */}
      <section className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs uppercase font-bold text-brand-muted bg-brand-bg px-2 py-0.5 border border-brand-dark">
              ACADEMIC METRICS
            </span>
            <Badge variant="teal" size="sm">
              TRUTHFUL LOG
            </Badge>
            {profile?.poraplan_id && (
              <span className="font-mono text-xs font-bold text-brand-teal px-2 py-0.5 border border-brand-dark bg-brand-paper shadow-brutal-xs">
                SCHOLAR ID: {profile.poraplan_id}
              </span>
            )}
            {assignedMentor && (
              <span className="font-mono text-xs font-bold text-brand-dark px-2 py-0.5 border border-brand-dark bg-brand-bg shadow-brutal-xs flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-brand-gold" /> MENTOR: {assignedMentor.full_name}
              </span>
            )}
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            Academic Progress Tracking
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-1 max-w-2xl">
            Verified, database-backed summary of your study workflow: tasks, practice submissions, and milestone evaluations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            leftIcon={
              refreshing ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
              ) : (
                <RefreshCw className="w-4 h-4 text-brand-navy" />
              )
            }
          >
            {refreshing ? 'Updating...' : 'Refresh Metrics'}
          </Button>
          <Link to="/student/dashboard">
            <Button variant="secondary" size="sm">
              Dashboard
            </Button>
          </Link>
        </div>
      </section>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 border-2 border-red-600 bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-heading font-bold text-sm">Unable to Load Progress Metrics</h4>
            <p className="font-mono text-xs mt-1 text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
          <p className="font-heading font-extrabold text-base text-brand-navy">
            CALCULATING ACADEMIC PROGRESS
          </p>
          <span className="font-mono text-xs text-brand-muted mt-1">
            Aggregating persisted tasks, submissions, and milestone evaluations...
          </span>
        </div>
      ) : !hasAnyActivity ? (
        /* Honest Empty State */
        <div className="p-8 sm:p-12 border-2 border-dashed border-brand-dark bg-brand-paper text-center shadow-brutal-sm">
          <div className="w-12 h-12 mx-auto mb-4 bg-brand-paper-tint border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs">
            <TrendingUp className="w-6 h-6 text-brand-teal" />
          </div>
          <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
            No Academic Activity Recorded Yet
          </h3>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-2 max-w-lg mx-auto">
            Your progress dashboard reflects actual academic work. Once your mentor sets up your study areas, assigns daily tasks, or publishes practice sets, your verified progress will appear here.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/student/subjects">
              <Button variant="primary" size="sm" leftIcon={<BookOpen className="w-4 h-4" />}>
                Explore Study Areas
              </Button>
            </Link>
            <Link to="/student/dashboard">
              <Button variant="outline" size="sm">
                Return to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        progress && (
          <>
            {/* ========================================================================= */}
            {/* 2. 7-STEP STUDY CYCLE PROGRESSION                                         */}
            {/* ========================================================================= */}
            <section className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper-tint shadow-brutal">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <span className="font-mono text-xs uppercase font-extrabold text-brand-navy flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-brand-teal" />
                  PoraPlan Core Academic Progression
                </span>
                <span className="font-mono text-[11px] text-brand-muted">
                  Plan → Study → Practice → Submit → Review → Feedback → Progress
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center font-mono text-xs">
                <div className="p-2 border border-brand-dark bg-brand-paper font-bold shadow-brutal-xs">
                  <span className="text-[10px] text-brand-muted block uppercase">Step 1</span>
                  <span className="text-brand-navy">Plan</span>
                  <span className="text-[10px] text-brand-teal block font-semibold mt-0.5">
                    {progress.studyPlans.activePlans} Active Plans
                  </span>
                </div>
                <div className="p-2 border border-brand-dark bg-brand-paper font-bold shadow-brutal-xs">
                  <span className="text-[10px] text-brand-muted block uppercase">Step 2</span>
                  <span className="text-brand-navy">Study</span>
                  <span className="text-[10px] text-brand-teal block font-semibold mt-0.5">
                    {progress.tasks.completed}/{progress.tasks.total} Tasks
                  </span>
                </div>
                <div className="p-2 border border-brand-dark bg-brand-paper font-bold shadow-brutal-xs">
                  <span className="text-[10px] text-brand-muted block uppercase">Step 3</span>
                  <span className="text-brand-navy">Practice</span>
                  <span className="text-[10px] text-brand-teal block font-semibold mt-0.5">
                    {progress.assignments.totalAssigned} Problem Sets
                  </span>
                </div>
                <div className="p-2 border border-brand-dark bg-brand-paper font-bold shadow-brutal-xs">
                  <span className="text-[10px] text-brand-muted block uppercase">Step 4</span>
                  <span className="text-brand-navy">Submit</span>
                  <span className="text-[10px] text-brand-teal block font-semibold mt-0.5">
                    {progress.assignments.submitted} Submitted
                  </span>
                </div>
                <div className="p-2 border border-brand-dark bg-brand-paper font-bold shadow-brutal-xs">
                  <span className="text-[10px] text-brand-muted block uppercase">Step 5</span>
                  <span className="text-brand-navy">Review</span>
                  <span className="text-[10px] text-brand-gold block font-semibold mt-0.5">
                    {progress.assignments.pendingReview} In Queue
                  </span>
                </div>
                <div className="p-2 border border-brand-dark bg-brand-paper font-bold shadow-brutal-xs">
                  <span className="text-[10px] text-brand-muted block uppercase">Step 6</span>
                  <span className="text-brand-navy">Feedback</span>
                  <span className="text-[10px] text-brand-teal block font-semibold mt-0.5">
                    {progress.assignments.reviewed} Graded
                  </span>
                </div>
                <div className="p-2 border-2 border-brand-dark bg-brand-teal text-white font-extrabold shadow-brutal-xs col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-brand-bg opacity-80 block uppercase">Step 7</span>
                  <span>Progress</span>
                  <span className="text-[10px] text-brand-gold block font-semibold mt-0.5">
                    Verified ✓
                  </span>
                </div>
              </div>
            </section>

            {/* ========================================================================= */}
            {/* 3. FOUR PRIMARY ACADEMIC KPI BLOCKS                                       */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Study Tasks */}
              <div className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs uppercase font-extrabold text-brand-muted">
                      STUDY TASKS
                    </span>
                    <ListTodo className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                  </div>
                  <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
                    {progress.tasks.completed}{' '}
                    <span className="text-xs font-mono font-normal text-brand-muted">
                      / {progress.tasks.total} Tasks
                    </span>
                  </div>
                  <div className="w-full bg-brand-bg h-2 border border-brand-dark mt-3 overflow-hidden">
                    <div
                      className="bg-brand-teal h-full transition-all duration-500"
                      style={{ width: `${progress.tasks.completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
                  <span>{progress.tasks.completionRate}% Completed</span>
                  <Link
                    to="/student/tasks"
                    className="text-brand-navy font-bold hover:underline flex items-center gap-1"
                  >
                    View <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Card 2: Practice Assignments */}
              <div className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs uppercase font-extrabold text-brand-muted">
                      PRACTICE SETS
                    </span>
                    <FileText className="w-4 h-4 text-brand-navy stroke-[2.5]" />
                  </div>
                  <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
                    {progress.assignments.submitted}{' '}
                    <span className="text-xs font-mono font-normal text-brand-muted">
                      / {progress.assignments.totalAssigned} Submitted
                    </span>
                  </div>
                  <div className="w-full bg-brand-bg h-2 border border-brand-dark mt-3 overflow-hidden">
                    <div
                      className="bg-brand-navy h-full transition-all duration-500"
                      style={{ width: `${progress.assignments.submissionRate}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
                  <span>
                    {progress.assignments.pendingReview > 0
                      ? `${progress.assignments.pendingReview} Pending Review`
                      : progress.assignments.averageScorePercentage !== null
                      ? `Avg Score: ${progress.assignments.averageScorePercentage}%`
                      : 'All Graded'}
                  </span>
                  <Link
                    to="/student/assignments"
                    className="text-brand-navy font-bold hover:underline flex items-center gap-1"
                  >
                    Practice <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Card 3: Milestone Evaluations */}
              <div className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs uppercase font-extrabold text-brand-muted">
                      EVALUATIONS
                    </span>
                    <Calendar className="w-4 h-4 text-brand-gold stroke-[2.5]" />
                  </div>
                  <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
                    {progress.evaluations.completed}{' '}
                    <span className="text-xs font-mono font-normal text-brand-muted">
                      / {progress.evaluations.total} Graded
                    </span>
                  </div>
                  <div className="w-full bg-brand-bg h-2 border border-brand-dark mt-3 overflow-hidden">
                    <div
                      className="bg-brand-gold h-full transition-all duration-500"
                      style={{ width: `${progress.evaluations.completionRate}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
                  <span>
                    {progress.evaluations.averageScorePercentage !== null
                      ? `Avg: ${progress.evaluations.averageScorePercentage}%`
                      : progress.evaluations.scheduled > 0
                      ? `${progress.evaluations.scheduled} Scheduled`
                      : 'No Results Yet'}
                  </span>
                  <Link
                    to="/student/evaluations"
                    className="text-brand-navy font-bold hover:underline flex items-center gap-1"
                  >
                    Eval <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Card 4: Study Plans & Milestones */}
              <div className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs uppercase font-extrabold text-brand-muted">
                      STUDY PLANS
                    </span>
                    <Compass className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                  </div>
                  <div className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
                    {progress.studyPlans.completedPlans}{' '}
                    <span className="text-xs font-mono font-normal text-brand-muted">
                      / {progress.studyPlans.totalPlans} Plans
                    </span>
                  </div>
                  <div className="w-full bg-brand-bg h-2 border border-brand-dark mt-3 overflow-hidden">
                    <div
                      className="bg-brand-teal h-full transition-all duration-500"
                      style={{ width: `${progress.studyPlans.itemCompletionRate}%` }}
                    />
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
                  <span>
                    {progress.studyPlans.totalItems > 0
                      ? `${progress.studyPlans.completedItems}/${progress.studyPlans.totalItems} Topics Mastery`
                      : `${progress.studyPlans.activePlans} Active Plans`}
                  </span>
                  <Link
                    to="/student/plans"
                    className="text-brand-navy font-bold hover:underline flex items-center gap-1"
                  >
                    Plans <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* 4. SUBJECT-WISE ACADEMIC PERFORMANCE                                      */}
            {/* ========================================================================= */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  Subject-Wise Study Areas Breakdown
                </h2>
                <span className="font-mono text-xs font-bold text-brand-muted bg-brand-paper px-2 py-0.5 border border-brand-dark shadow-brutal-xs">
                  {progress.subjectsProgress.length} SUBJECTS
                </span>
              </div>

              {progress.subjectsProgress.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-brand-dark bg-brand-paper text-center">
                  <p className="font-mono text-xs text-brand-muted">
                    No active study areas assigned yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {progress.subjectsProgress.map((subj) => (
                    <div
                      key={subj.subjectId}
                      className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="font-mono text-[10px] font-bold text-brand-muted">
                              {subj.subjectCode || 'ACADEMIC AREA'}
                            </span>
                            <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                              {subj.subjectName}
                            </h3>
                          </div>
                          <Badge variant={subj.status === 'active' ? 'teal' : 'paper'} size="sm">
                            {subj.status.toUpperCase()}
                          </Badge>
                        </div>

                        {/* Subject Metrics Table */}
                        <div className="space-y-2 mt-4 text-xs font-mono">
                          <div className="flex items-center justify-between pb-1 border-b border-brand-dark/10">
                            <span className="text-brand-muted">Daily Tasks:</span>
                            <span className="font-bold text-brand-navy">
                              {subj.tasks.completed} / {subj.tasks.total} ({subj.tasks.completionRate}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between pb-1 border-b border-brand-dark/10">
                            <span className="text-brand-muted">Practice Submissions:</span>
                            <span className="font-bold text-brand-navy">
                              {subj.assignments.submitted} / {subj.assignments.total}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pb-1 border-b border-brand-dark/10">
                            <span className="text-brand-muted">Milestone Evaluations:</span>
                            <span className="font-bold text-brand-navy">
                              {subj.evaluations.completed} / {subj.evaluations.total}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pb-1 border-b border-brand-dark/10">
                            <span className="text-brand-muted">Study Plans:</span>
                            <span className="font-bold text-brand-navy">
                              {subj.studyPlansCount} Roadmaps
                            </span>
                          </div>
                          {subj.evaluations.averageScorePercentage !== null && (
                            <div className="flex items-center justify-between pt-1 text-brand-teal font-extrabold">
                              <span>Evaluation Avg:</span>
                              <span>{subj.evaluations.averageScorePercentage}%</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-end">
                        <Link
                          to={`/student/subjects/${subj.subjectId}`}
                          className="font-mono text-xs font-bold text-brand-navy hover:underline flex items-center gap-1"
                        >
                          Subject Details <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ========================================================================= */}
            {/* 5. VERIFIED RECENT ACADEMIC ACTIVITY TIMELINE                             */}
            {/* ========================================================================= */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy flex items-center gap-2">
                  <Clock className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  Recent Academic Activity Log
                </h2>
                <span className="font-mono text-xs font-bold text-brand-muted bg-brand-paper px-2 py-0.5 border border-brand-dark shadow-brutal-xs">
                  REAL TIMESTAMPS
                </span>
              </div>

              {progress.recentActivity.length === 0 ? (
                <div className="p-6 border-2 border-dashed border-brand-dark bg-brand-paper text-center">
                  <p className="font-mono text-xs text-brand-muted">
                    No timestamped events recorded yet.
                  </p>
                </div>
              ) : (
                <div className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
                  {progress.recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border border-brand-dark bg-brand-paper-tint flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-brutal-xs"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 border border-brand-dark bg-brand-paper shrink-0 mt-0.5">
                          {item.type.startsWith('task') ? (
                            <ListTodo className="w-4 h-4 text-brand-teal" />
                          ) : item.type.startsWith('assignment') ? (
                            <FileCheck className="w-4 h-4 text-brand-navy" />
                          ) : (
                            <Award className="w-4 h-4 text-brand-gold" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                              {item.title}
                            </span>
                            {item.statusBadge && (
                              <Badge variant={item.statusBadge.variant} size="sm">
                                {item.statusBadge.label}
                              </Badge>
                            )}
                            {item.subjectName && (
                              <span className="font-mono text-[10px] text-brand-muted px-1.5 py-0.2 border border-brand-dark/40 bg-brand-paper">
                                {item.subjectName}
                              </span>
                            )}
                          </div>
                          {item.details && (
                            <p className="font-sans text-xs text-brand-muted mt-0.5">
                              {item.details}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="font-mono text-[10px] sm:text-xs text-brand-muted shrink-0 text-left sm:text-right">
                        {new Date(item.timestamp).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
};
