import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentDoubts,
  createDoubt,
  addDoubtResponse,
  updateDoubtStatus,
  type DoubtWithMeta,
} from '../../lib/doubts';
import { getStudentSubjects } from '../../lib/subjects';
import { getStudentStudyPlans } from '../../lib/studyPlans';
import { getStudentTasks } from '../../lib/tasks';
import type { Subject, StudyPlan, Task, DoubtStatus, DoubtPriority } from '../../types/database';
import { Button } from '../../components/common/Button';
import {
  HelpCircle,
  Plus,
  Search,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  X,
  Send,
  RefreshCw,
  Loader2,
  Calendar,
  Check,
} from 'lucide-react';

export const StudentDoubtsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  const [doubts, setDoubts] = useState<DoubtWithMeta[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DoubtStatus>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState<DoubtPriority>('normal');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Detail / Thread Modal
  const [activeDoubt, setActiveDoubt] = useState<DoubtWithMeta | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    if (!studentId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [doubtsRes, subjsRes, plansRes, tasksRes] = await Promise.all([
          getStudentDoubts(studentId),
          getStudentSubjects(studentId),
          getStudentStudyPlans(studentId),
          getStudentTasks(studentId),
        ]);

        if (!isMounted) return;

        if (doubtsRes.error) {
          setErrorMessage(doubtsRes.error.message);
        } else {
          setDoubts(doubtsRes.doubts);
        }

        if (subjsRes.subjects) setSubjects(subjsRes.subjects);
        if (plansRes.plans) setStudyPlans(plansRes.plans);
        if (tasksRes.tasks) setTasks(tasksRes.tasks);
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
    const { doubts: list, error } = await getStudentDoubts(studentId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setDoubts(list);
      // update activeDoubt if currently viewed
      if (activeDoubt) {
        const updated = list.find((d) => d.id === activeDoubt.id);
        if (updated) setActiveDoubt(updated);
      }
    }
    setRefreshing(false);
  };

  const handleCreateDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;

    const cleanTitle = title.trim();
    const cleanQuestion = question.trim();

    if (!cleanTitle) {
      setCreateError('Please enter a concise inquiry title.');
      return;
    }
    if (!cleanQuestion) {
      setCreateError('Please describe your question or conceptual doubt in detail.');
      return;
    }

    setSubmittingCreate(true);
    setCreateError(null);

    const { doubt: newDoubt, error } = await createDoubt({
      studentId,
      title: cleanTitle,
      question: cleanQuestion,
      priority,
      subjectId: selectedSubjectId || undefined,
      planId: selectedPlanId || undefined,
      taskId: selectedTaskId || undefined,
    });

    setSubmittingCreate(false);

    if (error) {
      setCreateError(error.message);
      return;
    }

    if (newDoubt) {
      // Re-fetch to retrieve enriched metadata
      await handleRefresh();
      setShowCreateModal(false);
      setTitle('');
      setQuestion('');
      setPriority('normal');
      setSelectedSubjectId('');
      setSelectedPlanId('');
      setSelectedTaskId('');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubt || !studentId) return;

    const cleanMsg = replyMessage.trim();
    if (!cleanMsg) {
      setReplyError('Reply message cannot be empty.');
      return;
    }

    setSubmittingReply(true);
    setReplyError(null);

    const { response: newResp, error } = await addDoubtResponse({
      doubtId: activeDoubt.id,
      authorId: studentId,
      message: cleanMsg,
    });

    setSubmittingReply(false);

    if (error) {
      setReplyError(error.message);
      return;
    }

    if (newResp) {
      setReplyMessage('');
      await handleRefresh();
    }
  };

  const handleToggleResolved = async () => {
    if (!activeDoubt || !studentId) return;
    setStatusUpdating(true);

    const newStatus: DoubtStatus = activeDoubt.status === 'resolved' ? 'open' : 'resolved';
    const { doubt: updated, error } = await updateDoubtStatus(activeDoubt.id, studentId, newStatus);

    setStatusUpdating(false);

    if (error) {
      setReplyError(error.message);
      return;
    }

    if (updated) {
      await handleRefresh();
    }
  };

  // Filtered study plans and tasks based on selected subject in create modal
  const filteredPlansForSubject = selectedSubjectId
    ? studyPlans.filter((p) => p.subject_id === selectedSubjectId)
    : studyPlans;

  const filteredTasksForSubject = selectedSubjectId
    ? tasks.filter((t) => t.subject_id === selectedSubjectId)
    : tasks;

  // Filtered Doubts
  const filteredDoubts = doubts.filter((d) => {
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.subject_name && d.subject_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || d.status === statusFilter;
    const matchesSubject = subjectFilter === 'all' || d.subject_id === subjectFilter;

    return matchesSearch && matchesStatus && matchesSubject;
  });

  // Metrics
  const totalCount = doubts.length;
  const openCount = doubts.filter((d) => d.status === 'open').length;
  const answeredCount = doubts.filter((d) => d.status === 'answered').length;
  const resolvedCount = doubts.filter((d) => d.status === 'resolved').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-brand-dark pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-brand-muted uppercase tracking-wider mb-1">
            <Link to="/student" className="hover:text-brand-teal transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-brand-navy font-bold">Doubts Resolution Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-brand-navy flex items-center gap-2.5">
            <HelpCircle className="w-7 h-7 text-brand-teal" />
            Academic Doubts &amp; Inquiries
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            Ask specific conceptual questions, homework problems, and study inquiries directly to your assigned mentor.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 shadow-brutal"
          >
            <Plus className="w-4 h-4" />
            <span>Ask A Doubt</span>
          </Button>
        </div>
      </div>

      {/* 2. Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">Total Doubts</span>
          <span className="text-2xl font-heading font-extrabold text-brand-navy mt-1">{totalCount}</span>
        </div>

        <div className="p-3 border-2 border-brand-dark bg-brand-gold/15 shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-amber-800">Awaiting Reply</span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <span className="text-2xl font-heading font-extrabold text-amber-900 mt-1">{openCount}</span>
        </div>

        <div className="p-3 border-2 border-brand-dark bg-brand-teal/15 shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-teal-800">Answered</span>
            <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
          </div>
          <span className="text-2xl font-heading font-extrabold text-teal-900 mt-1">{answeredCount}</span>
        </div>

        <div className="p-3 border-2 border-brand-dark bg-emerald-50 shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-emerald-800">Resolved</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <span className="text-2xl font-heading font-extrabold text-emerald-900 mt-1">{resolvedCount}</span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 border-2 border-red-600 bg-red-50 text-red-900 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Search & Filter Bar */}
      <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            placeholder="Search doubts by title, question, or study area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1 border-2 border-brand-dark bg-white px-2 py-1 text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="font-sans text-xs font-bold text-brand-navy bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open (Awaiting)</option>
              <option value="answered">Answered</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-1 border-2 border-brand-dark bg-white px-2 py-1 text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">Subject:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="font-sans text-xs font-bold text-brand-navy bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="all">All Study Areas</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Doubts Feed */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
          <p className="font-mono text-xs text-brand-muted uppercase">Loading academic doubt inquiries...</p>
        </div>
      ) : filteredDoubts.length === 0 ? (
        <div className="p-10 border-2 border-dashed border-brand-dark/40 bg-brand-paper/50 rounded flex flex-col items-center justify-center text-center">
          <HelpCircle className="w-10 h-10 text-brand-muted mb-2 opacity-50" />
          <h3 className="font-heading font-bold text-sm text-brand-navy">No Doubt Inquiries Found</h3>
          <p className="text-xs text-brand-muted max-w-sm mt-1">
            {searchQuery || statusFilter !== 'all' || subjectFilter !== 'all'
              ? 'No doubts match the selected filters. Try clearing your search parameters.'
              : 'You have not submitted any questions yet. When you hit a roadblock in your syllabus, click "Ask A Doubt" to submit an inquiry to your mentor.'}
          </p>
          {(searchQuery || statusFilter !== 'all' || subjectFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setSubjectFilter('all');
              }}
              className="mt-3 font-mono text-xs text-brand-teal underline font-bold"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDoubts.map((doubt) => {
            const isResolved = doubt.status === 'resolved';
            const isAnswered = doubt.status === 'answered';

            return (
              <div
                key={doubt.id}
                onClick={() => setActiveDoubt(doubt)}
                className={`p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform cursor-pointer flex flex-col justify-between group ${
                  isResolved ? 'opacity-90 bg-emerald-50/20' : ''
                }`}
              >
                <div>
                  {/* Top row: Badges and priority */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Status Badge */}
                      {isResolved ? (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-emerald-600 bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Resolved
                        </span>
                      ) : isAnswered ? (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-teal-600 bg-teal-100 text-teal-800 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          Answered
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-amber-600 bg-amber-100 text-amber-900 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Awaiting Response
                        </span>
                      )}

                      {/* Priority Tag */}
                      {doubt.priority === 'urgent' && (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-red-600 bg-red-100 text-red-800">
                          Urgent
                        </span>
                      )}
                      {doubt.priority === 'high' && (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-amber-600 bg-amber-100 text-amber-800">
                          High Priority
                        </span>
                      )}

                      {/* Subject Tag */}
                      {doubt.subject_name && (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-brand-dark/30 bg-white text-brand-navy">
                          {doubt.subject_code ? `${doubt.subject_code}: ` : ''}{doubt.subject_name}
                        </span>
                      )}
                    </div>

                    <span className="font-mono text-[11px] text-brand-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(doubt.created_at || '').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Doubt Title */}
                  <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                    {doubt.title}
                  </h3>

                  {/* Question Snippet */}
                  <p className="text-xs text-brand-dark/80 line-clamp-2 mt-1 leading-relaxed">
                    {doubt.question}
                  </p>

                  {/* Academic Context Links */}
                  {(doubt.plan_title || doubt.task_title) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] font-mono text-brand-muted">
                      {doubt.plan_title && (
                        <span className="bg-white/80 border border-brand-dark/20 px-1.5 py-0.5">
                          Plan: {doubt.plan_title}
                        </span>
                      )}
                      {doubt.task_title && (
                        <span className="bg-white/80 border border-brand-dark/20 px-1.5 py-0.5">
                          Task: {doubt.task_title}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer preview */}
                <div className="mt-3 pt-2.5 border-t border-brand-dark/15 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-muted flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {doubt.responses_count || 0} {(doubt.responses_count === 1) ? 'reply' : 'replies'}
                    </span>
                    {doubt.latest_response && (
                      <span className="text-brand-teal font-bold hidden sm:inline">
                        • Latest reply by {doubt.latest_response.author_name}
                      </span>
                    )}
                  </div>

                  <span className="font-bold text-brand-navy group-hover:text-brand-teal flex items-center gap-1">
                    <span>Open Thread</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. CREATE DOUBT MODAL                                                 */}
      {/* ===================================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal max-w-xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-teal" />
                <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                  Submit Academic Doubt
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-brand-dark hover:text-brand-teal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="p-3 mb-4 border-2 border-red-600 bg-red-50 text-red-900 text-xs font-mono">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateDoubt} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-brand-navy mb-1">
                  Inquiry Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Incline Atwood machine normal force vs friction"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              {/* Priority */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] font-bold uppercase text-brand-navy mb-1">
                    Priority Level
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as DoubtPriority)}
                    className="w-full p-2 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  >
                    <option value="normal">Normal</option>
                    <option value="low">Low</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Subject Selector */}
                <div>
                  <label className="block font-mono text-[11px] font-bold uppercase text-brand-navy mb-1">
                    Associated Study Area
                  </label>
                  <select
                    value={selectedSubjectId}
                    onChange={(e) => {
                      setSelectedSubjectId(e.target.value);
                      setSelectedPlanId('');
                      setSelectedTaskId('');
                    }}
                    className="w-full p-2 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
                  >
                    <option value="">General (No Specific Subject)</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code || 'AREA'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Optional Plan & Task selectors */}
              {selectedSubjectId && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-brand-light/50 p-3 border border-brand-dark/30">
                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-brand-navy mb-1">
                      Related Study Plan (Optional)
                    </label>
                    <select
                      value={selectedPlanId}
                      onChange={(e) => setSelectedPlanId(e.target.value)}
                      className="w-full p-1.5 border border-brand-dark bg-white text-xs text-brand-navy focus:outline-none"
                    >
                      <option value="">None</option>
                      {filteredPlansForSubject.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-mono text-[10px] font-bold uppercase text-brand-navy mb-1">
                      Related Task (Optional)
                    </label>
                    <select
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                      className="w-full p-1.5 border border-brand-dark bg-white text-xs text-brand-navy focus:outline-none"
                    >
                      <option value="">None</option>
                      {filteredTasksForSubject.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Question Body */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase text-brand-navy mb-1">
                  Your Question Details *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Explain exactly what you understand, what formula or step is confusing, and what answer you arrived at..."
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  className="w-full p-2.5 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-brand-dark/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingCreate}
                  className="shadow-brutal flex items-center gap-1.5"
                >
                  {submittingCreate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Submit Inquiry</span>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. DOUBT DETAIL / THREAD MODAL                                        */}
      {/* ===================================================================== */}
      {activeDoubt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            {/* Header */}
            <div>
              <div className="flex items-start justify-between border-b-2 border-brand-dark pb-3 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    {activeDoubt.status === 'resolved' ? (
                      <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-emerald-600 bg-emerald-100 text-emerald-800 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Resolved
                      </span>
                    ) : activeDoubt.status === 'answered' ? (
                      <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-teal-600 bg-teal-100 text-teal-800 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        Answered
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-amber-600 bg-amber-100 text-amber-900 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Awaiting Response
                      </span>
                    )}

                    {activeDoubt.subject_name && (
                      <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-brand-dark/30 bg-white text-brand-navy">
                        {activeDoubt.subject_name}
                      </span>
                    )}
                  </div>
                  <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                    {activeDoubt.title}
                  </h2>
                </div>

                <button
                  onClick={() => setActiveDoubt(null)}
                  className="text-brand-dark hover:text-brand-teal p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Original Question Card */}
              <div className="p-4 border-2 border-brand-dark bg-white mb-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-brand-muted mb-2 border-b border-brand-dark/10 pb-1.5">
                  <span className="font-bold text-brand-navy">Your Question:</span>
                  <span>{new Date(activeDoubt.created_at || '').toLocaleString()}</span>
                </div>
                <p className="font-sans text-xs text-brand-navy whitespace-pre-wrap leading-relaxed">
                  {activeDoubt.question}
                </p>

                {/* Context associations */}
                {(activeDoubt.plan_title || activeDoubt.task_title || activeDoubt.assignment_title) && (
                  <div className="mt-3 pt-2 border-t border-brand-dark/10 flex flex-wrap gap-2 text-[10px] font-mono text-brand-muted">
                    {activeDoubt.plan_title && <span>Plan: {activeDoubt.plan_title}</span>}
                    {activeDoubt.task_title && <span>Task: {activeDoubt.task_title}</span>}
                    {activeDoubt.assignment_title && <span>Assignment: {activeDoubt.assignment_title}</span>}
                  </div>
                )}
              </div>

              {/* Replies Thread */}
              <div className="space-y-3 mb-4">
                <h4 className="font-mono text-xs font-bold uppercase text-brand-navy flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
                  Conversation Thread ({activeDoubt.responses?.length || 0})
                </h4>

                {(!activeDoubt.responses || activeDoubt.responses.length === 0) ? (
                  <div className="p-4 border border-dashed border-brand-dark/30 bg-brand-light/40 text-center font-mono text-xs text-brand-muted">
                    No mentor responses recorded yet. Your mentor will reply directly to this thread.
                  </div>
                ) : (
                  activeDoubt.responses.map((resp) => {
                    const isMentor = resp.author_role === 'mentor' || resp.author_role === 'admin';

                    return (
                      <div
                        key={resp.id}
                        className={`p-3.5 border-2 border-brand-dark ${
                          isMentor ? 'bg-brand-teal/10 border-l-4 border-l-brand-teal' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-brand-navy">{resp.author_name}</span>
                            {isMentor && (
                              <span className="px-1.5 py-0.2 font-mono text-[9px] uppercase font-bold bg-brand-teal text-white">
                                Mentor
                              </span>
                            )}
                          </div>
                          <span className="text-brand-muted">
                            {new Date(resp.created_at || '').toLocaleString()}
                          </span>
                        </div>
                        <p className="font-sans text-xs text-brand-navy whitespace-pre-wrap leading-relaxed">
                          {resp.message}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom: Send Follow-up & Toggle Resolved */}
            <div className="pt-3 border-t-2 border-brand-dark space-y-3">
              {replyError && (
                <div className="p-2 border border-red-600 bg-red-50 text-red-900 text-xs font-mono">
                  {replyError}
                </div>
              )}

              <form onSubmit={handleSendReply} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a follow-up inquiry or clarification..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="flex-1 p-2 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <Button
                  type="submit"
                  variant="primary"
                  disabled={submittingReply}
                  className="flex items-center gap-1 shadow-brutal px-3"
                >
                  {submittingReply ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Reply</span>
                    </>
                  )}
                </Button>
              </form>

              <div className="flex items-center justify-between pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleToggleResolved}
                  disabled={statusUpdating}
                  className={`flex items-center gap-1.5 text-xs ${
                    activeDoubt.status === 'resolved'
                      ? 'border-amber-700 text-amber-900 bg-amber-50'
                      : 'border-emerald-700 text-emerald-900 bg-emerald-50'
                  }`}
                >
                  {statusUpdating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : activeDoubt.status === 'resolved' ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Re-open Doubt</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Mark As Resolved</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveDoubt(null)}
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
