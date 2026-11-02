import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  type TaskWithMeta,
  type StudentTaskFilters,
} from '../../lib/tasks';
import { getAcademicFileSignedUrl } from '../../lib/storage';
import { AttachmentViewerModal } from '../../components/common/AttachmentViewerModal';
import {
  parseLibraryTab,
  type AcademicLibraryTab,
} from '../../lib/library';
import type { Subject, TaskStatus } from '../../types/database';
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
} from 'lucide-react';

type DatePreset = 'all' | 'today' | 'this_week' | 'this_month' | 'specific_date' | 'custom_range';

export const StudentLibraryPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  // Tab State synchronized with URL query parameter (?tab=resources|tasks|assignments)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: AcademicLibraryTab = parseLibraryTab(searchParams.get('tab'));

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
    () => new Date().toISOString().split('T')[0]
  );
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Attachment Viewer Modal State
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

  // Load Subjects
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
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    switch (datePreset) {
      case 'today':
        return { startDate: todayStr, endDate: todayStr };

      case 'this_week': {
        const day = today.getDay(); // 0 is Sunday
        const diffToMonday = (day + 6) % 7;
        const monday = new Date(today);
        monday.setDate(today.getDate() - diffToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          startDate: monday.toISOString().split('T')[0],
          endDate: sunday.toISOString().split('T')[0],
        };
      }

      case 'this_month': {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        return {
          startDate: firstDay.toISOString().split('T')[0],
          endDate: lastDay.toISOString().split('T')[0],
        };
      }

      case 'specific_date':
        return selectedSpecificDate
          ? { startDate: selectedSpecificDate, endDate: selectedSpecificDate }
          : {};

      case 'custom_range':
        return {
          startDate: customStartDate || undefined,
          endDate: customEndDate || undefined,
        };

      case 'all':
      default:
        return {};
    }
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

    // PostgREST filter for explicit database statuses ('pending' | 'in_progress' | 'completed')
    // If 'overdue', we fetch all and filter in client (since overdue is due_date < today AND status != completed)
    if (taskStatusFilter !== 'all' && taskStatusFilter !== 'overdue') {
      queryFilters.status = taskStatusFilter as TaskStatus;
    }

    getStudentTasks(studentId, queryFilters)
      .then((res) => {
        if (res.error) {
          setTasksError(res.error.message);
        } else {
          setTasks(res.tasks);
        }
        setTasksLoading(false);
      })
      .catch((err: unknown) => {
        setTasksError(err instanceof Error ? err.message : 'Failed to load task history.');
        setTasksLoading(false);
      });
  }, [studentId, computeDateRange, taskSubjectFilter, taskStatusFilter]);

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

  // Attachment Preview Handler
  const handlePreviewAttachment = async (attachment: {
    name?: string | null;
    size?: number | null;
    path?: string | null;
  }) => {
    const name = attachment.name || 'task-attachment';
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

  // Attachment Download Handler
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

  // Filtered Tasks for Display (includes client text search & overdue check)
  const filteredTasks = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const q = taskSearch.trim().toLowerCase();

    return tasks.filter((task) => {
      // Overdue filter check
      if (taskStatusFilter === 'overdue') {
        const isOverdue = task.due_date && task.due_date < todayStr && task.status !== 'completed';
        if (!isOverdue) return false;
      }

      // Quick text search
      if (q) {
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q) || false;
        const matchesSubject = task.subject_name?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesDesc && !matchesSubject) return false;
      }

      return true;
    });
  }, [tasks, taskStatusFilter, taskSearch]);

  // Compute Task Statistics
  const taskStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const pending = tasks.filter((t) => t.status === 'pending').length;
    const overdue = tasks.filter(
      (t) => t.due_date && t.due_date < todayStr && t.status !== 'completed'
    ).length;

    return { total, completed, inProgress, pending, overdue };
  }, [tasks]);

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
              {resources.length}
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
              {tasks.length}
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
                  {datePreset === 'today' && `Today (${new Date().toISOString().split('T')[0]})`}
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
                const todayStr = new Date().toISOString().split('T')[0];
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
      {/* TAB 3: ASSIGNMENTS & SUBMISSIONS (FOUNDATION / PLACEHOLDER)               */}
      {/* ========================================================================= */}
      {activeTab === 'assignments' && (
        <div className="space-y-6 animate-fadeIn">
          <section className="p-6 sm:p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-brand-dark/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="gold" size="sm">
                    INTEGRATION IN PROGRESS
                  </Badge>
                  <span className="font-mono text-xs text-brand-muted">Milestone 5 Foundation</span>
                </div>
                <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                  Assignments & Submissions Portfolio
                </h2>
                <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-2xl">
                  Practice problem sets, homework submissions, and mentor grading feedback are being unified here. You will be able to submit work, review scores, and track your revision status in one integrated view.
                </p>
              </div>

              <Link to="/student/assignments" className="shrink-0">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  Go to Practice Assignments
                </Button>
              </Link>
            </div>

            {/* Feature Previews */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
                  <Layers className="w-4 h-4 text-brand-coral" />
                  <span>Practice Problem Sets</span>
                </div>
                <p className="font-sans text-xs text-brand-muted">
                  Structured homework instructions, point allocations, due dates, and curriculum plan linkages.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal" />
                  <span>Mentor Reviews & Scores</span>
                </div>
                <p className="font-sans text-xs text-brand-muted">
                  Review graded scores, qualitative mentor feedback comments, and revision requests.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
                  <Paperclip className="w-4 h-4 text-brand-gold" />
                  <span>Submission Attachments</span>
                </div>
                <p className="font-sans text-xs text-brand-muted">
                  Upload PDF, Word, or image homework submissions with live in-app attachment preview and downloads.
                </p>
              </div>
            </div>
          </section>
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
      {/* 5. ATTACHMENT VIEWER MODAL (TAB 2)                                        */}
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
