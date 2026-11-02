import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentResources,
  type ResourceWithMeta,
} from '../../lib/resources';
import { getStudentSubjects } from '../../lib/subjects';
import {
  getStudentTasks,
  setTaskStatus,
  getStudentTasksCount,
  type TaskWithMeta,
  type StudentTaskFilters,
} from '../../lib/tasks';
import {
  getStudentAssignments,
  submitAssignment,
  getStudentAssignmentsCount,
  type AssignmentWithMeta,
} from '../../lib/assignments';
import {
  getStudentEvaluations,
  getStudentEvaluationsCount,
  type EvaluationWithMeta,
} from '../../lib/evaluations';
import {
  validateAcademicFile,
  uploadAcademicFile,
  getAcademicFileSignedUrl,
  deleteAcademicFile,
} from '../../lib/storage';
import { AttachmentViewerModal } from '../../components/common/AttachmentViewerModal';
import {
  parseLibraryTab,
  formatLocalDate,
  computeLibraryDateRange,
  type AcademicLibraryTab,
  type LibraryDatePreset,
} from '../../lib/library';
import type {
  Subject,
  TaskStatus,
  SubmissionType,
  EvaluationFormat,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  Search,
  ExternalLink,
  FileText,
  FileCode,
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  Check,
  X,
  ListTodo,
  ArrowRight,
  Calendar,
  Clock,
  Layers,
  Paperclip,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  Info,
  CheckCircle,
  Send,
  FileCheck,
  FileUp,
  Award,
  Sparkles,
} from 'lucide-react';

type DatePreset = LibraryDatePreset;

