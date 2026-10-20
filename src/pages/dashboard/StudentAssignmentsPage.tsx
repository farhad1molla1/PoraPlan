import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentAssignments,
  submitAssignment,
  type AssignmentWithMeta,
} from '../../lib/assignments';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile, SubmissionType } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  FileText,
  Calendar,
  BookOpen,
  Compass,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  Sparkles,
  ArrowRight,
  Send,
  ExternalLink,
  CheckCircle2,
  Clock,
  Paperclip,
  Edit3,
} from 'lucide-react';

export const StudentAssignmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'submitted' | 'reviewed'>('all');

  // Active submission form state
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [submissionType, setSubmissionType] = useState<SubmissionType>('text');
  const [textContent, setTextContent] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const studentId = user?.id || '';

  const loadData = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getStudentAssignments(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([assignRes, mentorsRes]) => {
        if (assignRes.error) {
          setError(assignRes.error.message);
        } else {
          setAssignments(assignRes.assignments);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load assignments.';
        setError(msg);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const handleOpenSubmission = (assignment: AssignmentWithMeta) => {
    setActiveAssignmentId(assignment.id);
    setFormError(null);
    setFormSuccess(null);

    if (assignment.submission) {
      setSubmissionType(assignment.submission.submission_type);
      setTextContent(assignment.submission.content || '');
      setLinkUrl(assignment.submission.link_url || '');
      setFileName(assignment.submission.file_name || '');
      setFileSize(assignment.submission.file_size || undefined);
    } else {
      setSubmissionType('text');
      setTextContent('');
      setLinkUrl('');
      setFileName('');
      setFileSize(undefined);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setFormError('File size exceeds the 10MB limit.');
        return;
      }
      setFileName(file.name);
      setFileSize(file.size);
      if (!textContent.trim()) {
        setTextContent(`Attached file: ${file.name} (${Math.round(file.size / 1024)} KB)`);
      }
      setFormError(null);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentId) return;

    let finalContent = textContent.trim();
    if (submissionType === 'link') {
      const cleanUrl = linkUrl.trim();
      if (!cleanUrl) {
        setFormError('Please enter an external link URL.');
        return;
      }
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        setFormError('External link must begin with http:// or https://');
        return;
      }
      if (!finalContent) {
        finalContent = cleanUrl;
      }
    } else if (submissionType === 'file') {
      if (!fileName && !finalContent) {
        setFormError('Please attach a document or provide file delivery instructions.');
        return;
      }
      if (!finalContent) {
        finalContent = `Attached document: ${fileName}`;
      }
    } else {
      if (!finalContent) {
        setFormError('Submission text cannot be empty.');
        return;
      }
    }

    setSubmitting(true);
    setFormError(null);
    setFormSuccess(null);

    const { submission, error: submitErr } = await submitAssignment({
      assignmentId: activeAssignmentId,
      studentId,
      submissionType,
      content: finalContent,
      linkUrl: submissionType === 'link' ? linkUrl.trim() : undefined,
      fileName: fileName || undefined,
      fileSize: fileSize || undefined,
    });

    setSubmitting(false);

    if (submitErr) {
      setFormError(submitErr.message);
    } else {
      setFormSuccess('Your assignment work has been submitted successfully!');
      // Update local assignment submission state
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === activeAssignmentId ? { ...a, submission } : a
        )
      );
    }
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return !a.submission;
    if (statusFilter === 'submitted') return a.submission && a.submission.status === 'submitted';
    if (statusFilter === 'reviewed') return a.submission && (a.submission.status === 'reviewed' || a.submission.status === 'under_review');
    return true;
  });

  const totalCount = assignments.length;
  const pendingCount = assignments.filter((a) => !a.submission).length;
  const submittedCount = assignments.filter((a) => a.submission && a.submission.status === 'submitted').length;
  const reviewedCount = assignments.filter((a) => a.submission && a.submission.status === 'reviewed').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="bg-brand-bg border-4 border-brand-dark p-6 shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-brand-teal uppercase tracking-wider">
              Practice &amp; Submissions
            </span>
            <Badge variant="teal" size="sm">
              PHASE 3: PRACTICE
            </Badge>
          </div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-brand-navy">
            Assignments &amp; Practice Sets
          </h1>
          <p className="text-sm text-brand-muted mt-1 max-w-2xl">
            Complete and submit assignments assigned by your mentor. Submit your work as written derivation text, external cloud document link, or file attachment.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5"
            aria-label="Refresh assignments"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Link to="/student/tasks">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5">
              Study Tasks
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
            <FileText className="w-4 h-4 text-brand-navy" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-navy">{totalCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">Assigned sets</div>
        </div>

        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Pending</span>
            <Clock className="w-4 h-4 text-brand-gold" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-gold">{pendingCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">To be submitted</div>
        </div>

        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Submitted</span>
            <Send className="w-4 h-4 text-brand-teal" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-teal">{submittedCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">Awaiting review</div>
        </div>

        <div className="bg-white border-3 border-brand-dark p-4 shadow-brutal-sm">
          <div className="flex items-center justify-between text-brand-muted mb-1">
            <span className="font-mono text-xs uppercase font-bold tracking-wider">Reviewed</span>
            <CheckCircle2 className="w-4 h-4 text-brand-navy" />
          </div>
          <div className="font-heading font-black text-2xl text-brand-navy">{reviewedCount}</div>
          <div className="text-[11px] text-brand-muted mt-0.5">Evaluated work</div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-3 border-red-500 p-4 text-red-700 flex items-start gap-3 shadow-brutal-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Failed to Load Assignments</h4>
            <p className="text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setStatusFilter('all')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              statusFilter === 'all'
                ? 'bg-brand-navy text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            All ({totalCount})
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              statusFilter === 'pending'
                ? 'bg-brand-gold text-brand-dark shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            To Submit ({pendingCount})
          </button>
          <button
            onClick={() => setStatusFilter('submitted')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              statusFilter === 'submitted'
                ? 'bg-brand-teal text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            Submitted ({submittedCount})
          </button>
          <button
            onClick={() => setStatusFilter('reviewed')}
            className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
              statusFilter === 'reviewed'
                ? 'bg-brand-navy text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                : 'bg-white text-brand-dark hover:bg-brand-paper'
            }`}
          >
            Reviewed ({reviewedCount})
          </button>
        </div>

        {mentors.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-brand-muted font-mono">
            <Users className="w-3.5 h-3.5 text-brand-teal" />
            <span>Assigned Mentor: <strong>{mentors[0].full_name}</strong></span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white border-3 border-brand-dark p-12 text-center shadow-brutal">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal mb-3" />
          <p className="font-mono text-sm text-brand-muted font-bold uppercase tracking-wider">
            Loading assignment roster...
          </p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white border-4 border-brand-dark p-8 md:p-12 text-center shadow-brutal">
          <div className="w-16 h-16 bg-brand-paper-tint border-3 border-brand-dark rounded-none flex items-center justify-center mx-auto mb-4 shadow-brutal-sm">
            <FileText className="w-8 h-8 text-brand-muted" />
          </div>
          <h3 className="font-heading font-black text-xl text-brand-navy mb-2">
            {statusFilter === 'all'
              ? 'No Assignments Distributed Yet'
              : `No Assignments in "${statusFilter.toUpperCase()}" Status`}
          </h3>
          <p className="text-sm text-brand-muted max-w-md mx-auto mb-6">
            {mentors.length > 0
              ? `Your dedicated mentor ${mentors[0].full_name} has not distributed any practice sets matching this filter. New assignments will appear here with instructions and due dates.`
              : 'You do not have an assigned mentor yet. When a mentor is assigned by administration, your practice assignments will appear here.'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/student/tasks">
              <Button variant="primary" size="sm" className="flex items-center gap-1.5">
                Go to Today's Tasks
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const hasSubmission = !!assignment.submission;
            const isSelected = activeAssignmentId === assignment.id;
            const isClosed = assignment.status === 'closed' || assignment.status === 'archived';

            return (
              <div
                key={assignment.id}
                className={`bg-white border-3 border-brand-dark transition-all ${
                  isSelected ? 'ring-2 ring-brand-navy shadow-brutal' : 'shadow-brutal-sm hover:shadow-brutal'
                }`}
              >
                <div className="p-5 sm:p-6">
                  {/* Top Badges & Meta */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {assignment.subject_name && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-paper-tint border border-brand-dark px-2 py-0.5 text-brand-navy flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-brand-teal" />
                          {assignment.subject_name}
                        </span>
                      )}

                      {assignment.plan_title && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-bg border border-brand-dark px-2 py-0.5 text-brand-muted flex items-center gap-1">
                          <Compass className="w-3 h-3 text-brand-muted" />
                          {assignment.plan_title}
                        </span>
                      )}

                      <Badge
                        variant={hasSubmission ? (assignment.submission?.status === 'reviewed' ? 'teal' : 'navy') : 'gold'}
                        size="sm"
                      >
                        {hasSubmission
                          ? `SUBMISSION: ${assignment.submission?.status.replace('_', ' ').toUpperCase()}`
                          : 'PENDING SUBMISSION'}
                      </Badge>

                      {isClosed && (
                        <Badge variant="muted" size="sm">
                          CLOSED
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-brand-muted font-mono">
                      {assignment.total_points && (
                        <span className="font-bold text-brand-navy">
                          {assignment.total_points} PTS
                        </span>
                      )}

                      {assignment.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Instructions */}
                  <h3 className="font-heading font-bold text-lg text-brand-navy mb-2">
                    {assignment.title}
                  </h3>

                  {assignment.instructions && (
                    <div className="bg-brand-paper p-3.5 border border-brand-dark text-xs sm:text-sm text-brand-dark font-sans leading-relaxed whitespace-pre-wrap mb-4">
                      {assignment.instructions}
                    </div>
                  )}

                  {/* Existing Submission Display */}
                  {hasSubmission && (
                    <div className="mt-3 p-4 bg-teal-50 border-2 border-brand-teal text-brand-dark mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-brand-teal uppercase flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                          Your Submission ({assignment.submission?.submission_type.toUpperCase()})
                        </span>
                        <span className="font-mono text-[11px] text-brand-muted">
                          Turned in:{' '}
                          {assignment.submission?.submitted_at
                            ? new Date(assignment.submission.submitted_at).toLocaleString()
                            : 'Submitted'}
                        </span>
                      </div>

                      {assignment.submission?.submission_type === 'link' ? (
                        <div className="flex items-center gap-2 mt-1">
                          <ExternalLink className="w-4 h-4 text-brand-teal flex-shrink-0" />
                          <a
                            href={assignment.submission.link_url || assignment.submission.content}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm text-brand-teal font-mono underline break-all hover:text-brand-navy"
                          >
                            {assignment.submission.link_url || assignment.submission.content}
                          </a>
                        </div>
                      ) : assignment.submission?.submission_type === 'file' ? (
                        <div className="text-xs font-mono text-brand-navy">
                          <div className="flex items-center gap-1.5">
                            <Paperclip className="w-4 h-4 text-brand-teal" />
                            <strong>{assignment.submission.file_name || 'Attached Document'}</strong>
                            {assignment.submission.file_size && (
                              <span className="text-brand-muted">
                                ({Math.round(assignment.submission.file_size / 1024)} KB)
                              </span>
                            )}
                          </div>
                          {assignment.submission.content && (
                            <p className="text-xs text-brand-muted mt-1 font-sans">
                              {assignment.submission.content}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs sm:text-sm font-sans whitespace-pre-wrap text-brand-dark">
                          {assignment.submission?.content}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-brand-dark/20">
                    <div className="text-[11px] font-mono text-brand-muted">
                      Created: {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : 'N/A'}
                    </div>

                    {!isClosed && (
                      <Button
                        variant={hasSubmission ? 'outline' : 'primary'}
                        size="sm"
                        onClick={() => handleOpenSubmission(assignment)}
                        className="flex items-center gap-1.5"
                      >
                        {hasSubmission ? (
                          <>
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit / Resubmit Work
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" />
                            Submit Assignment
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Inline Submission Form Accordion */}
                {isSelected && !isClosed && (
                  <div className="border-t-3 border-brand-dark bg-brand-bg p-5 sm:p-6">
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-heading font-black text-base text-brand-navy flex items-center gap-2">
                          <Send className="w-4 h-4 text-brand-teal" />
                          {hasSubmission ? 'Update Your Submission' : 'Submit Assignment Work'}
                        </h4>
                        <button
                          onClick={() => setActiveAssignmentId(null)}
                          className="font-mono text-xs text-brand-muted hover:text-brand-dark font-bold"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Submission Type Switcher */}
                      <div className="flex items-center gap-2 mb-4 border-b-2 border-brand-dark pb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionType('text');
                            setFormError(null);
                          }}
                          className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark flex items-center gap-1.5 transition-all ${
                            submissionType === 'text'
                              ? 'bg-brand-navy text-white shadow-brutal-xs'
                              : 'bg-white text-brand-dark hover:bg-brand-paper'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Written Text
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionType('link');
                            setFormError(null);
                          }}
                          className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark flex items-center gap-1.5 transition-all ${
                            submissionType === 'link'
                              ? 'bg-brand-navy text-white shadow-brutal-xs'
                              : 'bg-white text-brand-dark hover:bg-brand-paper'
                          }`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Cloud Link (Drive/GitHub)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSubmissionType('file');
                            setFormError(null);
                          }}
                          className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark flex items-center gap-1.5 transition-all ${
                            submissionType === 'file'
                              ? 'bg-brand-navy text-white shadow-brutal-xs'
                              : 'bg-white text-brand-dark hover:bg-brand-paper'
                          }`}
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          Document / Scan
                        </button>
                      </div>

                      {formError && (
                        <div className="bg-red-50 border-2 border-red-500 p-3 text-red-700 text-xs mb-3 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {formSuccess && (
                        <div className="bg-teal-50 border-2 border-brand-teal p-3 text-brand-dark text-xs mb-3 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-brand-teal flex-shrink-0" />
                          <span>{formSuccess}</span>
                        </div>
                      )}

                      <form onSubmit={handleSubmitWork} className="space-y-4">
                        {submissionType === 'text' && (
                          <div>
                            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                              Solution Steps &amp; Theoretical Reasoning *
                            </label>
                            <textarea
                              rows={5}
                              value={textContent}
                              onChange={(e) => setTextContent(e.target.value)}
                              placeholder="Write out your mathematical derivation, proof steps, or chapter review answers here..."
                              className="w-full bg-white border-2 border-brand-dark p-3 text-xs sm:text-sm text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                              required
                            />
                            <p className="text-[11px] font-mono text-brand-muted mt-1">
                              Be explicit with formulas, coordinate choices, and intermediate steps.
                            </p>
                          </div>
                        )}

                        {submissionType === 'link' && (
                          <div className="space-y-3">
                            <div>
                              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                                External Cloud Document URL *
                              </label>
                              <input
                                type="url"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="https://drive.google.com/... or https://github.com/..."
                                className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs sm:text-sm text-brand-dark font-mono focus:outline-none focus:ring-2 focus:ring-brand-teal"
                                required
                              />
                              <p className="text-[11px] font-mono text-brand-muted mt-1">
                                Ensure your link permissions allow viewing by your mentor.
                              </p>
                            </div>
                            <div>
                              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                                Notes for Mentor (Optional)
                              </label>
                              <textarea
                                rows={2}
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                placeholder="Any specific questions or areas where you encountered difficulty..."
                                className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                              />
                            </div>
                          </div>
                        )}

                        {submissionType === 'file' && (
                          <div className="space-y-3">
                            <div>
                              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                                Select File (PDF, PNG, JPG, ZIP — Max 10MB)
                              </label>
                              <input
                                type="file"
                                onChange={handleFileSelect}
                                accept=".pdf,.png,.jpg,.jpeg,.zip,.docx"
                                className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono focus:outline-none"
                              />
                              {fileName && (
                                <p className="text-xs font-mono text-brand-teal font-bold mt-1">
                                  Selected: {fileName} ({fileSize ? Math.round(fileSize / 1024) : 0} KB)
                                </p>
                              )}
                            </div>
                            <div>
                              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                                Accompanying Solution Notes *
                              </label>
                              <textarea
                                rows={3}
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                placeholder="Summary of attached exercise solutions, questions, or derivation notes..."
                                className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                                required
                              />
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setActiveAssignmentId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            size="sm"
                            disabled={submitting}
                            className="flex items-center gap-1.5"
                          >
                            {submitting ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving Submission...
                              </>
                            ) : (
                              <>
                                <Send className="w-3.5 h-3.5" />
                                {hasSubmission ? 'Update Work' : 'Submit for Review'}
                              </>
                            )}
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Product Education Note */}
      <div className="bg-brand-paper-tint border-3 border-brand-dark p-5 shadow-brutal-sm">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-brand-teal flex-shrink-0 mt-0.5" />
          <div className="text-xs leading-relaxed text-brand-dark">
            <strong className="font-heading font-black text-sm text-brand-navy block mb-1">
              PoraPlan Academic Workflow: Tasks vs. Practice Assignments
            </strong>
            <p>
              In PoraPlan, <strong>Tasks</strong> are daily disciplined study habits and reading sessions to complete. In contrast, <strong>Assignments</strong> require you to demonstrate problem-solving competency by submitting numerical derivation work, code, or handwritten scans for your mentor's detailed review.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
