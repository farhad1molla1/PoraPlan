import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentResources,
  type ResourceWithMeta,
} from '../../lib/resources';
import { getStudentSubjects } from '../../lib/subjects';
import {
  parseLibraryTab,
  type AcademicLibraryTab,
} from '../../lib/library';
import type { Subject, ResourceType } from '../../types/database';
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
  Compass,
  ListTodo,
  ArrowRight,
  Calendar,
  Clock,
  Layers,
  Paperclip,
  CheckCircle2,
} from 'lucide-react';

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
        next.set('tab', tab);
        return next;
      },
      { replace: false }
    );
  };

  // Study Resources State
  const [resources, setResources] = useState<ResourceWithMeta[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | ResourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal State for viewing note/resource details
  const [activeResource, setActiveResource] = useState<ResourceWithMeta | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [resRes, subjRes] = await Promise.all([
          getStudentResources(studentId),
          getStudentSubjects(studentId),
        ]);

        if (!isMounted) return;

        if (resRes.error) {
          setErrorMessage(resRes.error.message);
        } else {
          setResources(resRes.resources);
        }

        if (subjRes.subjects) {
          setSubjects(subjRes.subjects);
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
    const { resources: list, error } = await getStudentResources(studentId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setResources(list);
    }
    setRefreshing(false);
  };

  const handleCopyLink = (url: string, id: string) => {
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredResources = resources.filter((res) => {
    if (selectedSubjectId !== 'all' && res.subject_id !== selectedSubjectId) {
      return false;
    }
    if (selectedType !== 'all' && res.resource_type !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = res.title.toLowerCase().includes(q);
      const matchDesc = res.description ? res.description.toLowerCase().includes(q) : false;
      const matchContent = res.content ? res.content.toLowerCase().includes(q) : false;
      const matchSubj = res.subject_name ? res.subject_name.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchDesc && !matchContent && !matchSubj) {
        return false;
      }
    }
    return true;
  });

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn pb-12 max-w-7xl mx-auto">
      {/* ========================================================================= */}
      {/* 1. PAGE HEADER                                                            */}
      {/* ========================================================================= */}
      <section className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="font-mono text-xs uppercase font-bold text-brand-muted bg-brand-bg px-2 py-0.5 border border-brand-dark">
              ACADEMIC REPOSITORY
            </span>
            {profile?.poraplan_id && (
              <span className="font-mono text-xs font-bold text-brand-teal px-2 py-0.5 border border-brand-dark bg-brand-paper shadow-brutal-xs">
                STUDENT ID: {profile.poraplan_id}
              </span>
            )}
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            Academic Library
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-1 max-w-2xl">
            Unified academic curriculum, daily task history, and assignment portfolio curated for your studies.
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
            {refreshing ? 'Updating...' : 'Refresh Library'}
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
            <h4 className="font-heading font-bold text-sm">Error Loading Library</h4>
            <p className="font-mono text-xs mt-1 text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. THREE-TAB NAVIGATION BAR                                               */}
      {/* ========================================================================= */}
      <nav aria-label="Academic Library Tabs" className="border-b-2 border-brand-dark pb-px">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {/* Tab 1: Study Resources */}
          <button
            type="button"
            onClick={() => handleTabChange('resources')}
            className={`flex items-center gap-2 px-4 py-2.5 font-heading text-xs sm:text-sm font-bold border-2 transition-all whitespace-nowrap ${
              activeTab === 'resources'
                ? 'border-brand-dark bg-brand-navy text-brand-paper shadow-brutal -translate-y-0.5'
                : 'border-brand-dark bg-brand-paper text-brand-dark/80 hover:bg-brand-paper-tint hover:text-brand-dark'
            }`}
          >
            <BookOpen className="w-4 h-4 text-brand-gold shrink-0" />
            <span>Study Resources</span>
            <span
              className={`font-mono text-[10px] px-1.5 py-0.2 border ${
                activeTab === 'resources'
                  ? 'border-brand-gold/50 bg-brand-navy text-brand-gold'
                  : 'border-brand-dark/30 bg-brand-bg text-brand-dark'
              }`}
            >
              {resources.length}
            </span>
          </button>

          {/* Tab 2: Tasks & Study History */}
          <button
            type="button"
            onClick={() => handleTabChange('tasks')}
            className={`flex items-center gap-2 px-4 py-2.5 font-heading text-xs sm:text-sm font-bold border-2 transition-all whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'border-brand-dark bg-brand-navy text-brand-paper shadow-brutal -translate-y-0.5'
                : 'border-brand-dark bg-brand-paper text-brand-dark/80 hover:bg-brand-paper-tint hover:text-brand-dark'
            }`}
          >
            <ListTodo className="w-4 h-4 text-brand-teal shrink-0" />
            <span>Tasks & Study History</span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 border border-brand-teal/40 bg-brand-teal/10 text-brand-teal font-semibold">
              Preview
            </span>
          </button>

          {/* Tab 3: Assignments & Submissions */}
          <button
            type="button"
            onClick={() => handleTabChange('assignments')}
            className={`flex items-center gap-2 px-4 py-2.5 font-heading text-xs sm:text-sm font-bold border-2 transition-all whitespace-nowrap ${
              activeTab === 'assignments'
                ? 'border-brand-dark bg-brand-navy text-brand-paper shadow-brutal -translate-y-0.5'
                : 'border-brand-dark bg-brand-paper text-brand-dark/80 hover:bg-brand-paper-tint hover:text-brand-dark'
            }`}
          >
            <FileText className="w-4 h-4 text-brand-coral shrink-0" />
            <span>Assignments & Submissions</span>
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.2 border border-brand-coral/40 bg-brand-coral/10 text-brand-coral font-semibold">
              Preview
            </span>
          </button>
        </div>
      </nav>

      {/* ========================================================================= */}
      {/* 3. TAB CONTENT                                                            */}
      {/* ========================================================================= */}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 1: STUDY RESOURCES (FULLY FUNCTIONAL)                                 */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'resources' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Filter & Search Toolbar */}
          <section className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  placeholder="Search resources, topics, formulas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border-2 border-brand-dark bg-white font-sans text-xs sm:text-sm text-brand-dark placeholder:text-brand-muted focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Subject Filter */}
              <div className="flex items-center gap-2">
                <label htmlFor="subject-filter" className="font-mono text-xs font-bold text-brand-muted shrink-0">
                  SUBJECT:
                </label>
                <select
                  id="subject-filter"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="px-2.5 py-2 border-2 border-brand-dark bg-white font-mono text-xs text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs cursor-pointer"
                >
                  <option value="all">All Subjects ({resources.length})</option>
                  {subjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Type Filter Pills */}
            <div className="pt-2 border-t border-brand-dark/15 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-brand-muted mr-1">TYPE:</span>
              {(['all', 'link', 'note', 'file'] as const).map((type) => {
                const count =
                  type === 'all'
                    ? resources.length
                    : resources.filter((r) => r.resource_type === type).length;
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`font-mono text-xs font-bold px-2.5 py-1 border transition-all ${
                      isSelected
                        ? 'border-brand-dark bg-brand-teal text-white shadow-brutal-xs -translate-y-0.5'
                        : 'border-brand-dark/40 bg-brand-bg text-brand-dark hover:border-brand-dark hover:bg-brand-paper'
                    }`}
                  >
                    {type.toUpperCase()} ({count})
                  </button>
                );
              })}
            </div>
          </section>

          {/* Resources Grid */}
          {loading ? (
            <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-8 h-8 text-brand-teal animate-spin" />
              <p className="font-mono text-xs text-brand-muted">Loading study resources...</p>
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="p-8 sm:p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
              <BookOpen className="w-10 h-10 text-brand-muted mx-auto" />
              <h3 className="font-heading font-extrabold text-base text-brand-navy">
                No Study Resources Found
              </h3>
              <p className="font-sans text-xs text-brand-muted max-w-sm mx-auto">
                {searchQuery || selectedSubjectId !== 'all' || selectedType !== 'all'
                  ? 'No resources match your active search or filter criteria.'
                  : 'Your mentor has not added any study resources for your enrolled subjects yet.'}
              </p>
              {(searchQuery || selectedSubjectId !== 'all' || selectedType !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedSubjectId('all');
                    setSelectedType('all');
                  }}
                  className="font-mono text-xs text-brand-teal font-bold hover:underline"
                >
                  Reset all filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredResources.map((res) => (
                <div
                  key={res.id}
                  className="p-4 sm:p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between"
                >
                  <div>
                    {/* Badges & Meta */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
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
                          <span className="font-mono text-[10px] font-bold text-brand-navy bg-brand-bg px-1.5 py-0.5 border border-brand-dark">
                            {res.subject_name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Description */}
                    <h3 className="font-heading font-extrabold text-base text-brand-navy leading-snug">
                      {res.title}
                    </h3>
                    {res.description && (
                      <p className="font-sans text-xs text-brand-muted mt-1.5 line-clamp-2">
                        {res.description}
                      </p>
                    )}

                    {/* Study Plan Link if any */}
                    {res.plan_title && (
                      <div className="mt-2.5 flex items-center gap-1 text-[11px] font-mono text-brand-teal font-semibold">
                        <Compass className="w-3 h-3" />
                        <span className="truncate">Plan: {res.plan_title}</span>
                      </div>
                    )}

                    {/* Content snippet preview for notes */}
                    {res.resource_type === 'note' && res.content && (
                      <div className="mt-3 p-2 border border-brand-dark bg-brand-paper-tint font-mono text-[11px] text-brand-dark line-clamp-3 whitespace-pre-line shadow-brutal-xs">
                        {res.content}
                      </div>
                    )}

                    {/* File metadata info (Clearly presented as reference document, not a downloadable attachment) */}
                    {res.resource_type === 'file' && res.file_name && (
                      <div className="mt-3 p-2 border border-brand-dark bg-brand-paper-tint font-mono text-[11px] text-brand-navy flex items-center justify-between shadow-brutal-xs">
                        <span className="truncate flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                          <span className="truncate">{res.file_name}</span>
                        </span>
                        {res.file_size && (
                          <span className="text-[10px] text-brand-muted shrink-0 ml-2">
                            {formatFileSize(res.file_size)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-4 pt-3 border-t border-brand-dark/20 flex items-center justify-between gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveResource(res)}
                      leftIcon={
                        res.resource_type === 'note' ? (
                          <FileCode className="w-3.5 h-3.5" />
                        ) : (
                          <BookOpen className="w-3.5 h-3.5" />
                        )
                      }
                    >
                      {res.resource_type === 'note' ? 'Read Note' : 'Details'}
                    </Button>

                    {res.url ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(res.url!, res.id)}
                          className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs"
                          title="Copy URL"
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

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 2: TASKS & STUDY HISTORY (FOUNDATION / PLACEHOLDER)                   */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'tasks' && (
        <div className="space-y-6 animate-fadeIn">
          <section className="p-6 sm:p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-brand-dark/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="teal" size="sm">
                    INTEGRATION IN PROGRESS
                  </Badge>
                  <span className="font-mono text-xs text-brand-muted">Milestone 4 Foundation</span>
                </div>
                <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                  Tasks & Study History
                </h2>
                <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-2xl">
                  Your daily targets and complete study activity log are being consolidated into this tab. You will be able to browse tasks by scheduled date, filter across past study history, and download reference attachments.
                </p>
              </div>

              <Link to="/student/tasks" className="shrink-0">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-4 h-4" />}>
                  View Today's Tasks
                </Button>
              </Link>
            </div>

            {/* Feature Previews */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
                  <Clock className="w-4 h-4 text-brand-teal" />
                  <span>Daily Study Targets</span>
                </div>
                <p className="font-sans text-xs text-brand-muted">
                  Interactive checklist for today's scheduled tasks with instant completion toggling and time tracking.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
                  <Calendar className="w-4 h-4 text-brand-gold" />
                  <span>Scheduled Date History</span>
                </div>
                <p className="font-sans text-xs text-brand-muted">
                  Review historical activity by day, week, month, or custom date ranges without cluttered pagination.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
                  <Paperclip className="w-4 h-4 text-brand-coral" />
                  <span>Task Attachments</span>
                </div>
                <p className="font-sans text-xs text-brand-muted">
                  Instant secure preview and download for reference documents, problem sheets, and diagrams uploaded by your mentor.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB 3: ASSIGNMENTS & SUBMISSIONS (FOUNDATION / PLACEHOLDER)               */}
      {/* ------------------------------------------------------------------------- */}
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
      {/* 4. RESOURCE DETAIL / NOTE MODAL                                           */}
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
    </div>
  );
};