export const StudentLibraryPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  // Tab State synchronized with URL query parameter (?tab=resources|tasks|assignments)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: AcademicLibraryTab = parseLibraryTab(searchParams.get('tab'));

  // Tab Item Counts (PL-AUD-003: Accurate header counts with background prefetching)
  const [tabCounts, setTabCounts] = useState<{
    resources: number | null;
    tasks: number | null;
    assignments: number | null;
    evaluations: number | null;
  }>({
    resources: null,
    tasks: null,
    assignments: null,
    evaluations: null,
  });

  const handleTabChange = (tab: AcademicLibraryTab) => {
    if (tab === activeTab) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === 'resources') {
          next.delete('tab'); // Default tab leaves clean URL
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: false }
    );
  };

  // Shared Subjects
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // ---------------------------------------------------------------------------
  // TAB 1: STUDY RESOURCES STATE
  // ---------------------------------------------------------------------------
  const [resources, setResources] = useState<ResourceWithMeta[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [resourceSearch, setResourceSearch] = useState('');
  const [resourceSubjectFilter, setResourceSubjectFilter] = useState('all');
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>('all');
  const [activeResource, setActiveResource] = useState<ResourceWithMeta | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // TAB 2: TASKS & STUDY HISTORY STATE
  // ---------------------------------------------------------------------------
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Task Filter Controls
  const [taskSearch, setTaskSearch] = useState('');
  const [taskSubjectFilter, setTaskSubjectFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'>('all');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [selectedSpecificDate, setSelectedSpecificDate] = useState<string>(
    () => formatLocalDate(new Date())
  );
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // ---------------------------------------------------------------------------
  // TAB 4: EVALUATIONS & CHECKPOINTS STATE (Milestone 12)
  // ---------------------------------------------------------------------------
  const [evaluations, setEvaluations] = useState<EvaluationWithMeta[]>([]);
  const [evaluationsLoading, setEvaluationsLoading] = useState(false);
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null);
  const [evaluationSearch, setEvaluationSearch] = useState('');
  const [evaluationSubjectFilter, setEvaluationSubjectFilter] = useState('all');
  const [evaluationStatusFilter, setEvaluationStatusFilter] = useState<'all' | 'scheduled' | 'completed' | 'cancelled'>('all');
  const [evaluationFormatFilter, setEvaluationFormatFilter] = useState<'all' | EvaluationFormat>('all');
  const [evaluationDatePreset, setEvaluationDatePreset] = useState<LibraryDatePreset>('all');
  const [evaluationSpecificDate, _setEvaluationSpecificDate] = useState('');
  const [evaluationCustomStartDate, setEvaluationCustomStartDate] = useState('');
  const [evaluationCustomEndDate, setEvaluationCustomEndDate] = useState('');

  // ---------------------------------------------------------------------------
  // TAB 3: ASSIGNMENTS & SUBMISSIONS STATE
  // ---------------------------------------------------------------------------
  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);

  // Assignment Filters
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentSubjectFilter, setAssignmentSubjectFilter] = useState('all');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<
    'all' | 'pending' | 'submitted' | 'under_review' | 'reviewed' | 'needs_revision'
  >('all');
  const [assignmentDateFilter, setAssignmentDateFilter] = useState<'all' | 'upcoming' | 'past_due'>('all');

  // Active Assignment Submission Form State
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

  // Unified Attachment Viewer Modal State (Shared for Tasks & Submissions)
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    fileName: string;
    filePath: string | null;
    fileUrl: string | null;
    fileSize?: number | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    fileName: '',
    filePath: null,
    fileUrl: null,
    fileSize: null,
    loading: false,
    error: null,
  });

  // Clean up Object URL for selected assignment file upload
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
            // ignore
          }
        }
      };
    } else {
      setSelectedFileObjectUrl(null);
    }
  }, [selectedFile]);

  // Load Subjects once
  useEffect(() => {
    let mounted = true;
    if (studentId) {
      getStudentSubjects(studentId).then((res) => {
        if (mounted && res.subjects) {
          setSubjects(res.subjects);
        }
      });
    }
    return () => {
      mounted = false;
    };
  }, [studentId]);

  // ---------------------------------------------------------------------------
  // LOAD TAB 1: RESOURCES DATA
  // ---------------------------------------------------------------------------
  const loadResources = useCallback(() => {
    if (!studentId) return;
    setResourcesLoading(true);
    setResourcesError(null);
    getStudentResources(studentId)
      .then((res) => {
        if (res.error) {
          setResourcesError(res.error.message);
        } else {
          setResources(res.resources);
          setTabCounts((prev) => ({ ...prev, resources: res.resources.length }));
        }
        setResourcesLoading(false);
      })
      .catch((err: unknown) => {
        setResourcesError(err instanceof Error ? err.message : 'Failed to load study resources.');
        setResourcesLoading(false);
      });
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'resources') {
      loadResources();
    }
  }, [activeTab, loadResources]);

  // ---------------------------------------------------------------------------
  // LOAD TAB 2: TASKS & STUDY HISTORY DATA
  // ---------------------------------------------------------------------------
  const computeDateRange = useCallback((): { startDate?: string; endDate?: string } => {
    return computeLibraryDateRange(datePreset, {
      selectedSpecificDate,
      customStartDate,
      customEndDate,
    });
  }, [datePreset, selectedSpecificDate, customStartDate, customEndDate]);

  const loadTasks = useCallback(() => {
    if (!studentId) return;

    setTasksLoading(true);
    setTasksError(null);

    const { startDate, endDate } = computeDateRange();

    const queryFilters: StudentTaskFilters = {
      startDate,
      endDate,
      subjectId: taskSubjectFilter !== 'all' ? taskSubjectFilter : undefined,
    };

    if (taskStatusFilter !== 'all' && taskStatusFilter !== 'overdue') {
      queryFilters.status = taskStatusFilter as TaskStatus;
    }

    getStudentTasks(studentId, queryFilters)
      .then((res) => {
        if (res.error) {
          setTasksError(res.error.message);
        } else {
          setTasks(res.tasks);
          if (datePreset === 'all' && taskSubjectFilter === 'all' && taskStatusFilter === 'all') {
            setTabCounts((prev) => ({ ...prev, tasks: res.tasks.length }));
          }
        }
        setTasksLoading(false);
      })
      .catch((err: unknown) => {
        setTasksError(err instanceof Error ? err.message : 'Failed to load task history.');
        setTasksLoading(false);
      });
  }, [studentId, computeDateRange, taskSubjectFilter, taskStatusFilter, datePreset]);

  useEffect(() => {
    if (activeTab === 'tasks' && studentId) {
      loadTasks();
    }
  }, [activeTab, studentId, loadTasks]);

  // Handle Task Completion Status Toggle
  const handleToggleTaskStatus = async (task: TaskWithMeta) => {
    setUpdatingTaskId(task.id);
    const newStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    const { task: updated, error: err } = await setTaskStatus(task.id, newStatus);
    setUpdatingTaskId(null);

    if (err) {
      alert(`Failed to update task status: ${err.message}`);
    } else if (updated) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, ...updated } : t))
      );
    }
  };

  // ---------------------------------------------------------------------------
  // LOAD TAB 3: ASSIGNMENTS & SUBMISSIONS DATA
  // ---------------------------------------------------------------------------
  const loadAssignments = useCallback(() => {
    if (!studentId) return;
    setAssignmentsLoading(true);
    setAssignmentsError(null);
    getStudentAssignments(studentId)
      .then((res) => {
        if (res.error) {
          setAssignmentsError(res.error.message);
        } else {
          setAssignments(res.assignments);
          setTabCounts((prev) => ({ ...prev, assignments: res.assignments.length }));
        }
        setAssignmentsLoading(false);
      })
      .catch((err: unknown) => {
        setAssignmentsError(err instanceof Error ? err.message : 'Failed to load assignments.');
        setAssignmentsLoading(false);
      });
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'assignments' && studentId) {
      loadAssignments();
    }
  }, [activeTab, studentId, loadAssignments]);

  const loadEvaluations = useCallback(() => {
    if (!studentId) return;
    setEvaluationsLoading(true);
    setEvaluationsError(null);
    getStudentEvaluations(studentId)
      .then((res) => {
        if (res.error) {
          setEvaluationsError(res.error.message);
        } else {
          setEvaluations(res.evaluations);
          setTabCounts((prev) => ({ ...prev, evaluations: res.evaluations.length }));
        }
        setEvaluationsLoading(false);
      })
      .catch((err: unknown) => {
        setEvaluationsError(err instanceof Error ? err.message : 'Failed to load evaluations.');
        setEvaluationsLoading(false);
      });
  }, [studentId]);

  useEffect(() => {
    if (activeTab === 'evaluations' && studentId) {
      loadEvaluations();
    }
  }, [activeTab, studentId, loadEvaluations]);

  // Background prefetch for tab badge counts (PL-AUD-003)
  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;

    if (tabCounts.tasks === null && activeTab !== 'tasks') {
      getStudentTasksCount(studentId)
        .then(({ count, error }) => {
          if (isMounted && !error) {
            setTabCounts((prev) => ({ ...prev, tasks: count }));
          }
        })
        .catch(() => {});
    }

    if (tabCounts.assignments === null && activeTab !== 'assignments') {
      getStudentAssignmentsCount(studentId)
        .then(({ count, error }) => {
          if (isMounted && !error) {
            setTabCounts((prev) => ({ ...prev, assignments: count }));
          }
        })
        .catch(() => {});
    }

    if (tabCounts.evaluations === null && activeTab !== 'evaluations') {
      getStudentEvaluationsCount(studentId)
        .then(({ count, error }) => {
          if (isMounted && !error) {
            setTabCounts((prev) => ({ ...prev, evaluations: count }));
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [studentId, activeTab, tabCounts.tasks, tabCounts.assignments, tabCounts.evaluations]);

  // ---------------------------------------------------------------------------
  // SUBMISSION FORM HANDLERS (TAB 3)
  // ---------------------------------------------------------------------------
  const handleOpenSubmission = (assignment: AssignmentWithMeta) => {
    const isLocked =
      assignment.status === 'closed' ||
      assignment.status === 'archived' ||
      (assignment.submission &&
        (assignment.submission.status === 'under_review' ||
          assignment.submission.status === 'reviewed'));

    if (isLocked) return;

    if (activeAssignmentId === assignment.id) {
      // Toggle drawer closed
      setActiveAssignmentId(null);
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

    if (!textContent.trim()) {
      const formattedSize =
        file.size < 1024 * 1024
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
    if (
      currentAssignment?.submission?.file_name &&
      currentAssignment.submission.submission_type === 'file'
    ) {
      setFileName(currentAssignment.submission.file_name);
      setFileSize(currentAssignment.submission.file_size || undefined);
      setExistingFilePath(currentAssignment.submission.file_path || null);
    } else {
      setFileName('');
      setFileSize(undefined);
      setExistingFilePath(null);
    }
  };

  const handleSubmitWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentId || !studentId) return;

    const currentAssignment = assignments.find((a) => a.id === activeAssignmentId);
    if (!currentAssignment) return;

    if (
      currentAssignment.submission &&
      (currentAssignment.submission.status === 'under_review' ||
        currentAssignment.submission.status === 'reviewed')
    ) {
      setFormError(
        'This submission is currently under mentor review or has already been graded. Modifications are locked.'
      );
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
        finalContent = selectedFile
          ? `Attached file: ${selectedFile.name}`
          : `Attached document: ${fileName}`;
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
      if (newUploadPath) {
        await deleteAcademicFile(newUploadPath).catch((err) => {
          console.error('Failed to clean up newly uploaded file after submission failure:', err);
        });
      }
      setSubmitting(false);
      setFormError(`Failed to save submission: ${submitErr.message}`);
      return;
    }

    // Attachment lifecycle cleanup (PL-AUD-002):
    // Only after successful database persistence, clean up previous file if it was replaced or superseded.
    const previousFilePath = currentAssignment.submission?.file_path;
    const isFileReplaced = Boolean(newUploadPath && previousFilePath && previousFilePath !== newUploadPath);
    const isFileCleared = Boolean(submissionType !== 'file' && previousFilePath);

    if (isFileReplaced || isFileCleared) {
      if (previousFilePath) {
        try {
          const { error: delErr } = await deleteAcademicFile(previousFilePath);
          if (delErr) {
            console.error('Failed to clean up superseded submission attachment:', delErr);
          }
        } catch (cleanupErr) {
          console.error('Error during superseded submission attachment cleanup:', cleanupErr);
        }
      }
    }

    setSubmitting(false);
    setSelectedFile(null);
    setFormSuccess('Your assignment work has been submitted successfully!');

    setAssignments((prev) =>
      prev.map((a) => (a.id === activeAssignmentId ? { ...a, submission } : a))
    );
  };

  // ---------------------------------------------------------------------------
  // ATTACHMENT PREVIEW & DOWNLOAD HANDLERS
  // ---------------------------------------------------------------------------
  const handlePreviewAttachment = async (attachment: {
    name?: string | null;
    size?: number | null;
    path?: string | null;
  }) => {
    const name = attachment.name || 'attachment';
    if (!attachment.path) {
      setViewerModal({
        isOpen: true,
        fileName: name,
        filePath: null,
        fileUrl: null,
        fileSize: attachment.size || null,
        loading: false,
        error: 'Storage path is not recorded for this attachment.',
      });
      return;
    }

    setViewerModal({
      isOpen: true,
      fileName: name,
      filePath: attachment.path,
      fileUrl: null,
      fileSize: attachment.size || null,
      loading: true,
      error: null,
    });

    const { signedUrl, error: urlErr } = await getAcademicFileSignedUrl(attachment.path);
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

  const handleDownloadAttachment = async (attachment: {
    name?: string | null;
    path?: string | null;
  }) => {
    const name = attachment.name || 'download';
    if (!attachment.path) {
      alert('Attachment path is not available for download.');
      return;
    }

    const { signedUrl, error: urlErr } = await getAcademicFileSignedUrl(attachment.path);
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

  // ---------------------------------------------------------------------------
  // FILTERED COMPUTATIONS
  // ---------------------------------------------------------------------------
  // Filtered Tasks for Display (Tab 2)
  const filteredTasks = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    const q = taskSearch.trim().toLowerCase();

    return tasks.filter((task) => {
      if (taskStatusFilter === 'overdue') {
        const isOverdue = task.due_date && task.due_date < todayStr && task.status !== 'completed';
        if (!isOverdue) return false;
      }

      if (q) {
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) || false;
        const matchesSubject = task.subject_name?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesSubject) return false;
      }

      return true;
    });
  }, [tasks, taskStatusFilter, taskSearch]);

  const taskStats = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const overdue = tasks.filter(
      (t) => t.due_date && t.due_date < todayStr && t.status !== 'completed'
    ).length;

    return { total, completed, inProgress, pending, overdue };
  }, [tasks]);

  // Filtered Evaluations (Tab 4)
  const evaluationDateRange = useMemo(() => {
    return computeLibraryDateRange(evaluationDatePreset, {
      selectedSpecificDate: evaluationSpecificDate,
      customStartDate: evaluationCustomStartDate,
      customEndDate: evaluationCustomEndDate,
    });
  }, [evaluationDatePreset, evaluationSpecificDate, evaluationCustomStartDate, evaluationCustomEndDate]);

  const filteredEvaluations = useMemo(() => {
    return evaluations.filter((e) => {
      if (evaluationSearch.trim()) {
        const q = evaluationSearch.toLowerCase();
        const matchTitle = (e.title || '').toLowerCase().includes(q);
        const matchDesc = (e.description || '').toLowerCase().includes(q);
        const matchFeedback = (e.feedback || '').toLowerCase().includes(q);
        const matchRec = (e.recommendation || '').toLowerCase().includes(q);
        const matchSubj = (e.subject_name || '').toLowerCase().includes(q);
        const matchMentor = (e.mentor_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchFeedback && !matchRec && !matchSubj && !matchMentor) {
          return false;
        }
      }
      if (evaluationSubjectFilter !== 'all' && e.subject_id !== evaluationSubjectFilter) {
        return false;
      }
      if (evaluationStatusFilter !== 'all' && e.status !== evaluationStatusFilter) {
        return false;
      }
      if (evaluationFormatFilter !== 'all' && e.format !== evaluationFormatFilter) {
        return false;
      }
      if (evaluationDateRange.startDate && e.scheduled_date < evaluationDateRange.startDate) {
        return false;
      }
      if (evaluationDateRange.endDate && e.scheduled_date > evaluationDateRange.endDate) {
        return false;
      }
      return true;
    });
  }, [
    evaluations,
    evaluationSearch,
    evaluationSubjectFilter,
    evaluationStatusFilter,
    evaluationFormatFilter,
    evaluationDateRange,
  ]);

  // Tab 4 Computed Metrics
  const evalMetrics = useMemo(() => {
    const total = evaluations.length;
    const completed = evaluations.filter((e) => e.status === 'completed').length;
    const scheduled = evaluations.filter((e) => e.status === 'scheduled').length;
    const scoredList = evaluations.filter((e) => e.status === 'completed' && typeof e.score === 'number' && e.total_points);
    const avgScore = scoredList.length > 0
      ? Math.round(
          (scoredList.reduce((acc, curr) => acc + ((curr.score! / (curr.total_points || 100)) * 100), 0) /
            scoredList.length) *
            10
        ) / 10
      : null;
    return { total, completed, scheduled, avgScore };
  }, [evaluations]);

  // Filtered Assignments for Display (Tab 3)
  const filteredAssignments = useMemo(() => {
    const todayStr = formatLocalDate(new Date());
    const q = assignmentSearch.trim().toLowerCase();

    return assignments.filter((a) => {
      // Subject filter
      if (assignmentSubjectFilter !== 'all' && a.subject_id !== assignmentSubjectFilter) {
        return false;
      }

      // Status filter
      if (assignmentStatusFilter !== 'all') {
        if (assignmentStatusFilter === 'pending') {
          if (a.submission) return false;
        } else if (assignmentStatusFilter === 'submitted') {
          if (!a.submission || a.submission.status !== 'submitted') return false;
        } else if (assignmentStatusFilter === 'under_review') {
          if (!a.submission || a.submission.status !== 'under_review') return false;
        } else if (assignmentStatusFilter === 'reviewed') {
          if (!a.submission || a.submission.status !== 'reviewed') return false;
        } else if (assignmentStatusFilter === 'needs_revision') {
          if (!a.submission || a.submission.status !== 'needs_revision') return false;
        }
      }

      // Date filter
      if (assignmentDateFilter === 'upcoming') {
        if (a.due_date && a.due_date < todayStr) return false;
      } else if (assignmentDateFilter === 'past_due') {
        if (!a.due_date || a.due_date >= todayStr) return false;
      }

      // Text search
      if (q) {
        const matchesTitle = a.title.toLowerCase().includes(q);
        const matchesInst = a.instructions?.toLowerCase().includes(q) || false;
        const matchesSubj = a.subject_name?.toLowerCase().includes(q) || false;
        const matchesContent = a.submission?.content?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesInst && !matchesSubj && !matchesContent) {
          return false;
        }
      }

      return true;
    });
  }, [assignments, assignmentSubjectFilter, assignmentStatusFilter, assignmentDateFilter, assignmentSearch]);

  const assignmentStats = useMemo(() => {
    const total = assignments.length;
    const pending = assignments.filter((a) => !a.submission).length;
    const submitted = assignments.filter((a) => a.submission && a.submission.status === 'submitted').length;
    const underReview = assignments.filter((a) => a.submission && a.submission.status === 'under_review').length;
    const reviewed = assignments.filter((a) => a.submission && a.submission.status === 'reviewed').length;
    const needsRevision = assignments.filter((a) => a.submission && a.submission.status === 'needs_revision').length;

    return { total, pending, submitted, underReview, reviewed, needsRevision };
  }, [assignments]);

  // Helper formatting functions
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Helper for copying URL to clipboard
  const handleCopyLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard failures
    }
  };

  // Filtered Resources (Tab 1)
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      if (resourceSubjectFilter !== 'all' && res.subject_id !== resourceSubjectFilter) {
        return false;
      }
      if (resourceTypeFilter !== 'all' && res.resource_type !== resourceTypeFilter) {
        return false;
      }
      if (resourceSearch.trim()) {
        const query = resourceSearch.toLowerCase();
        const matchesTitle = res.title.toLowerCase().includes(query);
        const matchesDesc = res.description?.toLowerCase().includes(query) || false;
        const matchesSubject = res.subject_name?.toLowerCase().includes(query) || false;
        const matchesContent = res.content?.toLowerCase().includes(query) || false;
        if (!matchesTitle && !matchesDesc && !matchesSubject && !matchesContent) {
          return false;
        }
      }
      return true;
    });
  }, [resources, resourceSubjectFilter, resourceTypeFilter, resourceSearch]);

  const clearTaskFilters = () => {
    setTaskSearch('');
    setTaskSubjectFilter('all');
    setTaskStatusFilter('all');
    setDatePreset('all');
    setCustomStartDate('');
    setCustomEndDate('');
  };

  const clearAssignmentFilters = () => {
    setAssignmentSearch('');
    setAssignmentSubjectFilter('all');
    setAssignmentStatusFilter('all');
    setAssignmentDateFilter('all');
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. HEADER SECTION                                                         */}
      {/* ========================================================================= */}
      <section className="p-6 sm:p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="teal" size="sm">
                ACADEMIC REPOSITORY
              </Badge>
              <span className="font-mono text-xs text-brand-muted">PoraPlan Unified Library</span>
            </div>
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
              Academic Library
            </h1>
            <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-2xl">
              Centralized repository for your curriculum study resources, task and study history, and assignment portfolio.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/student/dashboard">
              <Button variant="outline" size="sm">
                Dashboard
              </Button>
            </Link>
            <Link to="/student/tasks">
              <Button variant="outline" size="sm">
                Today's Tasks
              </Button>
            </Link>
            <Link to="/student/assignments">
              <Button variant="outline" size="sm">
                Practice Assignments
              </Button>
            </Link>
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* TAB NAVIGATION BAR (URL-SYNCHRONIZED)                                  */}
        {/* ----------------------------------------------------------------------- */}
        <div className="pt-2 border-t-2 border-brand-dark/15 flex flex-wrap gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => handleTabChange('resources')}
            className={`px-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === 'resources'
                ? 'bg-brand-teal text-white shadow-brutal-sm -translate-y-0.5'
                : 'bg-brand-bg text-brand-dark hover:bg-brand-paper-tint'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Study Resources</span>
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full border border-brand-dark ${
                activeTab === 'resources' ? 'bg-white text-brand-dark' : 'bg-brand-paper text-brand-muted'
              }`}
            >
              {resourcesLoading && activeTab === 'resources' && tabCounts.resources === null
                ? '...'
                : tabCounts.resources !== null
                ? tabCounts.resources
                : resources.length > 0
                ? resources.length
                : '...'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('tasks')}
            className={`px-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === 'tasks'
                ? 'bg-brand-coral text-white shadow-brutal-sm -translate-y-0.5'
                : 'bg-brand-bg text-brand-dark hover:bg-brand-paper-tint'
            }`}
          >
            <ListTodo className="w-4 h-4" />
            <span>Tasks & Study History</span>
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full border border-brand-dark ${
                activeTab === 'tasks' ? 'bg-white text-brand-dark' : 'bg-brand-paper text-brand-muted'
              }`}
            >
              {tasksLoading && activeTab === 'tasks' && tabCounts.tasks === null
                ? '...'
                : tabCounts.tasks !== null
                ? tabCounts.tasks
                : tasks.length > 0
                ? tasks.length
                : '...'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('assignments')}
            className={`px-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === 'assignments'
                ? 'bg-brand-gold text-brand-dark shadow-brutal-sm -translate-y-0.5'
                : 'bg-brand-bg text-brand-dark hover:bg-brand-paper-tint'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Assignments & Submissions</span>
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full border border-brand-dark ${
                activeTab === 'assignments' ? 'bg-brand-navy text-white' : 'bg-brand-paper text-brand-muted'
              }`}
            >
              {assignmentsLoading && activeTab === 'assignments' && tabCounts.assignments === null
                ? '...'
                : tabCounts.assignments !== null
                ? tabCounts.assignments
                : assignments.length > 0
                ? assignments.length
                : '...'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('evaluations')}
            className={`px-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm font-bold transition-all inline-flex items-center gap-2 ${
              activeTab === 'evaluations'
                ? 'bg-brand-navy text-white shadow-brutal-sm -translate-y-0.5'
                : 'bg-brand-bg text-brand-dark hover:bg-brand-paper-tint'
            }`}
            aria-selected={activeTab === 'evaluations'}
          >
            <Calendar className="w-4 h-4" />
            <span>Evaluations</span>
            <span
              className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full border border-brand-dark ${
                activeTab === 'evaluations' ? 'bg-brand-gold text-brand-dark font-bold' : 'bg-brand-paper text-brand-muted'
              }`}
            >
              {evaluationsLoading && activeTab === 'evaluations' && tabCounts.evaluations === null
                ? '...'
                : tabCounts.evaluations !== null
                ? tabCounts.evaluations
                : evaluations.length > 0
                ? evaluations.length
                : '...'}
            </span>
          </button>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TAB 1: STUDY RESOURCES (FULL IMPLEMENTATION)                               */}
      {/* ========================================================================= */}
      {activeTab === 'resources' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filter Bar */}
          <section className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search resources by title, description, or notes..."
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Subject Filter */}
              <select
                value={resourceSubjectFilter}
                onChange={(e) => setResourceSubjectFilter(e.target.value)}
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="all">All Subjects ({subjects.length})</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              {/* Resource Type Filter */}
              <select
                value={resourceTypeFilter}
                onChange={(e) => setResourceTypeFilter(e.target.value)}
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="all">All Resource Types</option>
                <option value="note">Notes & Cheat Sheets</option>
                <option value="link">Web References & Links</option>
                <option value="file">Documents & PDFs</option>
              </select>

              {/* Reload Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={loadResources}
                disabled={resourcesLoading}
                leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${resourcesLoading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </Button>
            </div>
          </section>

          {/* Resources Content State */}
          {resourcesLoading ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
              <p className="font-mono text-xs text-brand-muted">Loading study resources...</p>
            </div>
          ) : resourcesError ? (
            <div className="p-6 border-2 border-brand-dark bg-red-50 shadow-brutal space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-bold font-mono text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Error loading resources</span>
              </div>
              <p className="font-mono text-xs text-brand-dark">{resourcesError}</p>
              <Button variant="outline" size="sm" onClick={loadResources}>
                Retry
              </Button>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-4">
              <BookOpen className="w-12 h-12 text-brand-muted mx-auto stroke-1" />
              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                  No study resources found
                </h3>
                <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
                  {resourceSearch || resourceSubjectFilter !== 'all' || resourceTypeFilter !== 'all'
                    ? 'No resources match your active filter criteria. Try adjusting your search query or reset the filters.'
                    : 'Your mentors have not published any reference materials for your enrolled subjects yet.'}
                </p>
              </div>
              {(resourceSearch || resourceSubjectFilter !== 'all' || resourceTypeFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setResourceSearch('');
                    setResourceSubjectFilter('all');
                    setResourceTypeFilter('all');
                  }}
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((res) => (
                <div
                  key={res.id}
                  className="border-2 border-brand-dark bg-brand-paper shadow-brutal hover:shadow-brutal-md transition-shadow flex flex-col justify-between"
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant={
                            res.resource_type === 'note'
                              ? 'gold'
                              : res.resource_type === 'link'
                              ? 'teal'
                              : 'navy'
                          }
                          size="sm"
                        >
                          {res.resource_type.toUpperCase()}
                        </Badge>
                        {res.subject_name && (
                          <span className="font-mono text-[11px] font-bold text-brand-navy">
                            {res.subject_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-heading font-bold text-base text-brand-navy line-clamp-2">
                        {res.title}
                      </h3>
                      {res.description && (
                        <p className="mt-1 font-sans text-xs text-brand-muted line-clamp-3">
                          {res.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 border-t-2 border-brand-dark bg-brand-bg flex items-center justify-between gap-2">
                    {res.resource_type === 'note' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveResource(res)}
                        leftIcon={<FileCode className="w-3.5 h-3.5 text-brand-teal" />}
                      >
                        Read Note
                      </Button>
                    ) : res.resource_type === 'file' ? (
                      /* File metadata info (Clearly presented as reference document, not a downloadable attachment) */
                      <div className="flex items-center gap-2">
                        {res.file_size && (
                          <span className="font-mono text-[10px] text-brand-muted">
                            {formatFileSize(res.file_size)}
                          </span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveResource(res)}
                          leftIcon={<FileText className="w-3.5 h-3.5 text-brand-teal" />}
                        >
                          View File Info
                        </Button>
                      </div>
                    ) : res.url ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(res.url!, res.id)}
                          className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
                          title="Copy Link"
                        >
                          {copiedId === res.id ? (
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-brand-dark" />
                          )}
                        </button>
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 border-2 border-brand-dark bg-brand-teal text-white font-mono text-xs font-bold shadow-brutal-xs hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
                        >
                          <span>Open</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ) : (
                      <span className="font-mono text-[10px] text-brand-muted">
                        {res.mentor_name ? `From ${res.mentor_name}` : 'Study Reference'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: TASKS & STUDY HISTORY (FULL MILESTONE 4 IMPLEMENTATION)             */}
      {/* ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Milestone 4 Foundation / Tasks Integration */}
          {/* History Semantics & Disambiguation Info Alert */}
          <div className="p-4 border-2 border-brand-dark bg-amber-50 shadow-brutal flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-mono font-bold uppercase text-amber-900 tracking-wide">
                Study History & Date Semantics
              </span>
              <p className="font-sans text-brand-dark leading-relaxed">
                Date filters query tasks by their scheduled target date (<code className="font-mono font-bold bg-amber-100 px-1 py-0.5 border border-brand-dark/20">due_date</code>). Tasks without a scheduled date appear in "All History" view. The completion timestamp reflects current status; reverting a completed task resets its completion record.
              </p>
            </div>
          </div>

          {/* Filter & Control Bar */}
          <section className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
            {/* Row 1: Date Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-mono text-xs font-bold uppercase text-brand-muted">
                  Date Range Selection (Due Date)
                </span>
                <span className="font-mono text-[11px] text-brand-muted">
                  {datePreset === 'all' && 'Showing All Scheduled & Unscheduled Tasks'}
                  {datePreset === 'today' && `Today (${formatLocalDate(new Date())})`}
                  {datePreset === 'this_week' && 'Current Calendar Week (Mon – Sun)'}
                  {datePreset === 'this_month' && 'Current Calendar Month'}
                  {datePreset === 'specific_date' && `Target Date: ${selectedSpecificDate}`}
                  {datePreset === 'custom_range' &&
                    `Range: ${customStartDate || 'Start'} to ${customEndDate || 'End'}`}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'all', label: 'All History' },
                    { id: 'today', label: 'Today' },
                    { id: 'this_week', label: 'This Week' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'specific_date', label: 'Single Date' },
                    { id: 'custom_range', label: 'Custom Range' },
                  ] as { id: DatePreset; label: string }[]
                ).map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setDatePreset(preset.id)}
                    className={`px-3 py-1.5 border-2 border-brand-dark font-mono text-xs font-bold transition-all ${
                      datePreset === preset.id
                        ? 'bg-brand-coral text-white shadow-brutal-xs -translate-y-0.5'
                        : 'bg-brand-bg text-brand-dark hover:bg-brand-paper-tint'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Date Input Sub-bar (Single Date or Custom Range) */}
              {datePreset === 'specific_date' && (
                <div className="pt-2 flex items-center gap-3 animate-fadeIn">
                  <label className="font-mono text-xs font-bold text-brand-navy flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-brand-coral" />
                    Target Date:
                  </label>
                  <input
                    type="date"
                    value={selectedSpecificDate}
                    onChange={(e) => setSelectedSpecificDate(e.target.value)}
                    className="px-3 py-1.5 border-2 border-brand-dark font-mono text-xs bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-coral"
                  />
                </div>
              )}

              {datePreset === 'custom_range' && (
                <div className="pt-2 flex flex-wrap items-center gap-3 animate-fadeIn">
                  <div className="flex items-center gap-1.5">
                    <label className="font-mono text-xs font-bold text-brand-navy">From:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-3 py-1.5 border-2 border-brand-dark font-mono text-xs bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-coral"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label className="font-mono text-xs font-bold text-brand-navy">To:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-3 py-1.5 border-2 border-brand-dark font-mono text-xs bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-coral"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 2: Search, Subject, Status, Refresh */}
            <div className="pt-3 border-t-2 border-brand-dark/15 flex flex-col md:flex-row gap-3">
              {/* Text Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search task title, description, or subject..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-coral"
                />
              </div>

              {/* Subject Filter */}
              <select
                value={taskSubjectFilter}
                onChange={(e) => setTaskSubjectFilter(e.target.value)}
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-coral"
              >
                <option value="all">All Subjects ({subjects.length})</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={taskStatusFilter}
                onChange={(e) =>
                  setTaskStatusFilter(
                    e.target.value as 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue'
                  )
                }
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-coral"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue Tasks</option>
              </select>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearTaskFilters}
                  title="Clear all task filters"
                >
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadTasks}
                  disabled={tasksLoading}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${tasksLoading ? 'animate-spin' : ''}`} />}
                >
                  Reload
                </Button>
              </div>
            </div>
          </section>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                Total Queries
              </span>
              <div className="font-mono text-lg font-black text-brand-navy">
                {taskStats.total}
              </div>
            </div>

            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-green-700">
                Completed
              </span>
              <div className="font-mono text-lg font-black text-green-700">
                {taskStats.completed}
              </div>
            </div>

            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                In Progress
              </span>
              <div className="font-mono text-lg font-black text-brand-teal">
                {taskStats.inProgress}
              </div>
            </div>

            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-amber-700">
                Pending
              </span>
              <div className="font-mono text-lg font-black text-amber-700">
                {taskStats.pending}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 border-2 border-brand-dark bg-red-50 shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-red-700">
                Overdue
              </span>
              <div className="font-mono text-lg font-black text-red-700">
                {taskStats.overdue}
              </div>
            </div>
          </div>

          {/* Tasks Content List */}
          {tasksLoading ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-coral animate-spin" />
              <p className="font-mono text-xs text-brand-muted">Loading tasks history...</p>
            </div>
          ) : tasksError ? (
            <div className="p-6 border-2 border-brand-dark bg-red-50 shadow-brutal space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-bold font-mono text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Error loading tasks</span>
              </div>
              <p className="font-mono text-xs text-brand-dark">{tasksError}</p>
              <Button variant="outline" size="sm" onClick={loadTasks}>
                Retry
              </Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-4">
              <ListTodo className="w-12 h-12 text-brand-muted mx-auto stroke-1" />
              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                  No tasks found
                </h3>
                <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
                  {taskSearch ||
                  taskSubjectFilter !== 'all' ||
                  taskStatusFilter !== 'all' ||
                  datePreset !== 'all'
                    ? 'No tasks match your chosen filters or scheduled date bounds. Try clearing or expanding your selection.'
                    : 'You currently have no tasks assigned in your study curriculum.'}
                </p>
              </div>
              {(taskSearch ||
                taskSubjectFilter !== 'all' ||
                taskStatusFilter !== 'all' ||
                datePreset !== 'all') && (
                <Button variant="outline" size="sm" onClick={clearTaskFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const todayStr = formatLocalDate(new Date());
                const isOverdue =
                  task.due_date && task.due_date < todayStr && task.status !== 'completed';
                const isUpdating = updatingTaskId === task.id;

                return (
                  <div
                    key={task.id}
                    className={`p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal transition-all ${
                      task.status === 'completed'
                        ? 'bg-slate-50 opacity-90'
                        : isOverdue
                        ? 'border-red-600 bg-red-50/20'
                        : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* Checkbox / Toggle Completion Button */}
                      <button
                        type="button"
                        onClick={() => handleToggleTaskStatus(task)}
                        disabled={isUpdating}
                        className="mt-0.5 shrink-0 focus:outline-none"
                        title={
                          task.status === 'completed'
                            ? 'Mark as pending'
                            : 'Mark as completed'
                        }
                      >
                        {isUpdating ? (
                          <Loader2 className="w-5 h-5 text-brand-coral animate-spin" />
                        ) : task.status === 'completed' ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-brand-dark hover:text-brand-coral" />
                        )}
                      </button>

                      {/* Main Task Content */}
                      <div className="flex-1 space-y-2">
                        {/* Header: Title, Subject, Priority, Status */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`font-heading font-bold text-base ${
                                task.status === 'completed'
                                  ? 'line-through text-brand-muted'
                                  : 'text-brand-navy'
                              }`}
                            >
                              {task.title}
                            </span>

                            {task.subject_name && (
                              <Badge variant="navy" size="sm">
                                {task.subject_name}
                              </Badge>
                            )}

                            {task.priority && (
                              <Badge
                                variant={
                                  task.priority === 'high'
                                    ? 'danger'
                                    : task.priority === 'medium'
                                    ? 'gold'
                                    : 'teal'
                                }
                                size="sm"
                              >
                                {task.priority.toUpperCase()}
                              </Badge>
                            )}

                            {isOverdue && (
                              <Badge variant="danger" size="sm">
                                OVERDUE
                              </Badge>
                            )}
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            <Badge
                              variant={
                                task.status === 'completed'
                                  ? 'teal'
                                  : task.status === 'in_progress'
                                  ? 'gold'
                                  : 'navy'
                              }
                              size="sm"
                            >
                              {task.status === 'in_progress'
                                ? 'IN PROGRESS'
                                : task.status.toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        {/* Description */}
                        {task.description && (
                          <p className="font-sans text-xs sm:text-sm text-brand-dark/80 whitespace-pre-line leading-relaxed">
                            {task.description}
                          </p>
                        )}

                        {/* Explicit Date Disambiguation Row */}
                        <div className="pt-2 border-t border-brand-dark/10 flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[11px] text-brand-muted">
                          {/* Scheduled Due Date */}
                          <div
                            className={`flex items-center gap-1.5 ${
                              isOverdue ? 'text-red-600 font-bold' : ''
                            }`}
                          >
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Scheduled Due:{' '}
                              <strong className="text-brand-dark">
                                {task.due_date ? task.due_date : 'Unscheduled'}
                              </strong>
                            </span>
                          </div>

                          {/* Created At Timestamp */}
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              Created: <span>{formatDate(task.created_at)}</span>
                            </span>
                          </div>

                          {/* Completed At Timestamp */}
                          {task.completed_at && (
                            <div className="flex items-center gap-1.5 text-green-700 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>Completed: {formatDateTime(task.completed_at)}</span>
                            </div>
                          )}

                          {/* Estimated Minutes */}
                          {task.estimated_minutes && (
                            <div className="flex items-center gap-1.5">
                              <span>Est: {task.estimated_minutes} mins</span>
                            </div>
                          )}

                          {/* Plan Linkage */}
                          {task.plan_title && (
                            <div className="flex items-center gap-1.5">
                              <span>Plan: {task.plan_title}</span>
                            </div>
                          )}
                        </div>

                        {/* Mentor Task Attachment Row */}
                        {task.attachment_path && (
                          <div className="mt-3 p-2.5 border-2 border-brand-dark bg-brand-bg flex flex-wrap items-center justify-between gap-3 shadow-brutal-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <Paperclip className="w-4 h-4 text-brand-coral shrink-0" />
                              <div className="min-w-0">
                                <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                  {task.attachment_name || 'Task Attachment'}
                                </span>
                                {task.attachment_size && (
                                  <span className="font-mono text-[10px] text-brand-muted">
                                    {formatFileSize(task.attachment_size)}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handlePreviewAttachment({
                                    name: task.attachment_name,
                                    size: task.attachment_size,
                                    path: task.attachment_path,
                                  })
                                }
                                leftIcon={<Eye className="w-3.5 h-3.5 text-brand-teal" />}
                              >
                                Preview
                              </Button>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleDownloadAttachment({
                                    name: task.attachment_name,
                                    path: task.attachment_path,
                                  })
                                }
                                leftIcon={<Download className="w-3.5 h-3.5 text-brand-dark" />}
                              >
                                Download
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ASSIGNMENTS & SUBMISSIONS (FULL MILESTONE 5 INTEGRATION)             */}
      {/* ========================================================================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Milestone 5 Foundation / Integration Indicator */}
          <div className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="gold" size="sm">
                  CURRICULUM PORTFOLIO
                </Badge>
                <span className="font-mono text-xs text-brand-muted">Milestone 5 Foundation</span>
              </div>
              <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                Assignments &amp; Submissions Portfolio
              </h2>
              <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-2xl">
                Review distributed practice problem sets, submit text, link, or document solutions, and track mentor grading feedback.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to="/student/assignments">
                <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Practice Assignments
                </Button>
              </Link>
            </div>
          </div>

          {/* Filter Bar */}
          <section className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Text Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search assignments by title, instructions, subject, or content..."
                  value={assignmentSearch}
                  onChange={(e) => setAssignmentSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-gold"
                />
              </div>

              {/* Subject Filter */}
              <select
                value={assignmentSubjectFilter}
                onChange={(e) => setAssignmentSubjectFilter(e.target.value)}
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="all">All Subjects ({subjects.length})</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={assignmentStatusFilter}
                onChange={(e) =>
                  setAssignmentStatusFilter(
                    e.target.value as
                      | 'all'
                      | 'pending'
                      | 'submitted'
                      | 'under_review'
                      | 'reviewed'
                      | 'needs_revision'
                  )
                }
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="all">All Statuses ({assignments.length})</option>
                <option value="pending">To Submit ({assignmentStats.pending})</option>
                <option value="submitted">Submitted ({assignmentStats.submitted})</option>
                <option value="under_review">Under Review ({assignmentStats.underReview})</option>
                <option value="reviewed">Reviewed / Graded ({assignmentStats.reviewed})</option>
                <option value="needs_revision">Revision Requested ({assignmentStats.needsRevision})</option>
              </select>

              {/* Date Filter */}
              <select
                value={assignmentDateFilter}
                onChange={(e) =>
                  setAssignmentDateFilter(e.target.value as 'all' | 'upcoming' | 'past_due')
                }
                className="px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-bg focus:outline-none focus:ring-2 focus:ring-brand-gold"
              >
                <option value="all">All Due Dates</option>
                <option value="upcoming">Upcoming &amp; Current</option>
                <option value="past_due">Past Due Date</option>
              </select>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAssignmentFilters}
                  title="Clear all assignment filters"
                >
                  Reset
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAssignments}
                  disabled={assignmentsLoading}
                  leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${assignmentsLoading ? 'animate-spin' : ''}`} />}
                >
                  Reload
                </Button>
              </div>
            </div>
          </section>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                Total Sets
              </span>
              <div className="font-mono text-lg font-black text-brand-navy">
                {assignmentStats.total}
              </div>
            </div>

            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-amber-700">
                To Submit
              </span>
              <div className="font-mono text-lg font-black text-amber-700">
                {assignmentStats.pending}
              </div>
            </div>

            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                Submitted
              </span>
              <div className="font-mono text-lg font-black text-brand-teal">
                {assignmentStats.submitted}
              </div>
            </div>

            <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-green-700">
                Reviewed
              </span>
              <div className="font-mono text-lg font-black text-green-700">
                {assignmentStats.reviewed}
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-coral">
                Under Review
              </span>
              <div className="font-mono text-lg font-black text-brand-coral">
                {assignmentStats.underReview}
              </div>
            </div>
          </div>

          {/* Assignments Content List */}
          {assignmentsLoading ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
              <p className="font-mono text-xs text-brand-muted">Loading assignments & submissions...</p>
            </div>
          ) : assignmentsError ? (
            <div className="p-6 border-2 border-brand-dark bg-red-50 shadow-brutal space-y-3">
              <div className="flex items-center gap-2 text-red-700 font-bold font-mono text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>Error loading assignments</span>
              </div>
              <p className="font-mono text-xs text-brand-dark">{assignmentsError}</p>
              <Button variant="outline" size="sm" onClick={loadAssignments}>
                Retry
              </Button>
            </div>
          ) : filteredAssignments.length === 0 ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-4">
              <Layers className="w-12 h-12 text-brand-muted mx-auto stroke-1" />
              <div className="space-y-1">
                <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                  No assignments found
                </h3>
                <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
                  {assignmentSearch ||
                  assignmentSubjectFilter !== 'all' ||
                  assignmentStatusFilter !== 'all' ||
                  assignmentDateFilter !== 'all'
                    ? 'No assignments match your current filters. Try adjusting or resetting your filter criteria.'
                    : 'Your mentors have not assigned any practice problem sets yet.'}
                </p>
              </div>
              {(assignmentSearch ||
                assignmentSubjectFilter !== 'all' ||
                assignmentStatusFilter !== 'all' ||
                assignmentDateFilter !== 'all') && (
                <Button variant="outline" size="sm" onClick={clearAssignmentFilters}>
                  Clear All Filters
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => {
                const hasSubmission = Boolean(assignment.submission);
                const isSelected = activeAssignmentId === assignment.id;
                const isClosed = assignment.status === 'closed' || assignment.status === 'archived';
                const submissionStatus = assignment.submission?.status;
                const isLocked =
                  isClosed ||
                  (hasSubmission &&
                    (submissionStatus === 'under_review' || submissionStatus === 'reviewed'));
                const todayStr = formatLocalDate(new Date());
                const isPastDue =
                  assignment.due_date && assignment.due_date < todayStr && !hasSubmission;

                return (
                  <div
                    key={assignment.id}
                    className={`border-2 border-brand-dark bg-brand-paper transition-all ${
                      isSelected
                        ? 'shadow-brutal ring-2 ring-brand-navy'
                        : 'shadow-brutal hover:shadow-brutal-md'
                    }`}
                  >
                    <div className="p-5 sm:p-6 space-y-4">
                      {/* Top Badges & Meta */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {assignment.subject_name && (
                            <Badge variant="navy" size="sm">
                              {assignment.subject_name}
                            </Badge>
                          )}

                          {assignment.plan_title && (
                            <Badge variant="muted" size="sm">
                              {assignment.plan_title}
                            </Badge>
                          )}

                          {/* Submission Status Badge */}
                          <Badge
                            variant={
                              !hasSubmission
                                ? 'gold'
                                : submissionStatus === 'reviewed'
                                ? 'teal'
                                : submissionStatus === 'needs_revision'
                                ? 'danger'
                                : submissionStatus === 'under_review'
                                ? 'gold'
                                : 'navy'
                            }
                            size="sm"
                          >
                            {!hasSubmission
                              ? 'TO SUBMIT'
                              : submissionStatus === 'needs_revision'
                              ? 'REVISION REQUESTED'
                              : submissionStatus === 'under_review'
                              ? 'UNDER REVIEW'
                              : submissionStatus === 'reviewed'
                              ? 'GRADED'
                              : 'SUBMITTED'}
                          </Badge>

                          {isClosed && (
                            <Badge variant="muted" size="sm">
                              CLOSED
                            </Badge>
                          )}

                          {isPastDue && (
                            <Badge variant="danger" size="sm">
                              PAST DUE
                            </Badge>
                          )}
                        </div>

                        {/* Points & Due Date */}
                        <div className="flex items-center gap-3 font-mono text-xs text-brand-muted">
                          {assignment.total_points && (
                            <span className="font-bold text-brand-navy bg-brand-bg px-2 py-0.5 border border-brand-dark/20">
                              {assignment.total_points} PTS
                            </span>
                          )}

                          {assignment.due_date && (
                            <span
                              className={`flex items-center gap-1 ${
                                isPastDue ? 'text-red-600 font-bold' : ''
                              }`}
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Due: {assignment.due_date}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Title & Instructions */}
                      <div>
                        <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
                          {assignment.title}
                        </h3>
                        {assignment.instructions && (
                          <div className="mt-2.5 p-3.5 border-2 border-brand-dark bg-brand-bg font-sans text-xs sm:text-sm text-brand-dark whitespace-pre-wrap leading-relaxed shadow-brutal-xs">
                            {assignment.instructions}
                          </div>
                        )}
                      </div>

                      {/* Existing Student Submission Box */}
                      {hasSubmission && (
                        <div className="space-y-3">
                          {/* Revision Request Banner */}
                          {submissionStatus === 'needs_revision' && (
                            <div className="p-3 border-2 border-red-500 bg-red-50 text-red-800 text-xs flex items-start gap-2 shadow-brutal-xs">
                              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                              <div>
                                <strong className="block font-bold">Revision Requested by Mentor</strong>
                                <span>Please review mentor corrections below and update your solution or document attachment.</span>
                              </div>
                            </div>
                          )}

                          <div className="p-4 border-2 border-brand-teal bg-teal-50/50 shadow-brutal-xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-teal/20 pb-2">
                              <span className="font-mono text-xs font-bold text-brand-teal uppercase flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                                Your Submitted Solution ({assignment.submission?.submission_type.toUpperCase()})
                              </span>
                              <span className="font-mono text-[11px] text-brand-muted">
                                Turned in: {formatDateTime(assignment.submission?.submitted_at)}
                              </span>
                            </div>

                            {/* Link submission */}
                            {assignment.submission?.submission_type === 'link' ? (
                              <div className="flex items-center gap-2">
                                <ExternalLink className="w-4 h-4 text-brand-teal shrink-0" />
                                <a
                                  href={assignment.submission.link_url || assignment.submission.content}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs sm:text-sm text-brand-teal font-mono underline break-all hover:text-brand-navy font-bold"
                                >
                                  {assignment.submission.link_url || assignment.submission.content}
                                </a>
                              </div>
                            ) : assignment.submission?.submission_type === 'file' ? (
                              <div className="space-y-2">
                                <div className="p-3 border-2 border-brand-dark bg-brand-paper flex flex-wrap items-center justify-between gap-3 shadow-brutal-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Paperclip className="w-4 h-4 text-brand-teal shrink-0" />
                                    <div className="min-w-0">
                                      <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                        {assignment.submission.file_name || 'Submission Attachment'}
                                      </span>
                                      {assignment.submission.file_size && (
                                        <span className="font-mono text-[10px] text-brand-muted">
                                          {formatFileSize(assignment.submission.file_size)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handlePreviewAttachment({
                                          name: assignment.submission!.file_name,
                                          size: assignment.submission!.file_size,
                                          path: assignment.submission!.file_path,
                                        })
                                      }
                                      leftIcon={<Eye className="w-3.5 h-3.5 text-brand-teal" />}
                                    >
                                      Preview
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() =>
                                        handleDownloadAttachment({
                                          name: assignment.submission!.file_name,
                                          path: assignment.submission!.file_path,
                                        })
                                      }
                                      leftIcon={<Download className="w-3.5 h-3.5 text-brand-dark" />}
                                    >
                                      Download
                                    </Button>
                                  </div>
                                </div>

                                {assignment.submission.content && (
                                  <p className="font-sans text-xs text-brand-dark whitespace-pre-wrap leading-relaxed">
                                    {assignment.submission.content}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="font-sans text-xs sm:text-sm text-brand-dark whitespace-pre-wrap leading-relaxed">
                                {assignment.submission?.content}
                              </p>
                            )}
                          </div>

                          {/* Mentor Feedback & Score Display */}
                          {assignment.submission?.feedback ? (
                            <div className="p-4 border-2 border-brand-navy bg-brand-paper-tint shadow-brutal-xs space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-navy/20 pb-2">
                                <span className="font-mono text-xs font-bold text-brand-navy uppercase flex items-center gap-1.5">
                                  <FileCheck className="w-4 h-4 text-brand-teal" />
                                  Mentor Review &amp; Evaluation
                                </span>
                                <div className="flex items-center gap-2">
                                  {assignment.submission.score !== undefined &&
                                    assignment.submission.score !== null && (
                                      <Badge variant="teal" size="sm">
                                        SCORE: {assignment.submission.score} /{' '}
                                        {assignment.total_points || 100} PTS
                                      </Badge>
                                    )}
                                  {assignment.submission.reviewed_at && (
                                    <span className="font-mono text-[11px] text-brand-muted">
                                      Reviewed: {formatDate(assignment.submission.reviewed_at)}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="font-sans text-xs sm:text-sm text-brand-dark leading-relaxed whitespace-pre-wrap">
                                {assignment.submission.feedback}
                              </p>
                            </div>
                          ) : (
                            <div className="p-3 border border-brand-dark/20 bg-brand-bg font-mono text-xs text-brand-muted flex items-center gap-2 shadow-brutal-xs">
                              <Clock className="w-3.5 h-3.5 text-brand-gold" />
                              <span>
                                Status: <strong>Awaiting Mentor Review</strong> — your submission is in the queue.
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bottom Action Bar */}
                      <div className="pt-2 border-t border-brand-dark/15 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                        <span className="text-[11px] text-brand-muted">
                          Assigned: {formatDate(assignment.created_at)}
                        </span>

                        <div>
                          {isLocked ? (
                            <span className="font-mono text-xs font-bold text-brand-muted flex items-center gap-1.5">
                              {isClosed ? (
                                'Assignment Closed'
                              ) : submissionStatus === 'under_review' ? (
                                <span className="text-brand-coral flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" />
                                  Under Mentor Review (Locked)
                                </span>
                              ) : (
                                <span className="text-green-700 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Graded &amp; Evaluated
                                </span>
                              )}
                            </span>
                          ) : (
                            <Button
                              variant={hasSubmission ? 'outline' : 'primary'}
                              size="sm"
                              onClick={() => handleOpenSubmission(assignment)}
                              leftIcon={
                                isSelected ? (
                                  <X className="w-3.5 h-3.5" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )
                              }
                            >
                              {isSelected
                                ? 'Close Drawer'
                                : submissionStatus === 'needs_revision'
                                ? 'Submit Revision'
                                : hasSubmission
                                ? 'Edit Submission'
                                : 'Submit Work'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Submission Drawer */}
                      {isSelected && !isLocked && (
                        <div className="mt-4 p-4 sm:p-5 border-2 border-brand-dark bg-brand-bg shadow-brutal space-y-4 animate-fadeIn">
                          <div className="border-b-2 border-brand-dark/15 pb-3 flex items-center justify-between">
                            <h4 className="font-heading font-extrabold text-base text-brand-navy flex items-center gap-2">
                              <Send className="w-4 h-4 text-brand-teal" />
                              {hasSubmission ? 'Update Your Submission' : 'Submit Assignment Work'}
                            </h4>
                            <button
                              type="button"
                              onClick={() => setActiveAssignmentId(null)}
                              className="p-1 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
                              title="Cancel"
                            >
                              <X className="w-4 h-4 text-brand-dark" />
                            </button>
                          </div>

                          {formError && (
                            <div className="p-3 border-2 border-red-500 bg-red-50 text-red-700 text-xs font-mono flex items-center gap-2 shadow-brutal-xs">
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              <span>{formError}</span>
                            </div>
                          )}

                          {formSuccess && (
                            <div className="p-3 border-2 border-green-600 bg-green-50 text-green-800 text-xs font-mono flex items-center gap-2 shadow-brutal-xs">
                              <CheckCircle className="w-4 h-4 shrink-0" />
                              <span>{formSuccess}</span>
                            </div>
                          )}

                          <form onSubmit={handleSubmitWork} className="space-y-4">
                            {/* Submission Type Switcher */}
                            <div className="space-y-1">
                              <label className="font-mono text-xs font-bold text-brand-navy uppercase block">
                                Solution Type
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  [
                                    { type: 'text', label: 'Written Derivation / Text' },
                                    { type: 'link', label: 'External Resource Link' },
                                    { type: 'file', label: 'Upload Document / Scan' },
                                  ] as { type: SubmissionType; label: string }[]
                                ).map((st) => (
                                  <button
                                    key={st.type}
                                    type="button"
                                    onClick={() => setSubmissionType(st.type)}
                                    className={`px-3 py-1.5 border-2 border-brand-dark font-mono text-xs font-bold transition-all ${
                                      submissionType === st.type
                                        ? 'bg-brand-teal text-white shadow-brutal-xs -translate-y-0.5'
                                        : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
                                    }`}
                                  >
                                    {st.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Submission Type 1: Link */}
                            {submissionType === 'link' && (
                              <div className="space-y-1 animate-fadeIn">
                                <label className="font-mono text-xs font-bold text-brand-navy block">
                                  Resource or Repository URL (must start with https://)
                                </label>
                                <input
                                  type="url"
                                  placeholder="https://github.com/... or https://docs.google.com/..."
                                  value={linkUrl}
                                  onChange={(e) => setLinkUrl(e.target.value)}
                                  className="w-full px-3 py-2 border-2 border-brand-dark font-mono text-xs sm:text-sm bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                                  required
                                />
                              </div>
                            )}

                            {/* Submission Type 2: File Attachment */}
                            {submissionType === 'file' && (
                              <div className="space-y-2 animate-fadeIn">
                                <label className="font-mono text-xs font-bold text-brand-navy block">
                                  Attach Document (PDF, PNG, JPG, WebP, or DOCX — max 10MB)
                                </label>

                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                                  onChange={handleFileSelect}
                                  className="hidden"
                                  id={`library-file-input-${assignment.id}`}
                                />

                                {selectedFile ? (
                                  <div className="p-3 border-2 border-brand-dark bg-brand-paper flex flex-wrap items-center justify-between gap-3 shadow-brutal-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileUp className="w-4 h-4 text-brand-teal shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                          {selectedFile.name}
                                        </span>
                                        <span className="font-mono text-[10px] text-brand-muted">
                                          {formatFileSize(selectedFile.size)} (Ready to upload)
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {selectedFileObjectUrl && (
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setViewerModal({
                                              isOpen: true,
                                              fileName: selectedFile.name,
                                              filePath: null,
                                              fileUrl: selectedFileObjectUrl,
                                              fileSize: selectedFile.size,
                                              loading: false,
                                              error: null,
                                            })
                                          }
                                        >
                                          Preview
                                        </Button>
                                      )}
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRemoveSelectedFile}
                                      >
                                        Remove
                                      </Button>
                                    </div>
                                  </div>
                                ) : fileName ? (
                                  <div className="p-3 border-2 border-brand-dark bg-brand-paper flex flex-wrap items-center justify-between gap-3 shadow-brutal-xs">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Paperclip className="w-4 h-4 text-brand-teal shrink-0" />
                                      <div className="min-w-0">
                                        <span className="font-mono text-xs font-bold text-brand-navy truncate block">
                                          Current: {fileName}
                                        </span>
                                        {fileSize && (
                                          <span className="font-mono text-[10px] text-brand-muted">
                                            {formatFileSize(fileSize)}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <label
                                      htmlFor={`library-file-input-${assignment.id}`}
                                      className="px-3 py-1.5 border-2 border-brand-dark font-mono text-xs font-bold bg-brand-paper hover:bg-brand-bg shadow-brutal-xs cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                      <span>Replace File</span>
                                    </label>
                                  </div>
                                ) : (
                                  <label
                                    htmlFor={`library-file-input-${assignment.id}`}
                                    className="p-4 border-2 border-dashed border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-center block cursor-pointer transition-colors shadow-brutal-xs"
                                  >
                                    <FileUp className="w-6 h-6 text-brand-muted mx-auto mb-1" />
                                    <span className="font-mono text-xs font-bold text-brand-navy block">
                                      Click to choose an academic solution file
                                    </span>
                                    <span className="font-mono text-[10px] text-brand-muted block mt-0.5">
                                      PDF, PNG, JPG, WebP, DOCX up to 10MB
                                    </span>
                                  </label>
                                )}
                              </div>
                            )}

                            {/* Notes / Written Explanation Textarea */}
                            <div className="space-y-1">
                              <label className="font-mono text-xs font-bold text-brand-navy block">
                                {submissionType === 'text'
                                  ? 'Solution Derivation & Answers'
                                  : 'Submission Notes & Observations (Optional)'}
                              </label>
                              <textarea
                                rows={4}
                                placeholder={
                                  submissionType === 'text'
                                    ? 'Enter your complete mathematical derivation, answer steps, or code solution here...'
                                    : 'Add any notes, assumptions, or questions for your mentor regarding this submission...'
                                }
                                value={textContent}
                                onChange={(e) => setTextContent(e.target.value)}
                                className="w-full p-3 border-2 border-brand-dark font-mono text-xs bg-brand-paper focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs leading-relaxed"
                              />
                            </div>

                            {/* Form Action Buttons */}
                            <div className="pt-2 flex items-center justify-end gap-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setActiveAssignmentId(null)}
                                disabled={submitting}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                variant="primary"
                                size="sm"
                                disabled={submitting}
                                leftIcon={
                                  submitting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )
                                }
                              >
                                {submitting ? 'Submitting...' : 'Turn in Assignment'}
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: EVALUATIONS & CHECKPOINTS (Milestone 12)                           */}
      {/* ========================================================================= */}
      {activeTab === 'evaluations' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Milestone 12 Evaluation Integration Banner */}
          <div className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs uppercase font-bold text-brand-teal bg-brand-bg px-2 py-0.5 border border-brand-dark">
                  ACADEMIC LIBRARY • TAB 4
                </span>
                <span className="font-mono text-[10px] font-bold text-brand-muted uppercase">
                  MILESTONE 12 INTEGRATION
                </span>
              </div>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                Periodic Check-ins &amp; Evaluated Milestones
              </h3>
              <p className="font-sans text-xs text-brand-muted max-w-2xl leading-relaxed">
                Review scheduled checkpoints, oral walkthroughs, and graded feedback recorded by your mentor. Every evaluation tests concept comprehension and provides actionable recommendations to refine your study roadmap.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link to="/student/reports">
                <Button variant="primary" size="sm" className="flex items-center gap-1.5 shadow-brutal-xs">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Progress Reports</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={loadEvaluations}
                disabled={evaluationsLoading}
                className="flex items-center gap-1.5"
                title="Refresh evaluations"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${evaluationsLoading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">TOTAL REVIEWS</span>
                <Calendar className="w-4 h-4 text-brand-navy stroke-[2.2]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                {evalMetrics.total}
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-0.5">Assigned check-ins</span>
            </div>

            <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">COMPLETED</span>
                <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.2]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-teal">
                {evalMetrics.completed}
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-0.5">Milestones verified</span>
            </div>

            <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">SCHEDULED</span>
                <Clock className="w-4 h-4 text-brand-gold stroke-[2.2]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-dark">
                {evalMetrics.scheduled}
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-0.5">Upcoming sessions</span>
            </div>

            <div className="p-3.5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">AVERAGE SCORE</span>
                <Award className="w-4 h-4 text-brand-navy stroke-[2.2]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                {evalMetrics.avgScore !== null ? `${evalMetrics.avgScore}%` : '—'}
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-0.5">
                {evalMetrics.avgScore !== null ? 'Concept retention' : 'Awaiting scored sessions'}
              </span>
            </div>
          </div>

          {/* Filter Bar */}
          <section className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-muted pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search evaluations, mentor feedback, recommendations..."
                  value={evaluationSearch}
                  onChange={(e) => setEvaluationSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-brand-dark bg-brand-bg font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              {/* Subject Filter */}
              <div className="w-full md:w-52">
                <select
                  aria-label="Filter evaluations by subject"
                  value={evaluationSubjectFilter}
                  onChange={(e) => setEvaluationSubjectFilter(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-brand-dark bg-brand-bg font-mono text-xs font-bold text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="all">All Study Areas ({evaluations.length})</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-44">
                <select
                  aria-label="Filter evaluations by status"
                  value={evaluationStatusFilter}
                  onChange={(e) => setEvaluationStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-brand-dark bg-brand-bg font-mono text-xs font-bold text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="all">All Statuses</option>
                  <option value="scheduled">Scheduled Check-ins</option>
                  <option value="completed">Completed &amp; Graded</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {/* Format Filter */}
              <div className="w-full md:w-44">
                <select
                  aria-label="Filter evaluations by format"
                  value={evaluationFormatFilter}
                  onChange={(e) => setEvaluationFormatFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border-2 border-brand-dark bg-brand-bg font-mono text-xs font-bold text-brand-dark focus:outline-none focus:ring-1 focus:ring-brand-teal"
                >
                  <option value="all">All Formats</option>
                  <option value="oral">Oral Walkthrough</option>
                  <option value="written">Written Review</option>
                  <option value="practical">Practical Checkpoint</option>
                  <option value="quiz">Interactive Quiz</option>
                </select>
              </div>
            </div>

            {/* Date Preset Controls */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-dark/15 text-xs font-mono">
              <span className="text-brand-muted font-bold text-[10px] uppercase mr-1">Date Horizon:</span>
              {(['all', 'today', 'this_week', 'this_month', 'custom_range'] as LibraryDatePreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEvaluationDatePreset(preset)}
                  className={`px-2.5 py-1 border border-brand-dark font-mono text-xs font-bold transition-all ${
                    evaluationDatePreset === preset
                      ? 'bg-brand-navy text-white shadow-brutal-xs'
                      : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
                  }`}
                >
                  {preset === 'all'
                    ? 'All Time'
                    : preset === 'today'
                    ? 'Today'
                    : preset === 'this_week'
                    ? 'This Week'
                    : preset === 'this_month'
                    ? 'This Month'
                    : 'Custom Range'}
                </button>
              ))}

              {evaluationDatePreset === 'custom_range' && (
                <div className="flex items-center gap-1.5 ml-2">
                  <input
                    type="date"
                    value={evaluationCustomStartDate}
                    onChange={(e) => setEvaluationCustomStartDate(e.target.value)}
                    className="px-2 py-0.5 border border-brand-dark bg-brand-bg text-xs font-mono"
                    aria-label="Custom Start Date"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={evaluationCustomEndDate}
                    onChange={(e) => setEvaluationCustomEndDate(e.target.value)}
                    className="px-2 py-0.5 border border-brand-dark bg-brand-bg text-xs font-mono"
                    aria-label="Custom End Date"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Evaluations Feed */}
          {evaluationsLoading ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin mx-auto" />
              <p className="font-heading font-extrabold text-sm text-brand-navy">
                LOADING EVALUATION CHECKPOINTS
              </p>
              <span className="font-mono text-xs text-brand-muted block">
                Retrieving scheduled reviews and calibrated milestones...
              </span>
            </div>
          ) : evaluationsError ? (
            <div className="p-6 border-2 border-brand-dark bg-red-50 text-red-900 shadow-brutal flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-heading font-bold text-sm block">Failed to load evaluations</span>
                <p className="font-mono text-xs text-red-800">{evaluationsError}</p>
                <Button variant="outline" size="sm" onClick={loadEvaluations} className="mt-2">
                  Retry
                </Button>
              </div>
            </div>
          ) : filteredEvaluations.length > 0 ? (
            <div className="space-y-4">
              {filteredEvaluations.map((item) => {
                const isCompleted = item.status === 'completed';
                const isScheduled = item.status === 'scheduled';
                const scorePct =
                  isCompleted && typeof item.score === 'number' && item.total_points
                    ? Math.round((item.score / item.total_points) * 100)
                    : null;

                return (
                  <div
                    key={item.id}
                    className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={item.format === 'oral' ? 'teal' : item.format === 'written' ? 'gold' : 'navy'}
                            size="sm"
                          >
                            {(item.format || 'session').toUpperCase()} ASSESSMENT
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
                              Plan: {item.plan_title}
                            </span>
                          )}
                        </div>

                        <h4 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                          {item.title}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-brand-muted">
                          <span className="flex items-center gap-1 text-brand-dark font-medium">
                            <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                            {item.scheduled_date} {item.scheduled_time ? `at ${item.scheduled_time}` : ''}
                          </span>
                          <span>•</span>
                          <span>Duration: {item.duration_minutes || 30} mins</span>
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

                      {/* Recorded Score Box */}
                      {isCompleted && item.score !== null && item.score !== undefined && (
                        <div className="shrink-0 text-right p-3 border-2 border-brand-dark bg-brand-teal-light shadow-brutal-xs min-w-[140px]">
                          <span className="font-mono text-[10px] uppercase font-bold text-brand-navy block">
                            EVALUATION SCORE
                          </span>
                          <div className="font-heading font-extrabold text-2xl text-brand-navy">
                            {item.score}
                            <span className="text-xs font-mono font-normal text-brand-muted">
                              {' '}/ {item.total_points || 100}
                            </span>
                          </div>
                          {scorePct !== null && (
                            <div className="font-mono text-[10px] font-bold text-brand-teal mt-0.5">
                              {scorePct}% Mastery
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Scope & Description */}
                    {item.description && (
                      <div className="p-3 border border-brand-dark/20 bg-brand-paper-tint text-xs space-y-1 leading-relaxed">
                        <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                          Scope &amp; Focus Area:
                        </span>
                        <p className="font-sans text-brand-dark">{item.description}</p>
                      </div>
                    )}

                    {/* Scheduled Callout */}
                    {isScheduled && (
                      <div className="p-3.5 border-2 border-dashed border-brand-gold/80 bg-brand-gold-light/40 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 text-xs">
                          <span className="font-heading font-bold text-brand-navy block">
                            Upcoming Check-in Session
                          </span>
                          <p className="text-brand-muted leading-relaxed">
                            Scheduled for {item.scheduled_date}. Prepare questions, formulas, and homework proofs in advance. Your mentor will walk through practice challenges and answer your Doubts Desk queries.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Mentor Feedback & Recommendation */}
                    {isCompleted && item.feedback && (
                      <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs space-y-2.5">
                        <div className="flex items-center justify-between border-b border-brand-dark/20 pb-2">
                          <span className="font-mono text-xs font-bold text-brand-navy uppercase flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-brand-gold" />
                            Mentor Assessment &amp; Retention Notes
                          </span>
                          {item.evaluated_at && (
                            <span className="font-mono text-[10px] text-brand-muted">
                              Evaluated: {new Date(item.evaluated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-sans text-brand-dark leading-relaxed whitespace-pre-line">
                          {item.feedback}
                        </p>

                        {item.recommendation && (
                          <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1 mt-2">
                            <span className="font-mono text-[10px] uppercase font-extrabold text-brand-teal flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Actionable Recommendation &amp; Adjustments:
                            </span>
                            <p className="text-xs font-sans text-brand-dark leading-relaxed">
                              {item.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 border-2 border-dashed border-brand-dark/30 bg-brand-paper text-center space-y-3">
              <Calendar className="w-10 h-10 text-brand-muted mx-auto stroke-[1.5]" />
              <div className="space-y-1">
                <h4 className="font-heading font-extrabold text-base text-brand-navy">
                  No evaluations match selected filters
                </h4>
                <p className="font-sans text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
                  {evaluations.length === 0
                    ? 'No evaluation sessions or graded reviews have been scheduled by your mentor yet. Check back once your mentor assigns your first milestone checkpoint.'
                    : 'Try clearing your search query, adjusting the date range, or resetting status filters to view historical check-ins.'}
                </p>
              </div>
              {(evaluationSearch || evaluationSubjectFilter !== 'all' || evaluationStatusFilter !== 'all' || evaluationFormatFilter !== 'all' || evaluationDatePreset !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEvaluationSearch('');
                    setEvaluationSubjectFilter('all');
                    setEvaluationStatusFilter('all');
                    setEvaluationFormatFilter('all');
                    setEvaluationDatePreset('all');
                  }}
                  className="mt-2"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. RESOURCE DETAIL / NOTE MODAL (TAB 1)                                   */}
      {/* ========================================================================= */}
      {activeResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-brand-paper border-2 border-brand-dark shadow-brutal flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant={
                      activeResource.resource_type === 'note'
                        ? 'gold'
                        : activeResource.resource_type === 'link'
                        ? 'teal'
                        : 'navy'
                    }
                    size="sm"
                  >
                    {activeResource.resource_type.toUpperCase()}
                  </Badge>
                  {activeResource.subject_name && (
                    <span className="font-mono text-xs font-bold text-brand-navy">
                      {activeResource.subject_name}
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
                  {activeResource.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveResource(null)}
                className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
                title="Close"
              >
                <X className="w-5 h-5 text-brand-dark" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {activeResource.description && (
                <div>
                  <h4 className="font-mono text-xs uppercase font-bold text-brand-muted mb-1">
                    Description & Syllabus Scope
                  </h4>
                  <p className="font-sans text-xs sm:text-sm text-brand-dark leading-relaxed">
                    {activeResource.description}
                  </p>
                </div>
              )}

              {activeResource.resource_type === 'note' && activeResource.content && (
                <div>
                  <h4 className="font-mono text-xs uppercase font-bold text-brand-muted mb-1 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-brand-teal" />
                    Reference Formulas & Notes
                  </h4>
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint font-mono text-xs text-brand-dark whitespace-pre-wrap shadow-brutal-xs leading-relaxed">
                    {activeResource.content}
                  </div>
                </div>
              )}

              {activeResource.resource_type === 'file' && (
                <div className="p-3 border border-brand-dark bg-brand-paper flex items-center justify-between text-xs font-mono shadow-brutal-xs">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-teal" />
                    <span className="font-bold">{activeResource.file_name || 'Document'}</span>
                  </div>
                  {activeResource.file_size && (
                    <span className="text-brand-muted">{formatFileSize(activeResource.file_size)}</span>
                  )}
                </div>
              )}

              {activeResource.url && (
                <div className="p-3 border border-brand-dark bg-brand-bg flex items-center justify-between gap-2 shadow-brutal-xs">
                  <div className="truncate font-mono text-xs text-brand-navy">
                    <span className="font-bold block text-brand-muted text-[10px]">TARGET URL:</span>
                    <span className="truncate">{activeResource.url}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(activeResource.url!, activeResource.id)}
                      className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
                      title="Copy Link"
                    >
                      {copiedId === activeResource.id ? (
                        <Check className="w-3.5 h-3.5 text-green-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-brand-dark" />
                      )}
                    </button>
                    <a
                      href={activeResource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 border border-brand-dark bg-brand-teal text-white font-mono text-xs font-bold shadow-brutal-xs inline-flex items-center gap-1"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-brand-dark/15 text-[11px] font-mono text-brand-muted flex flex-wrap items-center justify-between gap-2">
                <span>
                  {activeResource.mentor_name
                    ? `Curated by: ${activeResource.mentor_name}`
                    : 'PoraPlan Reference'}
                </span>
                <span>
                  Published: {new Date(activeResource.created_at || '').toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t-2 border-brand-dark bg-brand-bg flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveResource(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. UNIFIED ATTACHMENT VIEWER MODAL (TABS 2 & 3)                           */}
      {/* ========================================================================= */}
      <AttachmentViewerModal
        isOpen={viewerModal.isOpen}
        onClose={() => setViewerModal((prev) => ({ ...prev, isOpen: false }))}
        fileName={viewerModal.fileName}
        fileUrl={viewerModal.fileUrl}
        fileSize={viewerModal.fileSize}
        loading={viewerModal.loading}
        error={viewerModal.error}
        onDownload={
          viewerModal.filePath
            ? () =>
                handleDownloadAttachment({
                  name: viewerModal.fileName,
                  path: viewerModal.filePath,
                })
            : undefined
        }
      />
    </div>
  );
};
