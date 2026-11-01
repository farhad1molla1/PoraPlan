import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentAssignments,
  submitAssignment,
  type AssignmentWithMeta,
} from '../../lib/assignments';
import {
  validateAcademicFile,
  uploadAcademicFile,
  getAcademicFileSignedUrl,
  deleteAcademicFile,
} from '../../lib/storage';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile, SubmissionType } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { AttachmentViewerModal } from '../../components/common/AttachmentViewerModal';
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
  FileCheck,
  Eye,
  Download,
  Trash2,
  Image as ImageIcon,
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
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileObjectUrl, setSelectedFileObjectUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment preview viewer modal state
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    fileName: string;
    fileUrl: string | null;
    fileSize?: number | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    fileName: '',
    fileUrl: null,
    fileSize: null,
    loading: false,
    error: null,
  });

  const studentId = user?.id || '';

  // Clean up Object URL for selected file when changed or unmounted
  useEffect(() => {
    if (selectedFile && typeof window !== 'undefined' && typeof window.URL?.createObjectURL === 'function') {
      let url: string | null = null;
      try {
        url = URL.createObjectURL(selectedFile);
        setSelectedFileObjectUrl(url);
      } catch {
        // Fallback for headless environments
      }
      return () => {
        if (url) {
          try {
            URL.revokeObjectURL(url);
          } catch {
            // Ignore revocation errors
          }
        }
      };
    } else {
      setSelectedFileObjectUrl(null);
    }
  }, [selectedFile]);

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
    // If submission is already under review or reviewed, prevent editing
    const isLocked =
      assignment.submission &&
      (assignment.submission.status === 'under_review' || assignment.submission.status === 'reviewed');

    if (isLocked) {
      return;
    }

    setActiveAssignmentId(assignment.id);
    setFormError(null);
    setFormSuccess(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    if (assignment.submission) {
      setSubmissionType(assignment.submission.submission_type);
      setTextContent(assignment.submission.content || '');
      setLinkUrl(assignment.submission.link_url || '');
      setFileName(assignment.submission.file_name || '');
      setFileSize(assignment.submission.file_size || undefined);
      setExistingFilePath(assignment.submission.file_path || null);
    } else {
      setSubmissionType('text');
      setTextContent('');
      setLinkUrl('');
      setFileName('');
      setFileSize(undefined);
      setExistingFilePath(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate using the unified storage validator (checks size <= 10MB, MIME, extensions)
    const validation = validateAcademicFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid file selected.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
    setFileSize(file.size);
    setFormError(null);

    // Provide default notes if text content is empty
    if (!textContent.trim()) {
      const formattedSize = file.size < 1024 * 1024
        ? `${Math.round(file.size / 1024)} KB`
        : `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
      setTextContent(`Attached file: ${file.name} (${formattedSize})`);
    }
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const currentAssignment = assignments.find((a) => a.id === activeAssignmentId);
    if (currentAssignment?.submission?.file_name && currentAssignment.submission.submission_type === 'file') {
      // Revert to previously saved file metadata
      setFileName(currentAssignment.submission.file_name);
      setFileSize(currentAssignment.submission.file_size || undefined);
      setExistingFilePath(currentAssignment.submission.file_path || null);
    } else {
      setFileName('');
      setFileSize(undefined);
      setExistingFilePath(null);
    }
  };

  const handlePreviewSelectedFile = () => {
    if (!selectedFile) return;
    setViewerModal({
      isOpen: true,
      fileName: selectedFile.name,
      fileUrl: selectedFileObjectUrl,
      fileSize: selectedFile.size,
      loading: false,
      error: null,
    });
  };

  const handlePreviewExistingAttachment = async (sub: {
    file_name?: string | null;
    file_size?: number | null;
    file_path?: string | null;
  }) => {
    const name = sub.file_name || 'attachment';
    if (!sub.file_path) {
      setViewerModal({
        isOpen: true,
        fileName: name,
        fileUrl: null,
        fileSize: sub.file_size || null,
        loading: false,
        error:
          'Storage path was not recorded for this attachment. This may be an older submission created before private academic storage was configured.',
      });
      return;
    }

    setViewerModal({
      isOpen: true,
      fileName: name,
      fileUrl: null,
      fileSize: sub.file_size || null,
      loading: true,
      error: null,
    });

    const { signedUrl, error: urlErr } = await getAcademicFileSignedUrl(sub.file_path);
    if (urlErr || !signedUrl) {
      setViewerModal((prev) => ({
        ...prev,
        loading: false,
        error: urlErr?.message || 'Unable to generate secure preview link for this attachment.',
      }));
    } else {
      setViewerModal((prev) => ({
        ...prev,
        fileUrl: signedUrl,
        loading: false,
        error: null,
      }));
    }
  };

  const handleDownloadAttachment = async (sub: {
    file_name?: string | null;
    file_path?: string | null;
  }) => {
    const name = sub.file_name || 'download';
    if (!sub.file_path) {
      alert('Attachment path is not available for download.');
      return;
    }

    const { signedUrl, error: urlErr } = await getAcademicFileSignedUrl(sub.file_path);
    if (urlErr || !signedUrl) {
      alert(urlErr?.message || 'Failed to generate secure download link.');
      return;
    }

    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentId) return;

    const currentAssignment = assignments.find((a) => a.id === activeAssignmentId);
    if (!currentAssignment) return;

    // Guard: Under review or reviewed submissions cannot be modified
    if (
      currentAssignment.submission &&
      (currentAssignment.submission.status === 'under_review' ||
        currentAssignment.submission.status === 'reviewed')
    ) {
      setFormError('This submission is currently under mentor review or has already been graded. Modifications are locked.');
      return;
    }

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
      if (!selectedFile && !existingFilePath && !fileName) {
        setFormError('Please attach a document (PDF, PNG, JPG, WebP, or DOCX).');
        return;
      }
      if (!finalContent) {
        finalContent = selectedFile ? `Attached file: ${selectedFile.name}` : `Attached document: ${fileName}`;
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

    let resolvedFilePath: string | undefined = existingFilePath || undefined;
    let resolvedFileName: string | undefined = fileName || undefined;
    let resolvedFileSize: number | undefined = fileSize || undefined;
    let newUploadPath: string | null = null;

    // STEP 1 & 2: If student selected a new binary file, upload it first
    if (submissionType === 'file' && selectedFile) {
      const { path: uploadedPath, error: uploadErr } = await uploadAcademicFile({
        category: 'submissions',
        entityId: activeAssignmentId,
        studentId,
        file: selectedFile,
      });

      if (uploadErr || !uploadedPath) {
        setFormError(uploadErr?.message || 'Failed to upload attachment file. Please try again.');
        setSubmitting(false);
        return;
      }

      newUploadPath = uploadedPath;
      resolvedFilePath = uploadedPath;
      resolvedFileName = selectedFile.name;
      resolvedFileSize = selectedFile.size;
    }

    // STEP 3: Upsert submission record with metadata and file path
    const { submission, error: submitErr } = await submitAssignment({
      assignmentId: activeAssignmentId,
      studentId,
      submissionType,
      content: finalContent,
      linkUrl: submissionType === 'link' ? linkUrl.trim() : undefined,
      fileName: submissionType === 'file' ? resolvedFileName : undefined,
      fileSize: submissionType === 'file' ? resolvedFileSize : undefined,
      filePath: submissionType === 'file' ? resolvedFilePath : undefined,
    });

    if (submitErr) {
      // STEP 4: If database record creation fails, attempt rollback/cleanup of newly uploaded file!
      if (newUploadPath) {
        await deleteAcademicFile(newUploadPath).catch(() => {});
      }
      setSubmitting(false);
      setFormError(`Failed to save submission: ${submitErr.message}`);
      return;
    }

    // STEP 5: Successful submission.
    // If a previous file was replaced, clean up old file if safe and different
    if (
      newUploadPath &&
      currentAssignment.submission?.file_path &&
      currentAssignment.submission.file_path !== newUploadPath
    ) {
      deleteAcademicFile(currentAssignment.submission.file_path).catch(() => {});
    }

    setSubmitting(false);
    setSelectedFile(null);
    setFormSuccess('Your assignment work and attachment have been submitted successfully!');

    // Update local assignment submission state
    setAssignments((prev) =>
      prev.map((a) => (a.id === activeAssignmentId ? { ...a, submission } : a))
    );
  };

  // Filter assignments
  const filteredAssignments = assignments.filter((a) => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'pending') return !a.submission;
    if (statusFilter === 'submitted') return a.submission && a.submission.status === 'submitted';
    if (statusFilter === 'reviewed')
      return a.submission && (a.submission.status === 'reviewed' || a.submission.status === 'under_review');
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
          </div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-brand-navy">
            Assignments
          </h1>
          <p className="text-sm text-brand-muted mt-1 max-w-2xl">
            Practice tasks and problem sets assigned by your mentor to test your understanding.
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
            const submissionStatus = assignment.submission?.status;
            const isLocked =
              isClosed ||
              (hasSubmission &&
                (submissionStatus === 'under_review' || submissionStatus === 'reviewed'));

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
                    <div className="space-y-3 mb-4">
                      {/* Revision Requested Notice */}
                      {assignment.submission?.status === 'needs_revision' && (
                        <div className="bg-red-50 border-2 border-red-500 p-3 text-red-800 text-xs flex items-start gap-2 shadow-brutal-xs">
                          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <strong className="block font-bold">Revision Requested by Mentor</strong>
                            <span>Please review the mentor corrections below and update your derivation or solution attachment.</span>
                          </div>
                        </div>
                      )}

                      {/* Student's Submitted Content Box */}
                      <div className="p-4 bg-teal-50 border-2 border-brand-teal text-brand-dark">
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
                          <div className="space-y-3 mt-1">
                            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border-2 border-brand-dark">
                              <div className="flex items-center gap-2 min-w-0">
                                <Paperclip className="w-4 h-4 text-brand-teal flex-shrink-0" />
                                <div className="min-w-0">
                                  <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                    {assignment.submission.file_name || 'Attached Document'}
                                  </span>
                                  {assignment.submission.file_size && (
                                    <span className="font-mono text-[11px] text-brand-muted">
                                      {assignment.submission.file_size < 1024 * 1024
                                        ? `${Math.round(assignment.submission.file_size / 1024)} KB`
                                        : `${(assignment.submission.file_size / (1024 * 1024)).toFixed(2)} MB`}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handlePreviewExistingAttachment(assignment.submission!)}
                                  className="flex items-center gap-1.5"
                                >
                                  <Eye className="w-3.5 h-3.5 text-brand-navy" />
                                  Preview
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleDownloadAttachment(assignment.submission!)}
                                  className="flex items-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </Button>
                              </div>
                            </div>

                            {assignment.submission.content && (
                              <p className="text-xs text-brand-dark font-sans whitespace-pre-wrap">
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

                      {/* Mentor Feedback & Score Display */}
                      {assignment.submission?.feedback ? (
                        <div className="p-4 bg-brand-paper-tint border-3 border-brand-navy space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-navy/20 pb-2">
                            <span className="font-mono text-xs font-bold text-brand-navy uppercase flex items-center gap-1.5">
                              <FileCheck className="w-4 h-4 text-brand-teal" />
                              Mentor Evaluation &amp; Corrections
                            </span>
                            <div className="flex items-center gap-2">
                              {assignment.submission.score !== undefined && assignment.submission.score !== null && (
                                <Badge variant="teal" size="sm">
                                  SCORE: {assignment.submission.score} / {assignment.total_points || 100} PTS
                                </Badge>
                              )}
                              {assignment.submission.reviewed_at && (
                                <span className="font-mono text-[11px] text-brand-muted">
                                  Reviewed: {new Date(assignment.submission.reviewed_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm font-sans text-brand-dark leading-relaxed whitespace-pre-wrap">
                            {assignment.submission.feedback}
                          </p>
                        </div>
                      ) : (
                        <div className="p-3 bg-brand-paper border border-brand-dark/30 font-mono text-xs text-brand-muted flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-brand-gold" />
                          <span>Status: <strong>Awaiting Mentor Review</strong> — your submission is in the mentor queue.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-brand-dark/20">
                    <div className="text-[11px] font-mono text-brand-muted">
                      Created: {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : 'N/A'}
                    </div>

                    <div>
                      {isLocked ? (
                        <span className="font-mono text-xs font-bold text-brand-muted flex items-center gap-1.5">
                          {isClosed ? (
                            'Assignment Closed'
                          ) : submissionStatus === 'under_review' ? (
                            <span className="text-brand-gold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Under Mentor Review (Locked)
                            </span>
                          ) : (
                            <span className="text-brand-navy flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal" />
                              Evaluated &amp; Graded
                            </span>
                          )}
                        </span>
                      ) : (
                        <Button
                          variant={hasSubmission ? 'outline' : 'primary'}
                          size="sm"
                          onClick={() => handleOpenSubmission(assignment)}
                          className="flex items-center gap-1.5"
                        >
                          {hasSubmission ? (
                            <>
                              <Edit3 className="w-3.5 h-3.5" />
                              {submissionStatus === 'needs_revision'
                                ? 'Resubmit Revisions'
                                : 'Edit / Update Submission'}
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
                </div>

                {/* Inline Submission Form Accordion */}
                {isSelected && !isLocked && (
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
                        <div className="bg-red-50 border-2 border-red-500 p-3 text-red-700 text-xs mb-3 flex items-center gap-2 shadow-brutal-xs">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{formError}</span>
                        </div>
                      )}

                      {formSuccess && (
                        <div className="bg-teal-50 border-2 border-brand-teal p-3 text-brand-dark text-xs mb-3 flex items-center gap-2 shadow-brutal-xs">
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
                          <div className="space-y-4">
                            {/* File Upload Box */}
                            <div className="bg-white border-2 border-brand-dark p-4 space-y-3 shadow-brutal-xs">
                              <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy">
                                Attach Solution Document (PDF, PNG, JPG, WebP, DOCX — Max 10MB) *
                              </label>

                              {/* Case 1: A new file is currently selected */}
                              {selectedFile ? (
                                <div className="space-y-3">
                                  <div className="p-3 bg-teal-50 border-2 border-brand-teal flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Paperclip className="w-4 h-4 text-brand-teal flex-shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                          {selectedFile.name}
                                        </span>
                                        <span className="font-mono text-[11px] text-brand-muted">
                                          {selectedFile.size < 1024 * 1024
                                            ? `${Math.round(selectedFile.size / 1024)} KB`
                                            : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {/* Preview button for supported images & PDFs */}
                                      {['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(
                                        selectedFile.name.split('.').pop()?.toLowerCase() || ''
                                      ) && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={handlePreviewSelectedFile}
                                          className="flex items-center gap-1"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Preview
                                        </Button>
                                      )}

                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveSelectedFile}
                                        className="text-red-600 hover:text-red-700 flex items-center gap-1"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Remove
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Small Image Thumbnail Preview */}
                                  {selectedFileObjectUrl &&
                                    ['png', 'jpg', 'jpeg', 'webp'].includes(
                                      selectedFile.name.split('.').pop()?.toLowerCase() || ''
                                    ) && (
                                      <div className="p-2 bg-brand-bg border border-brand-dark flex items-center gap-3">
                                        <img
                                          src={selectedFileObjectUrl}
                                          alt="Preview thumbnail"
                                          className="w-16 h-16 object-cover border border-brand-dark shadow-brutal-xs flex-shrink-0"
                                        />
                                        <div className="text-xs font-mono text-brand-muted">
                                          <span className="font-bold text-brand-navy block flex items-center gap-1">
                                            <ImageIcon className="w-3.5 h-3.5 text-brand-teal" />
                                            Image preview ready
                                          </span>
                                          Click "Preview" above to inspect in full size before submitting.
                                        </div>
                                      </div>
                                    )}
                                </div>
                              ) : existingFilePath || fileName ? (
                                /* Case 2: Editing existing submission without choosing new file yet */
                                <div className="space-y-2">
                                  <div className="p-3 bg-brand-paper border-2 border-brand-dark flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Paperclip className="w-4 h-4 text-brand-navy flex-shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                          Currently Attached: {fileName}
                                        </span>
                                        {fileSize && (
                                          <span className="font-mono text-[11px] text-brand-muted">
                                            {fileSize < 1024 * 1024
                                              ? `${Math.round(fileSize / 1024)} KB`
                                              : `${(fileSize / (1024 * 1024)).toFixed(2)} MB`}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                      {existingFilePath && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            handlePreviewExistingAttachment({
                                              file_name: fileName,
                                              file_size: fileSize,
                                              file_path: existingFilePath,
                                            })
                                          }
                                          className="flex items-center gap-1"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                          Preview
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => fileInputRef.current?.click()}
                                      >
                                        Replace File
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-[11px] font-mono text-brand-muted">
                                    Your previously submitted file is retained unless you choose a new file to replace it.
                                  </p>
                                </div>
                              ) : (
                                /* Case 3: Initial file selection */
                                <div className="space-y-2">
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileSelect}
                                    accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                                    className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono focus:outline-none"
                                    required={!existingFilePath && !fileName}
                                  />
                                  <p className="text-[11px] font-mono text-brand-muted">
                                    Supported formats: PDF documents, PNG/JPG/WebP scan images, and DOCX files up to 10MB.
                                  </p>
                                </div>
                              )}

                              {/* Hidden file input for Replace action */}
                              <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                                className="hidden"
                              />
                            </div>

                            {/* Solution Notes */}
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
                            onClick={() => {
                              setActiveAssignmentId(null);
                              setSelectedFile(null);
                            }}
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
                                {submissionType === 'file' && selectedFile
                                  ? 'Uploading File & Saving...'
                                  : 'Saving Submission...'}
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

      {/* Attachment Preview Viewer Modal */}
      <AttachmentViewerModal
        isOpen={viewerModal.isOpen}
        onClose={() => setViewerModal((prev) => ({ ...prev, isOpen: false }))}
        fileName={viewerModal.fileName}
        fileUrl={viewerModal.fileUrl}
        fileSize={viewerModal.fileSize}
        loading={viewerModal.loading}
        error={viewerModal.error}
      />
    </div>
  );
};
