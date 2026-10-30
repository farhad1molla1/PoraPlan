import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getMentorEvaluations,
  createEvaluation,
  recordEvaluationResult,
  deleteEvaluation,
  type EvaluationWithMeta,
} from '../../lib/evaluations';
import { getAssignedStudents } from '../../lib/mentorship';
import { getStudentSubjects } from '../../lib/subjects';
import { getStudentStudyPlans } from '../../lib/studyPlans';
import type {
  Profile,
  Subject,
  StudyPlan,
  EvaluationFormat,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  Clock,
  Users,
  AlertCircle,
  Loader2,
  RefreshCw,
  Plus,
  CheckCircle2,
  Search,
  Sparkles,
  ArrowRight,
  Eye,
  Award,
  Trash2,
  Edit3,
} from 'lucide-react';

export const MentorEvaluationsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [evaluations, setEvaluations] = useState<EvaluationWithMeta[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'scheduled' | 'completed'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | EvaluationFormat>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal States
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [activeEval, setActiveEval] = useState<EvaluationWithMeta | null>(null);

  // Schedule Modal Form
  const [targetStudentId, setTargetStudentId] = useState('');
  const [evalTitle, setEvalTitle] = useState('');
  const [evalDescription, setEvalDescription] = useState('');
  const [evalFormat, setEvalFormat] = useState<EvaluationFormat>('oral');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('15:00');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [totalPoints, setTotalPoints] = useState(100);
  const [targetSubjectId, setTargetSubjectId] = useState('');
  const [targetPlanId, setTargetPlanId] = useState('');
  const [availableSubjects, setAvailableSubjects] = useState<Subject[]>([]);
  const [availablePlans, setAvailablePlans] = useState<StudyPlan[]>([]);
  const [submittingSchedule, setSubmittingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Result / Grading Modal Form
  const [gradingScore, setGradingScore] = useState<string>('');
  const [gradingFeedback, setGradingFeedback] = useState('');
  const [gradingRecommendation, setGradingRecommendation] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // Action status message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!mentorId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [evalsRes, studentsRes] = await Promise.all([
          getMentorEvaluations(mentorId),
          getAssignedStudents(mentorId),
        ]);

        if (!isMounted) return;

        if (evalsRes.error) {
          setErrorMessage(evalsRes.error.message);
        } else {
          setEvaluations(evalsRes.evaluations);
        }

        if (studentsRes.students) {
          setStudents(studentsRes.students);
          if (studentsRes.students.length > 0) {
            setTargetStudentId((prev) => prev || studentsRes.students[0].id);
          }
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
  }, [mentorId]);

  // Load subjects and plans when targetStudentId changes in modal
  useEffect(() => {
    let isMounted = true;
    async function loadContext() {
      if (!targetStudentId) {
        setAvailableSubjects([]);
        setAvailablePlans([]);
        return;
      }

      const [subjRes, plansRes] = await Promise.all([
        getStudentSubjects(targetStudentId),
        getStudentStudyPlans(targetStudentId),
      ]);
      if (!isMounted) return;
      if (!subjRes.error) setAvailableSubjects(subjRes.subjects);
      if (!plansRes.error) setAvailablePlans(plansRes.plans);
    }

    loadContext();
    return () => {
      isMounted = false;
    };
  }, [targetStudentId]);

  const handleRefresh = async () => {
    if (!mentorId) return;
    setRefreshing(true);
    setErrorMessage(null);
    const res = await getMentorEvaluations(mentorId);
    if (res.error) {
      setErrorMessage(res.error.message);
    } else {
      setEvaluations(res.evaluations);
    }
    setRefreshing(false);
  };

  const handleOpenScheduleModal = () => {
    setEvalTitle('');
    setEvalDescription('');
    setEvalFormat('oral');
    // Set default date to 3 days from now
    const d = new Date();
    d.setDate(d.getDate() + 3);
    setScheduledDate(d.toISOString().split('T')[0]);
    setScheduledTime('15:00');
    setDurationMinutes(30);
    setTotalPoints(100);
    setTargetSubjectId('');
    setTargetPlanId('');
    setScheduleError(null);
    if (students.length > 0 && !targetStudentId) {
      setTargetStudentId(students[0].id);
    }
    setShowScheduleModal(true);
  };

  const handleCreateEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudentId) {
      setScheduleError('Please select a student.');
      return;
    }
    if (!evalTitle.trim()) {
      setScheduleError('Please enter an evaluation title.');
      return;
    }
    if (!scheduledDate) {
      setScheduleError('Please specify a scheduled date.');
      return;
    }

    setSubmittingSchedule(true);
    setScheduleError(null);

    const res = await createEvaluation({
      studentId: targetStudentId,
      mentorId,
      title: evalTitle.trim(),
      description: evalDescription.trim() || undefined,
      format: evalFormat,
      scheduledDate,
      scheduledTime: scheduledTime || undefined,
      durationMinutes: Number(durationMinutes) || 30,
      totalPoints: Number(totalPoints) || 100,
      subjectId: targetSubjectId || undefined,
      planId: targetPlanId || undefined,
    });

    setSubmittingSchedule(false);

    if (res.error) {
      setScheduleError(res.error.message);
    } else {
      setShowScheduleModal(false);
      setActionSuccess(`Evaluation "${evalTitle.trim()}" successfully scheduled.`);
      setTimeout(() => setActionSuccess(null), 5000);
      handleRefresh();
    }
  };

  const handleOpenRecordResult = (evaluation: EvaluationWithMeta) => {
    setActiveEval(evaluation);
    setGradingScore(evaluation.score !== null && evaluation.score !== undefined ? String(evaluation.score) : '');
    setGradingFeedback(evaluation.feedback || '');
    setGradingRecommendation(evaluation.recommendation || '');
    setResultError(null);
    setShowResultModal(true);
  };

  const handleSaveResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEval) return;

    const parsedScore = parseFloat(gradingScore);
    if (isNaN(parsedScore)) {
      setResultError('Please enter a valid numeric score.');
      return;
    }
    if (parsedScore < 0 || (activeEval.total_points && parsedScore > activeEval.total_points)) {
      setResultError(`Score must be between 0 and ${activeEval.total_points || 100}.`);
      return;
    }
    if (!gradingFeedback.trim()) {
      setResultError('Evaluation commentary and concept notes are required.');
      return;
    }

    setSubmittingResult(true);
    setResultError(null);

    const res = await recordEvaluationResult({
      evaluationId: activeEval.id,
      mentorId,
      score: parsedScore,
      feedback: gradingFeedback.trim(),
      recommendation: gradingRecommendation.trim() || undefined,
      status: 'completed',
    });

    setSubmittingResult(false);

    if (res.error) {
      setResultError(res.error.message);
    } else {
      setShowResultModal(false);
      setActionSuccess(`Assessment result recorded for "${activeEval.title}".`);
      setTimeout(() => setActionSuccess(null), 5000);
      handleRefresh();
    }
  };

  const handleDeleteEvaluation = async (evaluation: EvaluationWithMeta) => {
    if (!window.confirm(`Are you sure you want to cancel and remove "${evaluation.title}"?`)) {
      return;
    }
    const res = await deleteEvaluation(evaluation.id, mentorId);
    if (res.error) {
      setErrorMessage(res.error.message);
    } else {
      setActionSuccess(`Evaluation "${evaluation.title}" was removed.`);
      setTimeout(() => setActionSuccess(null), 4000);
      handleRefresh();
    }
  };

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((item) => {
    if (selectedStudentId !== 'all' && item.student_id !== selectedStudentId) {
      return false;
    }
    if (statusFilter !== 'all' && item.status !== statusFilter) {
      return false;
    }
    if (formatFilter !== 'all' && item.format !== formatFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchStudent = (item.student_name || '').toLowerCase().includes(q);
      const matchSubject = (item.subject_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchStudent && !matchSubject) return false;
    }
    return true;
  });

  // Calculate high-level metrics
  const totalCount = evaluations.length;
  const scheduledCount = evaluations.filter((e) => e.status === 'scheduled').length;
  const completedCount = evaluations.filter((e) => e.status === 'completed').length;
  const scoredList = evaluations.filter((e) => e.status === 'completed' && e.score !== null && e.score !== undefined);
  const averageScore = scoredList.length > 0
    ? Math.round((scoredList.reduce((acc, curr) => acc + (curr.score || 0), 0) / scoredList.length) * 10) / 10
    : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-brand-dark pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
              Check-ins &amp; Reviews
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-navy tracking-tight mt-1">
            Evaluations
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-0.5">
            Schedule and record review sessions (Google Meet/Zoom or written) to evaluate understanding and adjust study plans.
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

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleOpenScheduleModal}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Evaluation</span>
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 border-2 border-brand-dark bg-emerald-50 text-emerald-900 text-xs font-mono flex items-center justify-between shadow-brutal-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

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
              ALL ASSESSMENTS
            </span>
            <Calendar className="w-4 h-4 text-brand-navy stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-brand-navy">
            {totalCount}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-0.5">
            Cumulative logged
          </span>
        </div>

        <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-amber-700">
              SCHEDULED QUEUE
            </span>
            <Clock className="w-4 h-4 text-brand-gold stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-brand-gold">
            {scheduledCount}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-0.5">
            Awaiting session
          </span>
        </div>

        <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
              COMPLETED REVIEWS
            </span>
            <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.5]" />
          </div>
          <div className="font-heading font-extrabold text-2xl text-brand-teal">
            {completedCount}
          </div>
          <span className="text-[10px] font-mono text-brand-muted mt-0.5">
            Milestones evaluated
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
            {averageScore !== null ? 'Calibrated retention' : 'No graded sessions yet'}
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 border-2 border-brand-dark text-xs font-mono font-bold transition-all ${
                statusFilter === 'all'
                  ? 'bg-brand-navy text-brand-paper shadow-brutal-xs'
                  : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
              }`}
            >
              All Statuses ({totalCount})
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

          {/* Student Selector */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-muted shrink-0" />
            <select
              aria-label="Filter by assigned student"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="p-1.5 border-2 border-brand-dark bg-brand-paper text-xs font-mono font-bold text-brand-navy shadow-brutal-xs focus:outline-none"
            >
              <option value="all">All Assigned Students ({students.length})</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}{s.poraplan_id ? ` (${s.poraplan_id})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filter: Search & Format */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-brand-dark/20">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-brand-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by evaluation title, subject, or student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border-2 border-brand-dark bg-brand-bg text-xs font-sans text-brand-dark focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-brand-muted uppercase text-[10px] font-bold">Format:</span>
            <select
              aria-label="Filter by evaluation format"
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
      </div>

      {/* Evaluations List */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
          <p className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING EVALUATIONS DATABASE
          </p>
          <span className="font-mono text-xs text-brand-muted block">
            Querying evaluations for assigned students...
          </span>
        </div>
      ) : filteredEvaluations.length > 0 ? (
        <div className="space-y-3">
          {filteredEvaluations.map((item) => {
            const isCompleted = item.status === 'completed';
            const isScheduled = item.status === 'scheduled';

            return (
              <div
                key={item.id}
                className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3 hover:translate-x-0.5 transition-transform"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={item.format === 'oral' ? 'teal' : item.format === 'written' ? 'gold' : 'navy'}
                        size="sm"
                      >
                        {item.format.toUpperCase()} REVIEW
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
                        <span className="px-2 py-0.5 border border-brand-dark/20 bg-brand-paper text-[10px] font-mono text-brand-muted truncate max-w-[180px]">
                          Plan: {item.plan_title}
                        </span>
                      )}
                    </div>

                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                      {item.title}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-brand-muted">
                      <span className="font-bold text-brand-teal flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" />
                        Student: {item.student_name}{item.student_poraplan_id ? ` (${item.student_poraplan_id})` : ''}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-brand-dark font-medium">
                        <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                        {item.scheduled_date} {item.scheduled_time ? `at ${item.scheduled_time}` : ''}
                      </span>
                      <span>•</span>
                      <span>{item.duration_minutes || 30} mins</span>
                      <span>•</span>
                      <span>Max Points: {item.total_points || 100}</span>
                    </div>
                  </div>

                  {/* Score pill if completed */}
                  {isCompleted && item.score !== null && item.score !== undefined && (
                    <div className="shrink-0 text-right p-2.5 border-2 border-brand-dark bg-brand-teal-light shadow-brutal-xs">
                      <span className="font-mono text-[10px] uppercase font-bold text-brand-navy block">
                        RECORDED SCORE
                      </span>
                      <div className="font-heading font-extrabold text-xl text-brand-navy">
                        {item.score}
                        <span className="text-xs font-mono font-normal text-brand-muted">
                          {' '}/ {item.total_points || 100}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {item.description && (
                  <p className="text-xs text-brand-dark font-sans bg-brand-paper-tint p-2.5 border border-brand-dark/20 leading-relaxed">
                    <span className="font-bold font-mono text-[11px] text-brand-muted uppercase block mb-0.5">
                      Assessment Agenda &amp; Scope:
                    </span>
                    {item.description}
                  </p>
                )}

                {/* Completed Feedback Snippet */}
                {isCompleted && item.feedback && (
                  <div className="p-3 border-2 border-brand-dark bg-brand-paper text-xs space-y-1.5 shadow-brutal-xs">
                    <div className="flex items-center justify-between font-mono text-[11px] font-bold text-brand-navy">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-gold" />
                        Mentor Evaluation Notes &amp; Retention Check:
                      </span>
                      {item.evaluated_at && (
                        <span className="text-brand-muted text-[10px] font-normal">
                          Evaluated: {new Date(item.evaluated_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="font-sans text-brand-dark leading-relaxed">
                      {item.feedback}
                    </p>
                    {item.recommendation && (
                      <div className="pt-1.5 border-t border-brand-dark/20 text-brand-teal font-medium flex items-start gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span><strong>Study Pacing Calibration:</strong> {item.recommendation}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Action Footer */}
                <div className="pt-2 border-t border-brand-dark/20 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-brand-muted">
                    {isCompleted
                      ? 'Milestone completed and recorded'
                      : 'Scheduled checkpoint awaiting assessment'}
                  </span>

                  <div className="flex items-center gap-2">
                    {isScheduled && (
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => handleOpenRecordResult(item)}
                        className="text-xs flex items-center gap-1"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Record Assessment Result</span>
                      </Button>
                    )}

                    {isCompleted && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenRecordResult(item)}
                        className="text-xs flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Revise Evaluation</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActiveEval(item);
                        setShowDossierModal(true);
                      }}
                      className="text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Dossier</span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => handleDeleteEvaluation(item)}
                      title="Cancel evaluation"
                      className="p-1.5 border border-brand-dark text-red-700 hover:bg-red-50 text-xs font-mono"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-3">
          <div className="w-12 h-12 border-2 border-brand-dark bg-brand-gold-light rounded-none mx-auto flex items-center justify-center">
            <Calendar className="w-6 h-6 text-brand-gold stroke-[2.5]" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="font-heading font-extrabold text-base text-brand-navy">
              No Evaluations Found
            </h3>
            <p className="text-xs text-brand-muted leading-relaxed">
              {evaluations.length === 0
                ? 'You have not scheduled any evaluations for your assigned students yet. Evaluations allow you to conduct short review sessions (via Google Meet/Zoom or written) and calibrate study plans.'
                : 'No evaluations match your current filter and search criteria.'}
            </p>
          </div>
          {evaluations.length === 0 && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleOpenScheduleModal}
              className="mt-2"
            >
              Schedule First Evaluation
            </Button>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: SCHEDULE EVALUATION                                              */}
      {/* ========================================================================= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b-2 border-brand-dark bg-brand-navy text-brand-paper">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-gold" />
                <h2 className="font-heading font-extrabold text-base text-brand-paper">
                  Schedule Evaluation
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowScheduleModal(false)}
                className="text-brand-paper hover:text-brand-gold transition-colors font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvaluation} className="p-5 space-y-4">
              {scheduleError && (
                <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{scheduleError}</span>
                </div>
              )}

              {/* Student Selector */}
              <div>
                <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                  Target Assigned Student *
                </label>
                <select
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  required
                  className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name}{s.poraplan_id ? ` (${s.poraplan_id})` : ''} — {s.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                  Evaluation Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mechanics Milestone Oral Review & Problem Solving"
                  value={evalTitle}
                  onChange={(e) => setEvalTitle(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                />
              </div>

              {/* Format & Total Points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Evaluation Format *
                  </label>
                  <select
                    value={evalFormat}
                    onChange={(e) => setEvalFormat(e.target.value as EvaluationFormat)}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  >
                    <option value="oral">Oral Concept Walkthrough</option>
                    <option value="written">Written Problem Set</option>
                    <option value="practical">Practical / Numerical Assessment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Max Total Points
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={totalPoints}
                    onChange={(e) => setTotalPoints(Number(e.target.value))}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Subject & Plan Linkage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Associated Study Area (Optional)
                  </label>
                  <select
                    value={targetSubjectId}
                    onChange={(e) => setTargetSubjectId(e.target.value)}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  >
                    <option value="">None / General</option>
                    {availableSubjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Associated Study Plan (Optional)
                  </label>
                  <select
                    value={targetPlanId}
                    onChange={(e) => setTargetPlanId(e.target.value)}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  >
                    <option value="">None / Milestone Checkpoint</option>
                    {availablePlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date, Time & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="180"
                    step="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                  />
                </div>
              </div>

              {/* Agenda / Scope */}
              <div>
                <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                  Evaluation Agenda &amp; Scope
                </label>
                <textarea
                  rows={3}
                  placeholder="Specific topics, chapters, and question types the student will be evaluated on..."
                  value={evalDescription}
                  onChange={(e) => setEvalDescription(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none resize-none"
                />
              </div>

              <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowScheduleModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submittingSchedule}
                >
                  {submittingSchedule ? 'Scheduling...' : 'Confirm Schedule'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECORD ASSESSMENT RESULT & GRADING                               */}
      {/* ========================================================================= */}
      {showResultModal && activeEval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal w-full max-w-xl my-8">
            <div className="flex items-center justify-between p-4 border-b-2 border-brand-dark bg-brand-navy text-brand-paper">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-brand-gold" />
                <h2 className="font-heading font-extrabold text-base text-brand-paper">
                  Record Milestone Assessment Result
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="text-brand-paper hover:text-brand-gold transition-colors font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveResult} className="p-5 space-y-4">
              {resultError && (
                <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-mono flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                  <span>{resultError}</span>
                </div>
              )}

              {/* Context Summary */}
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint text-xs font-mono space-y-1">
                <div className="flex items-center justify-between text-brand-navy font-bold">
                  <span>{activeEval.title}</span>
                  <Badge variant="teal" size="sm">{activeEval.format.toUpperCase()}</Badge>
                </div>
                <div className="text-brand-muted flex items-center justify-between text-[11px]">
                  <span>Student: {activeEval.student_name}</span>
                  <span>Max Points: {activeEval.total_points || 100}</span>
                </div>
              </div>

              {/* Score Input */}
              <div>
                <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                  Awarded Score (Points out of {activeEval.total_points || 100}) *
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={activeEval.total_points || 100}
                  required
                  placeholder={`e.g. 88.5`}
                  value={gradingScore}
                  onChange={(e) => setGradingScore(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-sm font-mono font-bold text-brand-navy shadow-brutal-xs focus:outline-none"
                />
              </div>

              {/* Qualitative Concept Notes */}
              <div>
                <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                  Feedback &amp; Performance Notes *
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Detail the student's performance, strengths, areas needing improvement, and next steps..."
                  value={gradingFeedback}
                  onChange={(e) => setGradingFeedback(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none resize-none"
                />
              </div>

              {/* Next Milestone Calibration */}
              <div>
                <label className="block text-xs font-mono font-bold text-brand-navy uppercase mb-1">
                  Pacing Calibration &amp; Next Milestone Guidance
                </label>
                <input
                  type="text"
                  placeholder="e.g. Proceed to Work-Energy Theorem. Revisit inclined plane friction before Chapter 5."
                  value={gradingRecommendation}
                  onChange={(e) => setGradingRecommendation(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-brand-paper text-xs font-sans text-brand-dark shadow-brutal-xs focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResultModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submittingResult}
                >
                  {submittingResult ? 'Saving...' : 'Save Assessment Result'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EVALUATION DOSSIER INSPECTOR                                     */}
      {/* ========================================================================= */}
      {showDossierModal && activeEval && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal w-full max-w-lg my-8">
            <div className="flex items-center justify-between p-4 border-b-2 border-brand-dark bg-brand-navy text-brand-paper">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-brand-teal" />
                <h2 className="font-heading font-extrabold text-base text-brand-paper">
                  Evaluation Milestone Dossier
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowDossierModal(false)}
                className="text-brand-paper hover:text-brand-gold transition-colors font-bold text-lg p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs font-sans text-brand-dark">
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase font-bold text-brand-muted">
                    STUDENT PROFILE
                  </span>
                  <Badge variant="teal" size="sm">{activeEval.status.toUpperCase()}</Badge>
                </div>
                <div className="font-heading font-extrabold text-base text-brand-navy">
                  {activeEval.student_name}
                </div>
                <div className="font-mono text-[11px] text-brand-muted">
                  {activeEval.student_poraplan_id ? `ID: ${activeEval.student_poraplan_id}` : ''}
                  {activeEval.student_poraplan_id && activeEval.student_email ? ' • ' : ''}
                  {activeEval.student_email || ''}
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-mono uppercase font-bold text-[10px] text-brand-muted">
                  EVALUATION TITLE
                </span>
                <p className="font-heading font-extrabold text-sm text-brand-navy">
                  {activeEval.title}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 border border-brand-dark/20 bg-brand-paper">
                  <span className="text-[10px] text-brand-muted uppercase block">FORMAT</span>
                  <span className="font-bold text-brand-navy">{activeEval.format.toUpperCase()}</span>
                </div>
                <div className="p-2 border border-brand-dark/20 bg-brand-paper">
                  <span className="text-[10px] text-brand-muted uppercase block">SCHEDULED</span>
                  <span className="font-bold text-brand-navy">{activeEval.scheduled_date}</span>
                </div>
              </div>

              {activeEval.score !== null && activeEval.score !== undefined && (
                <div className="p-3.5 border-2 border-brand-dark bg-brand-gold-light space-y-1">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-dark">
                    EVALUATION SCORE AWARDED
                  </span>
                  <div className="font-heading font-extrabold text-2xl text-brand-navy">
                    {activeEval.score} / {activeEval.total_points || 100}
                  </div>
                </div>
              )}

              {activeEval.feedback && (
                <div className="space-y-1">
                  <span className="font-mono uppercase font-bold text-[10px] text-brand-muted">
                    MENTOR WRITTEN ASSESSMENT
                  </span>
                  <p className="p-3 border border-brand-dark/20 bg-brand-paper leading-relaxed">
                    {activeEval.feedback}
                  </p>
                </div>
              )}

              {activeEval.recommendation && (
                <div className="space-y-1">
                  <span className="font-mono uppercase font-bold text-[10px] text-brand-teal">
                    STUDY PACING CALIBRATION
                  </span>
                  <p className="p-2.5 border border-brand-teal/40 bg-brand-teal-light text-brand-navy font-medium leading-relaxed">
                    {activeEval.recommendation}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t-2 border-brand-dark flex justify-end">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => setShowDossierModal(false)}
                >
                  Close Dossier
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
