import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import { getMentorReviewQueue, type SubmissionWithMeta } from '../../lib/assignments';
import { getMentorDoubts, type DoubtWithMeta } from '../../lib/doubts';
import { getMentorEvaluations, type EvaluationWithMeta } from '../../lib/evaluations';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  Users,
  FileCheck,
  Award,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  ListTodo,
  FileText,
  HelpCircle,
  Megaphone,
  X,
  ChevronRight,
  AlertCircle,
  GraduationCap,
  Mail,
  CheckCircle2,
  Compass,
  TrendingUp,
  FolderKanban,
  Loader2,
} from 'lucide-react';

export const MentorDashboardPage: React.FC = () => {
  const { user, profile, role, poraplanId } = useAuth();
  const mentorId = user?.id || '';

  const [students, setStudents] = useState<Profile[]>([]);
  const [reviews, setReviews] = useState<SubmissionWithMeta[]>([]);
  const [doubts, setDoubts] = useState<DoubtWithMeta[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationWithMeta[]>([]);
  const [loading, setLoading] = useState(() => Boolean(mentorId));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected student for quick inspection
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);

  useEffect(() => {
    if (!mentorId) return;

    let isMounted = true;
    Promise.all([
      getAssignedStudents(mentorId),
      getMentorReviewQueue(mentorId),
      getMentorDoubts(mentorId),
      getMentorEvaluations(mentorId),
    ])
      .then(([studentsRes, reviewsRes, doubtsRes, evalsRes]) => {
        if (!isMounted) return;
        if (studentsRes.error) {
          setErrorMessage(studentsRes.error.message);
        } else {
          setStudents(studentsRes.students || []);
        }
        setReviews(reviewsRes.submissions || []);
        setDoubts(doubtsRes.doubts || []);
        setEvaluations(evalsRes.evaluations || []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load mentor data.';
        setErrorMessage(msg);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mentorId]);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const mentorName = profile?.full_name || user?.user_metadata?.full_name || 'Academic Mentor';
  const mentorIdDisplay = poraplanId || profile?.poraplan_id || '';

  // Derived real attention metrics
  const pendingReviews = reviews.filter((r) => r.status === 'submitted' || r.status === 'under_review');
  const openDoubts = doubts.filter((d) => d.status === 'open');
  const scheduledEvaluations = evaluations.filter((e) => e.status === 'scheduled');

  const needsAttentionCount = pendingReviews.length + openDoubts.length;

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* 1. MENTOR IDENTITY & GREETING HEADER */}
        <section
          aria-labelledby="mentor-greeting"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                  MENTOR WORKSPACE
                </span>
                <Badge variant="gold" size="sm">ACTIVE</Badge>
              </div>

              <h1 id="mentor-greeting" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Welcome, {mentorName}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-brand-bg/85 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                  {currentDate}
                </span>
                {mentorIdDisplay && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-brand-gold">
                      ID: {mentorIdDisplay}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="uppercase text-brand-gold font-bold">{role || 'Mentor'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start">
              <div className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>Mentor Workspace</span>
              </div>
            </div>
          </div>

          {/* "What Requires Attention?" Mentor Priority Callout */}
          <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-gold text-brand-dark shadow-brutal-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wide uppercase">
                  <Sparkles className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.5]" />
                  <span>WHAT REQUIRES ATTENTION TODAY?</span>
                </div>
                <p className="text-xs font-sans font-medium text-brand-dark/90 leading-relaxed">
                  {loading ? (
                    'Checking student submissions and doubt inquiries...'
                  ) : students.length === 0 ? (
                    'No students are currently assigned to your roster. Contact the administrator to assign students.'
                  ) : needsAttentionCount > 0 ? (
                    <>
                      <span className="font-bold">Attention needed:</span> You have{' '}
                      {pendingReviews.length > 0 && (
                        <span className="font-extrabold underline mr-1">
                          {pendingReviews.length} submission{pendingReviews.length > 1 ? 's' : ''} to review
                        </span>
                      )}
                      {pendingReviews.length > 0 && openDoubts.length > 0 && ' and '}
                      {openDoubts.length > 0 && (
                        <span className="font-extrabold underline">
                          {openDoubts.length} student doubt{openDoubts.length > 1 ? 's' : ''} waiting for answers
                        </span>
                      )}
                      .
                    </>
                  ) : (
                    <>
                      <span className="font-bold">All caught up:</span> All submissions are reviewed and all student doubts are answered for your {students.length} assigned student{students.length > 1 ? 's' : ''}.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {pendingReviews.length > 0 && (
                  <Link
                    to="/mentor/reviews"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-dark transition-colors"
                  >
                    <span>Review Submissions ({pendingReviews.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {openDoubts.length > 0 && (
                  <Link
                    to="/mentor/doubts"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-paper-tint transition-colors"
                  >
                    <span>Answer Doubts ({openDoubts.length})</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. MENTORSHIP SUMMARY METRICS */}
        <section aria-labelledby="mentor-metrics-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mentor-metrics-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              Mentor Overview
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Assigned Students */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  ASSIGNED STUDENTS
                </span>
                <Users className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {loading ? '--' : students.length} <span className="text-xs font-mono font-normal text-brand-muted">Active</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {students.length > 0 ? `${students.length} on roster` : 'Roster Empty'}
              </span>
            </div>

            {/* Metric 2: Pending Reviews */}
            <Link
              to="/mentor/reviews"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  PENDING REVIEWS
                </span>
                <FileCheck className="w-4 h-4 text-brand-gold" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {pendingReviews.length} <span className="text-xs font-mono font-normal text-brand-muted">Queue</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                {pendingReviews.length > 0 ? 'Awaiting feedback' : 'Queue clear'}
              </span>
            </Link>

            {/* Metric 3: Open Doubts */}
            <Link
              to="/mentor/doubts"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  OPEN DOUBTS
                </span>
                <HelpCircle className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {openDoubts.length} <span className="text-xs font-mono font-normal text-brand-muted">Pending</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {doubts.length - openDoubts.length} Answered
              </span>
            </Link>

            {/* Metric 4: Scheduled Evaluations */}
            <Link
              to="/mentor/evaluations"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  EVALUATIONS
                </span>
                <Calendar className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {scheduledEvaluations.length} <span className="text-xs font-mono font-normal text-brand-muted">Scheduled</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                {evaluations.filter((e) => e.status === 'completed').length} Conducted
              </span>
            </Link>
          </div>
        </section>

        {/* 3. ASSIGNED STUDENTS ROSTER */}
        <section
          id="roster"
          aria-labelledby="roster-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="roster-title" className="font-heading font-extrabold text-base text-brand-navy">
                Assigned Students
              </h2>
            </div>
            <Badge variant={students.length > 0 ? 'teal' : 'muted'} size="sm">
              {loading ? 'CHECKING...' : `${students.length} STUDENTS`}
            </Badge>
          </div>

          {errorMessage && (
            <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>Failed to load assigned students: {errorMessage}</span>
            </div>
          )}

          {loading ? (
            <div className="p-6 text-center font-mono text-xs text-brand-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
              <span>Loading student roster...</span>
            </div>
          ) : students.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-brand-dark font-sans leading-relaxed">
                You organize the study routine, assign tasks, review practice submissions, and solve doubts for these students:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 border-2 border-brand-dark bg-brand-paper-tint flex flex-col justify-between gap-3 shadow-brutal-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-brand-teal shrink-0" />
                          <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                            {student.full_name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-brand-muted">
                          {student.poraplan_id && (
                            <>
                              <span className="font-bold text-brand-gold">
                                ID: {student.poraplan_id}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span className="truncate max-w-[180px]">{student.email}</span>
                        </div>
                      </div>
                      <Badge variant="teal" size="sm">ACTIVE</Badge>
                    </div>

                    <div className="pt-2 border-t border-brand-dark/20 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <Link
                          to={`/mentor/plans?studentId=${student.id}`}
                          className="font-mono text-[11px] font-bold text-brand-teal hover:underline"
                        >
                          Plans
                        </Link>
                        <span className="text-brand-muted">•</span>
                        <Link
                          to={`/mentor/tasks?studentId=${student.id}`}
                          className="font-mono text-[11px] font-bold text-brand-navy hover:underline"
                        >
                          Tasks
                        </Link>
                        <span className="text-brand-muted">•</span>
                        <Link
                          to={`/mentor/assignments?studentId=${student.id}`}
                          className="font-mono text-[11px] font-bold text-brand-navy hover:underline"
                        >
                          Practice
                        </Link>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudent(student)}
                        className="text-xs"
                      >
                        Student Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5">
              <div className="w-10 h-10 border-2 border-brand-dark bg-brand-teal-light rounded-none mx-auto flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  No Students Assigned Yet
                </h3>
                <p className="text-xs text-brand-muted font-sans mt-1 leading-relaxed">
                  When platform administrators assign students to your mentorship account, their profiles, study submissions, and evaluations will appear here.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 4. DUAL PANELS: REVIEW QUEUE & UPCOMING EVALUATIONS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Submission Review Queue Card */}
          <section
            aria-labelledby="reviews-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  <h2 id="reviews-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Submission Review Queue
                  </h2>
                </div>
                <Badge variant={pendingReviews.length > 0 ? 'gold' : 'muted'} size="sm">
                  {pendingReviews.length} PENDING
                </Badge>
              </div>

              {pendingReviews.length === 0 ? (
                <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2 my-2">
                  <div className="w-9 h-9 border-2 border-brand-dark bg-brand-gold-light mx-auto flex items-center justify-center">
                    <FileCheck className="w-4 h-4 text-brand-dark" />
                  </div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    Review Queue Clear
                  </h3>
                  <p className="text-xs text-brand-muted font-sans leading-relaxed">
                    When assigned students submit practice assignments, their solutions will appear here for your review and feedback.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 my-2">
                  {pendingReviews.slice(0, 3).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-heading font-bold text-sm text-brand-navy">
                          {sub.assignment_title || 'Assignment Submission'}
                        </h4>
                        <span className="font-mono text-[11px] text-brand-muted">
                          Student ID: {sub.student_id}
                        </span>
                      </div>
                      <Link to="/mentor/reviews">
                        <Button variant="outline" size="sm" className="text-xs">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Practice Submissions</span>
              <Link
                to="/mentor/reviews"
                className="font-bold text-brand-navy hover:text-brand-teal transition-colors flex items-center gap-1"
              >
                <span>Open Review Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* Upcoming Evaluations Card */}
          <section
            aria-labelledby="evaluations-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  <h2 id="evaluations-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Upcoming Evaluations
                  </h2>
                </div>
                <Badge variant={scheduledEvaluations.length > 0 ? 'teal' : 'muted'} size="sm">
                  {scheduledEvaluations.length} SCHEDULED
                </Badge>
              </div>

              {scheduledEvaluations.length === 0 ? (
                <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2 my-2">
                  <div className="w-9 h-9 border-2 border-brand-dark bg-brand-teal-light mx-auto flex items-center justify-center">
                    <Clock className="w-4 h-4 text-brand-teal" />
                  </div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    No Evaluations Scheduled
                  </h3>
                  <p className="text-xs text-brand-muted font-sans leading-relaxed">
                    Evaluations are periodic check-ins (via Google Meet/Zoom or written review) to assess student understanding and calibrate the next study plan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 my-2">
                  {scheduledEvaluations.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-heading font-bold text-sm text-brand-navy">
                          {ev.title}
                        </h4>
                        <span className="font-mono text-[11px] text-brand-muted">
                          {ev.scheduled_date ? new Date(ev.scheduled_date).toLocaleDateString() : 'Date pending'}
                        </span>
                      </div>
                      <Link to="/mentor/evaluations">
                        <Button variant="outline" size="sm" className="text-xs">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Oral &amp; Written Reviews</span>
              <Link
                to="/mentor/evaluations"
                className="font-bold text-brand-navy hover:text-brand-teal transition-colors flex items-center gap-1"
              >
                <span>Manage Evaluations</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

        </div>

        {/* 5. QUICK ACTIONS: CORE MENTOR MODULES */}
        <section aria-labelledby="mentor-actions-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mentor-actions-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              Mentorship Modules
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Study Plans */}
            <Link
              to="/mentor/plans"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    ROADMAPS
                  </span>
                  <Compass className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Study Plans
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Organize weekly chapter targets, syllabus pacing, and study instructions.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>Manage Study Plans</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Tasks */}
            <Link
              to="/mentor/tasks"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    DAILY TARGETS
                  </span>
                  <ListTodo className="w-4 h-4 text-brand-dark group-hover:text-brand-gold" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold">
                  Tasks
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Assign prioritized study sessions and daily practice exercises to students.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-gold">
                <span>Manage Tasks</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Assignments */}
            <Link
              to="/mentor/assignments"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    PRACTICE
                  </span>
                  <FileText className="w-4 h-4 text-brand-dark group-hover:text-brand-navy" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-navy">
                  Assignments
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Distribute chapter problem sets and homework exercises for practice.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Manage Assignments</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Review Submissions */}
            <Link
              to="/mentor/reviews"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    FEEDBACK
                  </span>
                  <FileCheck className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Review Submissions
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Inspect student solutions, check step accuracy, and provide guidance.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>Open Review Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Evaluations */}
            <Link
              to="/mentor/evaluations"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    ASSESSMENT
                  </span>
                  <Calendar className="w-4 h-4 text-brand-dark group-hover:text-brand-gold" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold">
                  Evaluations
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Schedule oral assessments and verify retention before major exams.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-gold">
                <span>Manage Evaluations</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Student Progress */}
            <Link
              to="/mentor/progress"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    OVERVIEW
                  </span>
                  <TrendingUp className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Student Progress
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Monitor task completion, assignment performance, and syllabus pace.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>View Progress</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Doubts */}
            <Link
              to="/mentor/doubts"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    INQUIRIES
                  </span>
                  <HelpCircle className="w-4 h-4 text-brand-dark group-hover:text-brand-navy" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-navy">
                  Doubts
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Answer conceptual questions and problems submitted by your students.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Open Doubts Desk</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Resources */}
            <Link
              to="/mentor/resources"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                    MATERIALS
                  </span>
                  <FolderKanban className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Resources
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Share curated formulas, chapter notes, and textbook reference sheets.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Manage Resources</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Announcements */}
            <Link
              to="/mentor/announcements"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    BROADCAST
                  </span>
                  <Megaphone className="w-4 h-4 text-brand-dark group-hover:text-brand-gold" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold">
                  Announcements
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Post schedule updates, study guidance, and notices for your students.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-gold">
                <span>Manage Announcements</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </section>

      </div>

      {/* STUDENT DETAILS MODAL */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-details-title"
        >
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h2 id="student-details-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Student Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="font-mono text-[10px] text-brand-muted uppercase block font-bold">Full Name</span>
                <span className="font-bold text-brand-dark text-base font-sans">{selectedStudent.full_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">PoraPlan ID</span>
                  <span className="font-bold text-brand-gold text-sm">
                    {selectedStudent.poraplan_id || '-'}
                  </span>
                </div>

                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">Status</span>
                  <Badge variant="teal" size="sm">
                    {selectedStudent.status || 'ACTIVE'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="font-mono text-[10px] text-brand-muted uppercase block font-bold">Email</span>
                <div className="flex items-center gap-1.5 text-brand-dark">
                  <Mail className="w-3.5 h-3.5 text-brand-navy shrink-0" />
                  <span className="font-mono font-bold text-xs truncate">{selectedStudent.email}</span>
                </div>
              </div>

              <div className="p-3.5 border-2 border-brand-dark bg-brand-teal-light/40 space-y-1 text-brand-dark font-sans text-xs">
                <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase text-brand-teal">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assigned Student</span>
                </div>
                <p className="leading-relaxed">
                  You are paired as this student's mentor. You can configure their study plans, assign tasks, review practice sets, and schedule evaluations.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-brand-dark/20">
              <Link to={`/mentor/plans?studentId=${selectedStudent.id}`} onClick={() => setSelectedStudent(null)}>
                <Button variant="primary" size="sm" leftIcon={<Compass className="w-3.5 h-3.5" />}>
                  Study Plans
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStudent(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
