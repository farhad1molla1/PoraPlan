import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentEvaluations,
  type EvaluationWithMeta,
} from '../../lib/evaluations';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile, EvaluationFormat } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Award,
  FileCheck,
  ChevronRight,
} from 'lucide-react';

export const StudentEvaluationsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  const [evaluations, setEvaluations] = useState<EvaluationWithMeta[]>([]);
  const [assignedMentor, setAssignedMentor] = useState<Profile | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | EvaluationFormat>('all');
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
        const [evalsRes, mentorsRes] = await Promise.all([
          getStudentEvaluations(studentId),
          getAssignedMentors(studentId),
        ]);

        if (!isMounted) return;

        if (evalsRes.error) {
          setErrorMessage(evalsRes.error.message);
        } else {
          setEvaluations(evalsRes.evaluations);
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
    const res = await getStudentEvaluations(studentId);
    if (res.error) {
      setErrorMessage(res.error.message);
    } else {
      setEvaluations(res.evaluations);
    }
    setRefreshing(false);
  };

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }
    if (formatFilter !== 'all' && item.format !== formatFilter) {
      return false;
    }
    return true;
  });

  // Calculate metrics
  const totalCount = evaluations.length;
  const scheduledCount = evaluations.filter((e) => e.status === 'scheduled').length;
  const completedCount = evaluations.filter((e) => e.status === 'completed').length;
  const scoredList = evaluations.filter((e) => e.status === 'completed' && e.score !== null && e.score !== undefined);
  const averageScore = scoredList.length > 0
    ? Math.round((scoredList.reduce((acc, curr) => acc + (curr.score || 0), 0) / scoredList.length) * 10) / 10
    : null;

  // Next scheduled date
  const upcomingScheduled = evaluations
    .filter((e) => e.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime())[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-brand-dark pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase text-brand-teal font-bold tracking-wider">
              STEP 6 &amp; 7: EVALUATION &amp; PROGRESS
            </span>
            <Badge variant="teal" size="sm">ACADEMIC CHECKPOINTS</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-navy tracking-tight mt-1">
            Milestone Evaluations &amp; Calibration
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
            Structured oral walkthroughs and milestone reviews scheduled with your mentor to verify concept retention.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>

          <Link to="/student/assignments">
            <Button variant="outline" size="sm" className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-brand-teal" />
              <span>Practice Submissions</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Mentor Pairing Callout */}
      <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-gold text-brand-dark shadow-brutal-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wide uppercase">
              <Sparkles className="w-4 h-4 text-brand-navy shrink-0" />
              <span>HOW MILESTONE EVALUATIONS OPERATE IN PORAPLAN</span>
            </div>
            <p className="text-xs font-sans font-medium text-brand-dark/90 leading-relaxed">
              {assignedMentor ? (
                <>
                  Your assigned mentor, <span className="font-bold underline">{assignedMentor.full_name}</span>, conducts scheduled milestone assessments after you complete study plans and practice sets. These sessions check derivations, resolve subtle misconceptions, and calibrate your upcoming weekly syllabus pace.
                </>
              ) : (
                'You are currently studying independently. When a platform mentor is paired with your account, they will schedule milestone reviews and pacing calibrations here.'
              )}
            </p>
          </div>
          {assignedMentor && (
            <div className="px-3 py-1 border-2 border-brand-dark bg-brand-paper text-brand-dark font-mono text-xs font-bold shrink-0 self-start sm:self-center shadow-brutal-xs">
              Mentor: {assignedMentor.full_name}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-mono flex items-center justify-between shadow-brutal-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-700 hover:text-red-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
              ALL CHECKPOINTS
            </span>
            <Calendar className="w-4 h-4 text-brand-navy stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-brand-navy">
            {totalCount}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-0.5">
            Syllabus reviews
          </span>
        </div>

        <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-amber-700">
              UPCOMING REVIEW
            </span>
            <Clock className="w-4 h-4 text-brand-gold stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-xl text-brand-gold truncate">
            {upcomingScheduled ? upcomingScheduled.scheduled_date : 'None'}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-0.5">
            {upcomingScheduled ? `${upcomingScheduled.format.toUpperCase()} assessment` : 'All caught up'}
          </span>
        </div>

        <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
              COMPLETED
            </span>
            <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-brand-teal">
            {completedCount}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-0.5">
            Milestones verified
          </span>
        </div>

        <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
              AVERAGE SCORE
            </span>
            <Award className="w-4 h-4 text-brand-navy stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-brand-navy">
            {averageScore !== null ? `${averageScore}` : '—'}
            {averageScore !== null && <span className="text-xs font-mono text-brand-muted font-normal"> / 100</span>}
          </div>
          <span className="text-[10px] font-mono text-brand-teal font-bold mt-0.5">
            {averageScore !== null ? 'Concept mastery' : 'Awaiting graded sessions'}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 border-2 border-brand-dark text-xs font-mono font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-brand-navy text-brand-paper shadow-brutal-xs'
                : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
            }`}
          >
            All Checkpoints ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('scheduled')}
            className={`px-3 py-1.5 border-2 border-brand-dark text-xs font-mono font-bold transition-all ${
              statusFilter === 'scheduled'
                ? 'bg-brand-gold text-brand-dark shadow-brutal-xs'
                : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
            }`}
          >
            Scheduled ({scheduledCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('completed')}
            className={`px-3 py-1.5 border-2 border-brand-dark text-xs font-mono font-bold transition-all ${
              statusFilter === 'completed'
                ? 'bg-brand-teal text-brand-paper shadow-brutal-xs'
                : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-brand-muted uppercase text-[10px] font-bold">Format:</span>
          <select
            aria-label="Filter by format"
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as any)}
            className="p-1 border border-brand-dark bg-brand-paper text-xs font-mono font-bold"
          >
            <option value="all">All Formats</option>
            <option value="oral">Oral Walkthrough</option>
            <option value="written">Written Problem Set</option>
            <option value="practical">Practical Assessment</option>
          </select>
        </div>
      </div>

      {/* Evaluations List */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <p className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING EVALUATION CHECKPOINTS
          </p>
          <span className="font-mono text-xs text-brand-muted block">
            Retrieving scheduled reviews and calibrated milestones...
          </span>
        </div>
      ) : filteredEvaluations.length > 0 ? (
        <div className="space-y-4">
          {filteredEvaluations.map((item) => {
            const isCompleted = item.status === 'completed';
            const isScheduled = item.status === 'scheduled';

            return (
              <div
                key={item.id}
                className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={item.format === 'oral' ? 'teal' : item.format === 'written' ? 'gold' : 'navy'}
                        size="sm"
                      >
                        {item.format.toUpperCase()} ASSESSMENT
                      </Badge>

                      <Badge
                        variant={isCompleted ? 'teal' : isScheduled ? 'gold' : 'muted'}
                        size="sm"
                      >
                        {item.status.toUpperCase()}
                      </Badge>

                      {item.subject_name && (
                        <span className="px-2 py-0.5 border border-brand-dark/40 bg-brand-paper-tint text-[10px] font-mono font-bold text-brand-navy">
                          {item.subject_name}
                        </span>
                      )}

                      {item.plan_title && (
                        <span className="px-2 py-0.5 border border-brand-dark/20 bg-brand-paper text-[10px] font-mono text-brand-muted truncate max-w-[200px]">
                          Roadmap: {item.plan_title}
                        </span>
                      )}
                    </div>

                    <h2 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
                      {item.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-brand-muted">
                      <span className="flex items-center gap-1 text-brand-dark font-medium">
                        <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                        {item.scheduled_date} {item.scheduled_time ? `at ${item.scheduled_time}` : ''}
                      </span>
                      <span>•</span>
                      <span>Duration: {item.duration_minutes || 30} minutes</span>
                      <span>•</span>
                      <span>Points: {item.total_points || 100}</span>
                      {item.mentor_name && (
                        <>
                          <span>•</span>
                          <span className="text-brand-teal font-bold">Mentor: {item.mentor_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Recorded Score Callout */}
                  {isCompleted && item.score !== null && item.score !== undefined && (
                    <div className="shrink-0 text-right p-3 border-2 border-brand-dark bg-brand-teal-light shadow-brutal-xs">
                      <span className="font-mono text-[10px] uppercase font-bold text-brand-navy block">
                        EVALUATION SCORE
                      </span>
                      <div className="font-heading font-extrabold text-2xl text-brand-navy">
                        {item.score}
                        <span className="text-xs font-mono font-normal text-brand-muted">
                          {' '}/ {item.total_points || 100}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Scope & Description */}
                {item.description && (
                  <div className="p-3 border border-brand-dark/20 bg-brand-paper-tint text-xs space-y-1 leading-relaxed">
                    <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                      Scope &amp; Evaluation Focus:
                    </span>
                    <p className="font-sans text-brand-dark">{item.description}</p>
                  </div>
                )}

                {/* Status-specific Display */}
                {isScheduled && (
                  <div className="p-3.5 border-2 border-dashed border-brand-gold/80 bg-brand-gold-light/40 flex items-start gap-3">
                    <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5 text-xs">
                      <span className="font-heading font-bold text-brand-navy block">
                        Scheduled Session with Your Mentor
                      </span>
                      <p className="text-brand-muted leading-relaxed">
                        This milestone evaluation is scheduled for {item.scheduled_date}. Review your notes, homework derivations, and key formulas in advance. Your mentor will walk through practice problems with you.
                      </p>
                    </div>
                  </div>
                )}

                {isCompleted && item.feedback && (
                  <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-brand-dark/20 pb-2">
                      <span className="font-mono text-xs font-bold text-brand-navy uppercase flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-brand-gold" />
                        Mentor Written Assessment &amp; Retention Notes
                      </span>
                      {item.evaluated_at && (
                        <span className="font-mono text-[10px] text-brand-muted">
                          Evaluated: {new Date(item.evaluated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-sans text-brand-dark leading-relaxed">
                      {item.feedback}
                    </p>

                    {item.recommendation && (
                      <div className="p-3 border border-brand-teal/40 bg-brand-teal-light text-xs font-sans space-y-1">
                        <span className="font-mono text-[10px] uppercase font-bold text-brand-teal block">
                          Next Roadmap Calibration &amp; Pacing Advice:
                        </span>
                        <p className="font-medium text-brand-navy">
                          {item.recommendation}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer Linkage */}
                <div className="pt-2 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
                  <span>
                    {isCompleted ? '✓ Milestone completed' : '⏱ Session scheduled'}
                  </span>
                  <Link
                    to="/student/plans"
                    className="font-bold text-brand-navy hover:text-brand-teal transition-colors flex items-center gap-1"
                  >
                    <span>View Study Plans</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-3">
          <div className="w-12 h-12 border-2 border-brand-dark bg-brand-teal-light rounded-none mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6 text-brand-teal stroke-[2.5]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-heading font-extrabold text-base text-brand-navy">
              No Milestone Evaluations Scheduled
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed">
              {evaluations.length === 0
                ? 'Your mentor has not scheduled any milestone evaluations for you yet. After you submit practice exercises, your mentor will schedule oral or written check-ins here to evaluate your understanding.'
                : 'No evaluations match your current status filter.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
