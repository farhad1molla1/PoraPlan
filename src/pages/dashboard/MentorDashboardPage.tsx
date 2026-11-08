import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import { getEffectiveStudentsForMentor } from '../../lib/mentorAssignments';
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
  Clock,
  ArrowRight,
  HelpCircle,
  X,
  ChevronRight,
  AlertCircle,
  GraduationCap,
  Mail,
  CheckCircle2,
  Compass,
  Loader2,
  Phone,
} from 'lucide-react';

export const MentorDashboardPage: React.FC = () => {
  const { user, profile, poraplanId } = useAuth();
  const mentorId = user?.id || '';

  const [students, setStudents] = useState<Profile[]>([]);
  const [assignedStudentRecords, setAssignedStudentRecords] = useState<
    {
      student: Profile;
      cohort: any;
      program: any;
      assignmentType: 'individual' | 'cohort';
      assignedAt: string;
    }[]
  >([]);
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
      getEffectiveStudentsForMentor(mentorId),
      getAssignedStudents(mentorId),
      getMentorReviewQueue(mentorId),
      getMentorDoubts(mentorId),
      getMentorEvaluations(mentorId),
    ])
      .then(([effRes, studentsRes, reviewsRes, doubtsRes, evalsRes]) => {
        if (!isMounted) return;
        if (effRes.students && effRes.students.length > 0) {
          setAssignedStudentRecords(effRes.students);
          setStudents(effRes.students.map((item) => item.student));
        } else if (studentsRes.students) {
          setStudents(studentsRes.students);
          setAssignedStudentRecords(
            studentsRes.students.map((s) => ({
              student: s,
              cohort: null,
              program: null,
              assignmentType: 'cohort',
              assignedAt: new Date().toISOString(),
            }))
          );
        } else if (studentsRes.error) {
          setErrorMessage(studentsRes.error.message);
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
    <div className="w-full py-3 sm:py-8 px-2.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-3 sm:space-y-6">

        {/* 1. MENTOR GREETING & PRIORITY ATTENTION */}
        <section
          aria-labelledby="mentor-greeting"
          className="border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal p-3 sm:p-6 space-y-3 sm:space-y-4"
        >
          {/* Top Row: Greeting & Meta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 border-b sm:border-b-2 border-primary/20 sm:border-primary pb-2 sm:pb-3">
            <div>
              <h1 id="mentor-greeting" className="text-lg sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
                Welcome, {mentorName}
              </h1>
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-mono text-brand-muted mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                  {currentDate}
                </span>
                {mentorIdDisplay && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-brand-navy">
                      ID: {mentorIdDisplay}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="gold" size="sm" className="font-mono uppercase font-bold text-[9px] sm:text-[10px]">
                Mentor
              </Badge>
            </div>
          </div>

          {/* Actionable Priority Banner */}
          <div className="p-2.5 sm:p-4 border sm:border-2 border-primary/25 bg-brand-gold-light rounded-semantic-xs sm:rounded-semantic-sm text-brand-dark">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-[10px] sm:text-xs font-bold text-brand-navy uppercase">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-navy shrink-0" />
                  <span>Action Needed Today</span>
                </div>
                <p className="text-[11px] sm:text-xs font-sans text-brand-dark/90 leading-relaxed">
                  {loading ? (
                    'Checking student submissions and doubt inquiries...'
                  ) : students.length === 0 ? (
                    'No students are currently assigned to your roster. Contact the administrator to assign students.'
                  ) : needsAttentionCount > 0 ? (
                    <>
                      You have{' '}
                      {pendingReviews.length > 0 && (
                        <span className="font-bold">
                          {pendingReviews.length} submission{pendingReviews.length > 1 ? 's' : ''} to review
                        </span>
                      )}
                      {pendingReviews.length > 0 && openDoubts.length > 0 && ' and '}
                      {openDoubts.length > 0 && (
                        <span className="font-bold">
                          {openDoubts.length} student doubt{openDoubts.length > 1 ? 's' : ''} waiting for answers
                        </span>
                      )}
                      .
                    </>
                  ) : (
                    <>All caught up. No pending reviews or open doubts for your {students.length} assigned student{students.length > 1 ? 's' : ''}.</>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {pendingReviews.length > 0 && (
                  <Link
                    to="/mentor/reviews"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 border sm:border-2 border-primary bg-brand-navy text-brand-bg text-[11px] sm:text-xs font-mono font-bold rounded-semantic-xs shadow-micro sm:shadow-brutal-xs hover:bg-brand-dark transition-colors"
                  >
                    <span>Review Queue ({pendingReviews.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
                {openDoubts.length > 0 && (
                  <Link
                    to="/mentor/doubts"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 border sm:border-2 border-primary bg-surface-card text-brand-dark text-[11px] sm:text-xs font-mono font-bold rounded-semantic-xs shadow-micro sm:shadow-brutal-xs hover:bg-surface-elevated transition-colors"
                  >
                    <span>Answer Doubts ({openDoubts.length})</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 2. OVERVIEW STATUS METRICS */}
        <section aria-labelledby="mentor-metrics-title" className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mentor-metrics-title" className="font-heading font-extrabold text-xs sm:text-base text-brand-navy flex items-center gap-1.5 sm:gap-2">
              <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-gold stroke-[2.5]" />
              Mentor Overview
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {/* Metric 1: Assigned Students */}
            <div className="p-2 sm:p-4 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="font-mono text-[9px] sm:text-xs font-bold text-brand-muted">
                  Assigned Students
                </span>
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-teal" />
              </div>
              <div className="font-heading font-extrabold text-lg sm:text-2xl text-brand-navy">
                {loading ? '--' : students.length} <span className="text-[9px] sm:text-xs font-mono font-normal text-brand-muted">Active</span>
              </div>
              <span className="text-[9px] sm:text-[11px] font-mono text-brand-teal font-bold mt-0.5 sm:mt-1">
                {students.length > 0 ? `${students.length} on roster` : 'Roster empty'}
              </span>
            </div>

            {/* Metric 2: Pending Reviews */}
            <Link
              to="/mentor/reviews"
              className="p-2 sm:p-4 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="font-mono text-[9px] sm:text-xs font-bold text-brand-muted">
                  Pending Reviews
                </span>
                <FileCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-gold" />
              </div>
              <div className="font-heading font-extrabold text-lg sm:text-2xl text-brand-navy">
                {pendingReviews.length} <span className="text-[9px] sm:text-xs font-mono font-normal text-brand-muted">Queue</span>
              </div>
              <span className="text-[9px] sm:text-[11px] font-mono text-brand-muted mt-0.5 sm:mt-1">
                {pendingReviews.length > 0 ? 'Awaiting feedback' : 'Queue clear'}
              </span>
            </Link>

            {/* Metric 3: Open Doubts */}
            <Link
              to="/mentor/doubts"
              className="p-2 sm:p-4 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="font-mono text-[9px] sm:text-xs font-bold text-brand-muted">
                  Open Doubts
                </span>
                <HelpCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-teal" />
              </div>
              <div className="font-heading font-extrabold text-lg sm:text-2xl text-brand-navy">
                {openDoubts.length} <span className="text-[9px] sm:text-xs font-mono font-normal text-brand-muted">Pending</span>
              </div>
              <span className="text-[9px] sm:text-[11px] font-mono text-brand-teal font-bold mt-0.5 sm:mt-1">
                {doubts.length - openDoubts.length} answered
              </span>
            </Link>

            {/* Metric 4: Scheduled Evaluations */}
            <Link
              to="/mentor/evaluations"
              className="p-2 sm:p-4 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <span className="font-mono text-[9px] sm:text-xs font-bold text-brand-muted">
                  Evaluations
                </span>
                <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-navy" />
              </div>
              <div className="font-heading font-extrabold text-lg sm:text-2xl text-brand-navy">
                {scheduledEvaluations.length} <span className="text-[9px] sm:text-xs font-mono font-normal text-brand-muted">Scheduled</span>
              </div>
              <span className="text-[9px] sm:text-[11px] font-mono text-brand-muted mt-0.5 sm:mt-1">
                {evaluations.filter((e) => e.status === 'completed').length} conducted
              </span>
            </Link>
          </div>
        </section>

        {/* 3. DUAL ACTION PANELS: REVIEW QUEUE & UPCOMING EVALUATIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 sm:gap-6 min-w-0">
          
          {/* Submission Review Queue Card */}
          <section
            aria-labelledby="reviews-title"
            className="min-w-0 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal p-3 sm:p-6 flex flex-col justify-between space-y-3 sm:space-y-4"
          >
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between border-b sm:border-b-2 border-primary/20 sm:border-primary pb-2 sm:pb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <FileCheck className="w-4 h-4 sm:w-5 sm:h-5 text-brand-gold stroke-[2.5]" />
                  <h2 id="reviews-title" className="font-heading font-extrabold text-xs sm:text-base text-brand-navy">
                    Review Queue
                  </h2>
                </div>
                <Badge variant={pendingReviews.length > 0 ? 'gold' : 'muted'} size="sm">
                  {pendingReviews.length} PENDING
                </Badge>
              </div>

              {pendingReviews.length === 0 ? (
                <div className="p-3 sm:p-5 border sm:border-2 border-dashed border-primary/30 bg-surface-inset rounded-semantic-xs sm:rounded-semantic-sm text-center space-y-1.5 sm:space-y-2 my-1 sm:my-2">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 border sm:border-2 border-primary bg-brand-gold-light rounded-semantic-xs mx-auto flex items-center justify-center">
                    <FileCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-dark" />
                  </div>
                  <h3 className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                    Review Queue Clear
                  </h3>
                  <p className="text-[11px] sm:text-xs text-brand-muted font-sans leading-relaxed">
                    No submissions awaiting review. Newly submitted student work will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2 my-1 sm:my-2">
                  {pendingReviews.slice(0, 3).map((sub) => (
                    <div
                      key={sub.id}
                      className="p-2 sm:p-3 border sm:border-2 border-primary/25 bg-surface-inset rounded-semantic-xs flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                          {sub.assignment_title || 'Assignment Submission'}
                        </h4>
                        <span className="font-mono text-[10px] sm:text-[11px] text-brand-muted">
                          Student ID: {sub.student_id}
                        </span>
                      </div>
                      <Link to="/mentor/reviews">
                        <Button variant="outline" size="sm" className="text-[11px] sm:text-xs">
                          Review
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 sm:pt-3 border-t border-primary/20 flex items-center justify-between text-[11px] sm:text-xs font-mono text-brand-muted">
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
            className="min-w-0 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal p-3 sm:p-6 flex flex-col justify-between space-y-3 sm:space-y-4"
          >
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between border-b sm:border-b-2 border-primary/20 sm:border-primary pb-2 sm:pb-3">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-brand-teal stroke-[2.5]" />
                  <h2 id="evaluations-title" className="font-heading font-extrabold text-xs sm:text-base text-brand-navy">
                    Upcoming Evaluations
                  </h2>
                </div>
                <Badge variant={scheduledEvaluations.length > 0 ? 'teal' : 'muted'} size="sm">
                  {scheduledEvaluations.length} SCHEDULED
                </Badge>
              </div>

              {scheduledEvaluations.length === 0 ? (
                <div className="p-3 sm:p-5 border sm:border-2 border-dashed border-primary/30 bg-surface-inset rounded-semantic-xs sm:rounded-semantic-sm text-center space-y-1.5 sm:space-y-2 my-1 sm:my-2">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 border sm:border-2 border-primary bg-brand-teal-light rounded-semantic-xs mx-auto flex items-center justify-center">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-teal" />
                  </div>
                  <h3 className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                    No Evaluations Scheduled
                  </h3>
                  <p className="text-[11px] sm:text-xs text-brand-muted font-sans leading-relaxed">
                    Evaluations are periodic reviews to calibrate student retention and upcoming study plans.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 sm:space-y-2 my-1 sm:my-2">
                  {scheduledEvaluations.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2 sm:p-3 border sm:border-2 border-primary/25 bg-surface-inset rounded-semantic-xs flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                          {ev.title}
                        </h4>
                        <span className="font-mono text-[10px] sm:text-[11px] text-brand-muted">
                          {ev.scheduled_date ? new Date(ev.scheduled_date).toLocaleDateString() : 'Date pending'}
                        </span>
                      </div>
                      <Link to="/mentor/evaluations">
                        <Button variant="outline" size="sm" className="text-[11px] sm:text-xs">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 sm:pt-3 border-t border-primary/20 flex items-center justify-between text-[11px] sm:text-xs font-mono text-brand-muted">
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

        {/* 4. ASSIGNED STUDENTS ROSTER */}
        <section
          id="roster"
          aria-labelledby="roster-title"
          className="min-w-0 border sm:border-2 border-primary bg-surface-card rounded-semantic-sm sm:rounded-semantic-md shadow-micro sm:shadow-brutal p-3 sm:p-6 space-y-3 sm:space-y-4"
        >
          <div className="flex items-center justify-between border-b sm:border-b-2 border-primary/20 sm:border-primary pb-2 sm:pb-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="roster-title" className="font-heading font-extrabold text-xs sm:text-base text-brand-navy">
                Assigned Students
              </h2>
            </div>
            <Badge variant={students.length > 0 ? 'teal' : 'muted'} size="sm">
              {loading ? 'CHECKING...' : `${students.length} STUDENTS`}
            </Badge>
          </div>

          {errorMessage && (
            <div className="p-3 border sm:border-2 border-red-500 bg-red-50 text-red-900 text-xs font-mono rounded-semantic-xs flex items-center gap-2">
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-1 min-w-0">
              {students.map((student) => {
                const record = assignedStudentRecords.find((r) => r.student.id === student.id);
                const isIndividual = record?.assignmentType === 'individual';

                return (
                  <div
                    key={student.id}
                    className="min-w-0 p-3 sm:p-4 border sm:border-2 border-primary/30 sm:border-primary bg-surface-inset rounded-semantic-xs sm:rounded-semantic-sm flex flex-col justify-between gap-3 shadow-micro"
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-2 min-w-0">
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GraduationCap className="w-4 h-4 text-brand-teal shrink-0" />
                          <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy truncate">
                            {student.full_name}
                          </h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono text-brand-muted">
                          {student.poraplan_id && (
                            <>
                              <span className="font-bold text-brand-gold shrink-0">
                                ID: {student.poraplan_id}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span className="truncate max-w-[160px] sm:max-w-[200px]">{student.email}</span>
                        </div>
                        {student.university && (
                          <div className="text-[11px] text-brand-dark/70 font-sans truncate">
                            {student.university} {student.department ? `(${student.department})` : ''}
                          </div>
                        )}
                        {record?.cohort && (
                          <div className="text-[11px] font-mono text-brand-teal font-semibold pt-0.5 truncate">
                            {record.program?.name || 'Program'} • {record.cohort.name}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-row sm:flex-col items-center sm:items-end gap-1.5 shrink-0 self-start">
                        <Badge variant={isIndividual ? 'teal' : 'gold'} size="sm" className="font-bold text-[10px]">
                          {isIndividual ? 'INDIVIDUAL' : 'COHORT'}
                        </Badge>
                        {student.whatsapp_number && (
                          <a
                            href={`https://wa.me/${student.whatsapp_number.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1 font-mono font-bold shrink-0"
                          >
                            <Phone className="w-3 h-3 shrink-0" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary/20 flex items-center justify-between flex-wrap gap-2">
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
                        className="text-xs font-bold"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 border sm:border-2 border-dashed border-primary/30 bg-surface-inset rounded-semantic-xs sm:rounded-semantic-sm text-center space-y-2.5">
              <div className="w-10 h-10 border sm:border-2 border-primary bg-brand-teal-light rounded-semantic-xs mx-auto flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  No Students Assigned Yet
                </h3>
                <p className="text-xs text-brand-muted font-sans mt-1 leading-relaxed">
                  When administrators assign students to your mentorship account, their profiles, study submissions, and evaluations will appear here.
                </p>
              </div>
            </div>
          )}
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
          <div className="w-full max-w-md bg-surface-card border-2 sm:border-3 border-primary rounded-semantic-md shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-primary pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h2 id="student-details-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Student Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1 border-2 border-primary bg-surface-inset hover:bg-surface-elevated rounded-semantic-xs shadow-micro"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 border border-primary/30 bg-surface-inset rounded-semantic-xs space-y-1">
                <span className="font-mono text-[10px] text-brand-muted uppercase block font-bold">Full Name</span>
                <span className="font-bold text-brand-dark text-base font-sans">{selectedStudent.full_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-3 border border-primary/30 bg-surface-inset rounded-semantic-xs space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">PoraPlan ID</span>
                  <span className="font-bold text-brand-gold text-sm">
                    {selectedStudent.poraplan_id || '-'}
                  </span>
                </div>

                <div className="p-3 border border-primary/30 bg-surface-inset rounded-semantic-xs space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">Status</span>
                  <Badge variant="teal" size="sm">
                    {selectedStudent.status || 'ACTIVE'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 border border-primary/30 bg-surface-inset rounded-semantic-xs space-y-1">
                <span className="font-mono text-[10px] text-brand-muted uppercase block font-bold">Email</span>
                <div className="flex items-center gap-1.5 text-brand-dark">
                  <Mail className="w-3.5 h-3.5 text-brand-navy shrink-0" />
                  <span className="font-mono font-bold text-xs truncate">{selectedStudent.email}</span>
                </div>
              </div>

              <div className="p-3.5 border border-primary/30 bg-brand-teal-light/40 rounded-semantic-xs space-y-1 text-brand-dark font-sans text-xs">
                <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase text-brand-teal">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Assigned Student</span>
                </div>
                <p className="leading-relaxed">
                  You are paired as this student's mentor. You can configure their study plans, assign tasks, review practice sets, and schedule evaluations.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-primary/20">
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
