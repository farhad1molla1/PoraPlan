import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getMentorReviewQueue,
  reviewSubmission,
  type SubmissionWithMeta,
} from '../../lib/assignments';
import type { SubmissionStatus } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  FileCheck,
  Calendar,
  BookOpen,
  Clock,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Paperclip,
  Eye,
  X,
  MessageSquare,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

export const MentorReviewQueuePage: React.FC = () => {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<SubmissionWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filterState, setFilterState] = useState<'all' | 'needs_review' | 'reviewed' | 'needs_revision'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Review Modal State
  const [reviewTarget, setReviewTarget] = useState<SubmissionWithMeta | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewScore, setReviewScore] = useState('');
  const [reviewStatus, setReviewStatus] = useState<SubmissionStatus>('reviewed');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewModalError, setReviewModalError] = useState<string | null>(null);
  const [reviewModalSuccess, setReviewModalSuccess] = useState<string | null>(null);

  const mentorId = user?.id || '';

  const loadSubmissions = () => {
    if (!mentorId) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    setLoading(true);
    setErrorMessage(null);

    getMentorReviewQueue(mentorId)
      .then(({ submissions: list, error }) => {
        if (error) {
          setErrorMessage(error.message);
        } else {
          setSubmissions(list);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load review queue.';
        setErrorMessage(msg);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorId]);

  const handleOpenReviewModal = (submission: SubmissionWithMeta) => {
    setReviewTarget(submission);
    setReviewFeedback(submission.feedback || '');
    setReviewScore(submission.score !== undefined && submission.score !== null ? String(submission.score) : '');
    setReviewStatus(submission.status === 'needs_revision' ? 'needs_revision' : 'reviewed');
    setReviewModalError(null);
    setReviewModalSuccess(null);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    if (!reviewFeedback.trim()) {
      setReviewModalError('Feedback comments are required.');
      return;
    }

    setIsSubmittingReview(true);
    setReviewModalError(null);
    setReviewModalSuccess(null);

    const parsedScore = reviewScore.trim() ? parseFloat(reviewScore) : null;
    const { submission: updated, error } = await reviewSubmission({
      submissionId: reviewTarget.id,
      mentorId,
      status: reviewStatus,
      feedback: reviewFeedback,
      score: parsedScore,
    });

    setIsSubmittingReview(false);

    if (error) {
      setReviewModalError(error.message);
    } else if (updated) {
      setReviewModalSuccess('Review and feedback saved successfully!');
      // Update local item
      setSubmissions((prev) =>
        prev.map((s) => (s.id === reviewTarget.id ? { ...s, ...updated } : s))
      );
      setReviewTarget((prev) => (prev ? { ...prev, ...updated } : null));
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter((s) => {
    // Filter by tab
    if (filterState === 'needs_review' && (s.status !== 'submitted' && s.status !== 'under_review')) {
      return false;
    }
    if (filterState === 'reviewed' && s.status !== 'reviewed') {
      return false;
    }
    if (filterState === 'needs_revision' && s.status !== 'needs_revision') {
      return false;
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = s.assignment_title?.toLowerCase().includes(q);
      const matchStudent = s.student_name?.toLowerCase().includes(q);
      const matchId = s.student_poraplan_id?.toLowerCase().includes(q);
      const matchSubj = s.subject_name?.toLowerCase().includes(q);
      if (!matchTitle && !matchStudent && !matchId && !matchSubj) return false;
    }

    return true;
  });

  const totalCount = submissions.length;
  const needsReviewCount = submissions.filter((s) => s.status === 'submitted' || s.status === 'under_review').length;
  const reviewedCount = submissions.filter((s) => s.status === 'reviewed').length;
  const revisionCount = submissions.filter((s) => s.status === 'needs_revision').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-brand-bg border-4 border-brand-dark p-6 shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-brand-gold uppercase tracking-wider">
              Student Submissions
            </span>
            <Badge variant="gold" size="sm">
              FEEDBACK
            </Badge>
          </div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-brand-navy">
            Review Queue
          </h1>
          <p className="text-sm text-brand-muted mt-1 max-w-2xl">
            Review practice tasks, written work, and problem sets submitted by your assigned students. Provide feedback and guidance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadSubmissions}
            disabled={loading}
            className="flex items-center gap-1.5"
            aria-label="Refresh review queue"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/mentor/assignments">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              Assignments Manager
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Total</span>
            <FileCheck className="w-4 h-4 text-brand-navy" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-navy">{totalCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">All student submissions</div>
        </div>

        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Needs Review</span>
            <Clock className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-gold">{needsReviewCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">Awaiting evaluation</div>
        </div>

        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Reviewed</span>
            <CheckCircle2 className="w-4 h-4 text-brand-teal" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-teal">{reviewedCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">Feedback saved</div>
        </div>

        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Needs Revision</span>
            <RotateCcw className="w-4 h-4 text-red-600" />
          </div>
          <div className="font-heading font-black text-2xl text-red-600">{revisionCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">Requested corrections</div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border-3 border-red-500 p-4 text-red-700 flex items-start gap-3 shadow-brutal-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Failed to Load Review Queue</h4>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setFilterState('all')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              filterState === 'all'
                ? 'bg-brand-navy text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            All Submissions ({totalCount})
          </button>
          <button
            onClick={() => setFilterState('needs_review')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              filterState === 'needs_review'
                ? 'bg-brand-gold text-brand-dark shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            Needs Review ({needsReviewCount})
          </button>
          <button
            onClick={() => setFilterState('reviewed')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              filterState === 'reviewed'
                ? 'bg-brand-teal text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            Reviewed ({reviewedCount})
          </button>
          <button
            onClick={() => setFilterState('needs_revision')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              filterState === 'needs_revision'
                ? 'bg-red-600 text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            Needs Revision ({revisionCount})
          </button>
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student or assignment..."
            className="w-full bg-white border-2 border-brand-dark px-3 py-1.5 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
          />
        </div>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="bg-white border-3 border-brand-dark p-12 text-center shadow-brutal">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal mb-3" />
          <p className="font-mono text-sm text-brand-muted font-bold uppercase tracking-wider">
            Loading student submissions...
          </p>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="bg-white border-4 border-brand-dark p-8 md:p-12 text-center shadow-brutal">
          <div className="w-16 h-16 bg-brand-paper-tint border-3 border-brand-dark flex items-center justify-center mx-auto mb-4 shadow-brutal-sm">
            <FileCheck className="w-8 h-8 text-brand-muted" />
          </div>
          <h3 className="font-heading font-black text-xl text-brand-navy mb-2">
            No Submissions Found
          </h3>
          <p className="text-sm text-brand-muted max-w-md mx-auto mb-6">
            {filterState === 'all'
              ? 'No student submissions have been turned in yet across your assigned students.'
              : `There are currently no submissions matching "${filterState.replace('_', ' ').toUpperCase()}".`}
          </p>
          <Link to="/mentor/assignments">
            <Button variant="primary" size="sm" className="flex items-center gap-1.5 mx-auto">
              Go to Assignments Manager
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => {
            const isReviewed = sub.status === 'reviewed';
            const isRevision = sub.status === 'needs_revision';

            return (
              <div
                key={sub.id}
                className="bg-white border-3 border-brand-dark p-5 sm:p-6 shadow-brutal-sm hover:shadow-brutal transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    {/* Top Scholar & Subject Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold uppercase tracking-wider bg-brand-navy text-white px-2 py-0.5">
                        {sub.student_name} ({sub.student_poraplan_id})
                      </span>

                      {sub.subject_name && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-paper-tint border border-brand-dark px-2 py-0.5 text-brand-navy flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-brand-teal" />
                          {sub.subject_name}
                        </span>
                      )}

                      <Badge
                        variant={isReviewed ? 'teal' : isRevision ? 'danger' : 'gold'}
                        size="sm"
                      >
                        STATUS: {sub.status.replace('_', ' ').toUpperCase()}
                      </Badge>

                      <Badge variant="muted" size="sm">
                        FORMAT: {sub.submission_type.toUpperCase()}
                      </Badge>

                      {sub.score !== undefined && sub.score !== null && (
                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider bg-teal-50 border border-brand-teal px-2 py-0.5 text-brand-teal">
                          SCORE: {sub.score} / {sub.assignment_total_points || 100} PTS
                        </span>
                      )}
                    </div>

                    {/* Assignment Title */}
                    <h3 className="font-heading font-bold text-lg text-brand-navy">
                      {sub.assignment_title}
                    </h3>

                    {/* Student Work Preview */}
                    <div className="bg-brand-paper p-3 border border-brand-dark text-xs sm:text-sm font-sans leading-relaxed text-brand-dark">
                      {sub.submission_type === 'link' ? (
                        <div className="flex items-center gap-2 font-mono text-brand-teal">
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          <a
                            href={sub.link_url || sub.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline break-all hover:text-brand-navy"
                          >
                            {sub.link_url || sub.content}
                          </a>
                        </div>
                      ) : sub.submission_type === 'file' ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 font-mono text-brand-navy">
                            <Paperclip className="w-4 h-4 text-brand-teal" />
                            <strong>{sub.file_name || 'Attached File'}</strong>
                            {sub.file_size && (
                              <span className="text-brand-muted">
                                ({Math.round(sub.file_size / 1024)} KB)
                              </span>
                            )}
                          </div>
                          {sub.content && <p className="text-xs text-brand-muted">{sub.content}</p>}
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{sub.content}</p>
                      )}
                    </div>

                    {/* Persisted Mentor Feedback Display if reviewed */}
                    {sub.feedback && (
                      <div className="p-3.5 bg-teal-50/70 border-2 border-brand-teal space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-mono text-brand-teal font-bold">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-4 h-4" />
                            Mentor Feedback &amp; Notes
                          </span>
                          {sub.reviewed_at && (
                            <span className="text-[11px] text-brand-muted font-normal">
                              Evaluated: {new Date(sub.reviewed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-sans text-brand-dark leading-relaxed whitespace-pre-wrap">
                          {sub.feedback}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Actions & Dates */}
                  <div className="flex flex-col md:items-end justify-between gap-3 flex-shrink-0">
                    <div className="text-xs font-mono text-brand-muted space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-brand-muted" />
                        Submitted: {sub.submitted_at ? new Date(sub.submitted_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>

                    <Button
                      variant={isReviewed ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleOpenReviewModal(sub)}
                      className="flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      {isReviewed ? 'Update Feedback' : 'Evaluate Work'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVALUATION & FEEDBACK MODAL */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-white border-4 border-brand-dark p-6 max-w-xl w-full shadow-brutal max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-brand-dark mb-4">
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-teal">
                  Evaluation &amp; Feedback Console
                </div>
                <h3 className="font-heading font-black text-lg text-brand-navy">
                  {reviewTarget.assignment_title}
                </h3>
              </div>
              <button
                onClick={() => setReviewTarget(null)}
                className="text-brand-muted hover:text-brand-dark p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Submission Meta */}
              <div className="bg-brand-paper p-3 border-2 border-brand-dark flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div>
                  <span className="text-brand-muted">Student:</span>{' '}
                  <strong>{reviewTarget.student_name}</strong> ({reviewTarget.student_poraplan_id})
                </div>
                <div>
                  <span className="text-brand-muted">Submitted:</span>{' '}
                  <strong>
                    {reviewTarget.submitted_at
                      ? new Date(reviewTarget.submitted_at).toLocaleString()
                      : 'N/A'}
                  </strong>
                </div>
                <div>
                  <Badge
                    variant={reviewTarget.status === 'reviewed' ? 'teal' : reviewTarget.status === 'needs_revision' ? 'danger' : 'gold'}
                    size="sm"
                  >
                    STATUS: {reviewTarget.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Student Submission Display */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                  Submitted Work ({reviewTarget.submission_type.toUpperCase()})
                </label>

                {reviewTarget.submission_type === 'link' ? (
                  <div className="p-4 bg-white border-2 border-brand-dark space-y-2">
                    <div className="flex items-center gap-2 text-brand-teal font-mono text-xs">
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      <a
                        href={reviewTarget.link_url || reviewTarget.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-brand-navy break-all"
                      >
                        {reviewTarget.link_url || reviewTarget.content}
                      </a>
                    </div>
                    {reviewTarget.content !== reviewTarget.link_url && (
                      <p className="text-xs text-brand-muted font-sans mt-2">
                        {reviewTarget.content}
                      </p>
                    )}
                  </div>
                ) : reviewTarget.submission_type === 'file' ? (
                  <div className="p-4 bg-white border-2 border-brand-dark space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs text-brand-navy">
                      <Paperclip className="w-4 h-4 text-brand-teal flex-shrink-0" />
                      <strong>{reviewTarget.file_name || 'Attached File'}</strong>
                      {reviewTarget.file_size && (
                        <span className="text-brand-muted">
                          ({Math.round(reviewTarget.file_size / 1024)} KB)
                        </span>
                      )}
                    </div>
                    {reviewTarget.content && (
                      <p className="text-xs text-brand-dark font-sans whitespace-pre-wrap">
                        {reviewTarget.content}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-white border-2 border-brand-dark text-xs sm:text-sm font-sans whitespace-pre-wrap text-brand-dark leading-relaxed max-h-60 overflow-y-auto">
                    {reviewTarget.content}
                  </div>
                )}
              </div>

              {/* Review Evaluation Form */}
              <div className="border-t-2 border-brand-dark pt-4">
                <h4 className="font-heading font-black text-sm text-brand-navy uppercase mb-3 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-brand-teal" />
                  Assessment &amp; Feedback Form
                </h4>

                {reviewModalError && (
                  <div className="bg-red-50 border-2 border-red-500 p-2.5 text-red-700 text-xs mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{reviewModalError}</span>
                  </div>
                )}

                {reviewModalSuccess && (
                  <div className="bg-teal-50 border-2 border-brand-teal p-2.5 text-brand-dark text-xs mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-teal flex-shrink-0" />
                    <span>{reviewModalSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSaveReview} className="space-y-3">
                  <div>
                    <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                      Mentor Written Feedback *
                    </label>
                    <textarea
                      rows={4}
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                      placeholder="Identify mathematical derivation errors, explain missing intermediate steps, or praise sound reasoning..."
                      className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                        Score / Points (Max {reviewTarget.assignment_total_points || 100})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={reviewTarget.assignment_total_points || 1000}
                        step="0.5"
                        value={reviewScore}
                        onChange={(e) => setReviewScore(e.target.value)}
                        placeholder="e.g. 85"
                        className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                        Evaluation Status Decision
                      </label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value as SubmissionStatus)}
                        className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      >
                        <option value="reviewed">Reviewed &amp; Approved</option>
                        <option value="needs_revision">Needs Revision (Request Redo)</option>
                        <option value="under_review">Keep Under Review</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-dark/20">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReviewTarget(null)}
                    >
                      Close
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={isSubmittingReview}
                      className="flex items-center gap-1.5"
                    >
                      {isSubmittingReview ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Saving Evaluation...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Save Assessment &amp; Feedback
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
