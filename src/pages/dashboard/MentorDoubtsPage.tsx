import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getMentorDoubts,
  addDoubtResponse,
  updateDoubtStatus,
  type DoubtWithMeta,
} from '../../lib/doubts';
import { getAssignedStudents } from '../../lib/mentorship';
import type { Profile, DoubtStatus } from '../../types/database';
import { Button } from '../../components/common/Button';
import {
  HelpCircle,
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
  User,
  Check,
} from 'lucide-react';

export const MentorDoubtsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const mentorId = profile?.id || user?.id || '';

  const [doubts, setDoubts] = useState<DoubtWithMeta[]>([]);
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | DoubtStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Detail / Thread Modal
  const [activeDoubt, setActiveDoubt] = useState<DoubtWithMeta | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    if (!mentorId) return;

    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const [doubtsRes, stuRes] = await Promise.all([
          getMentorDoubts(mentorId),
          getAssignedStudents(mentorId),
        ]);

        if (!isMounted) return;

        if (doubtsRes.error) {
          setErrorMessage(doubtsRes.error.message);
        } else {
          setDoubts(doubtsRes.doubts);
        }

        if (stuRes.students) {
          setStudents(stuRes.students);
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

  const handleRefresh = async () => {
    if (!mentorId) return;
    setRefreshing(true);
    setErrorMessage(null);
    const { doubts: list, error } = await getMentorDoubts(mentorId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setDoubts(list);
      if (activeDoubt) {
        const updated = list.find((d) => d.id === activeDoubt.id);
        if (updated) setActiveDoubt(updated);
      }
    }
    setRefreshing(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubt || !mentorId) return;

    const cleanMsg = replyMessage.trim();
    if (!cleanMsg) {
      setReplyError('Response message cannot be empty.');
      return;
    }

    setSubmittingReply(true);
    setReplyError(null);

    const { response: newResp, error } = await addDoubtResponse({
      doubtId: activeDoubt.id,
      authorId: mentorId,
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
    if (!activeDoubt || !mentorId) return;
    setStatusUpdating(true);

    const newStatus: DoubtStatus = activeDoubt.status === 'resolved' ? 'open' : 'resolved';
    const { doubt: updated, error } = await updateDoubtStatus(activeDoubt.id, mentorId, newStatus);

    setStatusUpdating(false);

    if (error) {
      setReplyError(error.message);
      return;
    }

    if (updated) {
      await handleRefresh();
    }
  };

  // Filtered Doubts
  const filteredDoubts = doubts.filter((d) => {
    const matchesStudent = selectedStudentId === 'all' || d.student_id === selectedStudentId;
    const matchesStatus = selectedStatus === 'all' || d.status === selectedStatus;
    const matchesSearch =
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.student_name && d.student_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (d.subject_name && d.subject_name.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStudent && matchesStatus && matchesSearch;
  });

  // Metrics
  const totalCount = doubts.length;
  const awaitingCount = doubts.filter((d) => d.status === 'open').length;
  const answeredCount = doubts.filter((d) => d.status === 'answered').length;
  const resolvedCount = doubts.filter((d) => d.status === 'resolved').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b-2 border-brand-dark pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-brand-muted uppercase tracking-wider mb-1">
            <Link to="/mentor" className="hover:text-brand-teal transition-colors">
              Mentor Dashboard
            </Link>
            <ChevronRight className="w-3 h-3" />
            <span className="text-brand-navy font-bold">Doubt Resolution Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-brand-navy flex items-center gap-2.5">
            <HelpCircle className="w-7 h-7 text-brand-teal" />
            Scholar Doubts &amp; Inquiries Desk
          </h1>
          <p className="text-xs sm:text-sm text-brand-muted mt-1">
            Direct conceptual assistance and problem-solving guidance for your assigned scholars.
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
        </div>
      </div>

      {/* 2. Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
          <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">Total Questions</span>
          <span className="text-2xl font-heading font-extrabold text-brand-navy mt-1">{totalCount}</span>
        </div>

        <div className="p-3 border-2 border-brand-dark bg-brand-gold/15 shadow-brutal flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase font-bold text-amber-800">Awaiting Reply</span>
            <Clock className="w-3.5 h-3.5 text-amber-700" />
          </div>
          <span className="text-2xl font-heading font-extrabold text-amber-900 mt-1">{awaitingCount}</span>
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

      {/* 3. Filter Bar */}
      <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
          <input
            type="text"
            placeholder="Search by scholar name, question title, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Scholar Filter */}
          <div className="flex items-center gap-1 border-2 border-brand-dark bg-white px-2 py-1 text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">Scholar:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="font-sans text-xs font-bold text-brand-navy bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="all">All Assigned Scholars</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.poraplan_id || 'PP'})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 border-2 border-brand-dark bg-white px-2 py-1 text-xs">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="font-sans text-xs font-bold text-brand-navy bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Awaiting Reply</option>
              <option value="answered">Answered</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Doubts List */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col items-center justify-center text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mb-3" />
          <p className="font-mono text-xs text-brand-muted uppercase">Loading scholar doubt inquiries...</p>
        </div>
      ) : filteredDoubts.length === 0 ? (
        <div className="p-10 border-2 border-dashed border-brand-dark/40 bg-brand-paper/50 rounded flex flex-col items-center justify-center text-center">
          <HelpCircle className="w-10 h-10 text-brand-muted mb-2 opacity-50" />
          <h3 className="font-heading font-bold text-sm text-brand-navy">No Doubt Inquiries Found</h3>
          <p className="text-xs text-brand-muted max-w-sm mt-1">
            {students.length === 0
              ? 'You do not have any assigned scholars paired with your account yet.'
              : searchQuery || selectedStatus !== 'all' || selectedStudentId !== 'all'
              ? 'No doubts match the selected criteria.'
              : 'Your assigned scholars currently have no pending doubt questions.'}
          </p>
          {(searchQuery || selectedStatus !== 'all' || selectedStudentId !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedStatus('all');
                setSelectedStudentId('all');
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
                  doubt.status === 'open' ? 'border-l-4 border-l-brand-gold bg-amber-50/15' : ''
                }`}
              >
                <div>
                  {/* Top row: Scholar info & status badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Scholar Badge */}
                      <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-brand-dark/40 bg-white text-brand-navy flex items-center gap-1">
                        <User className="w-3 h-3 text-brand-teal" />
                        {doubt.student_name} ({doubt.student_poraplan_id || 'PP'})
                      </span>

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
                          Needs Response
                        </span>
                      )}

                      {/* Priority */}
                      {doubt.priority === 'urgent' && (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-red-600 bg-red-100 text-red-800">
                          Urgent
                        </span>
                      )}
                      {doubt.priority === 'high' && (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-amber-600 bg-amber-100 text-amber-800">
                          High
                        </span>
                      )}

                      {doubt.subject_name && (
                        <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-brand-dark/20 bg-brand-light/70 text-brand-navy">
                          {doubt.subject_name}
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

                  <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                    {doubt.title}
                  </h3>

                  <p className="text-xs text-brand-dark/80 line-clamp-2 mt-1 leading-relaxed">
                    {doubt.question}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-brand-dark/15 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-brand-muted">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {doubt.responses_count || 0} {(doubt.responses_count === 1) ? 'response' : 'responses'}
                    </span>
                  </div>

                  <span className="font-bold text-brand-navy group-hover:text-brand-teal flex items-center gap-1">
                    <span>Respond to Scholar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MENTOR DOUBT DETAIL / REPLY MODAL                                  */}
      {/* ===================================================================== */}
      {activeDoubt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-brand-paper border-2 border-brand-dark shadow-brutal max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-start justify-between border-b-2 border-brand-dark pb-3 mb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                    <span className="px-2 py-0.5 font-mono text-[10px] uppercase font-bold border border-brand-dark/40 bg-white text-brand-navy">
                      Scholar: {activeDoubt.student_name} ({activeDoubt.student_poraplan_id || 'PP'})
                    </span>

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

              {/* Scholar Question Box */}
              <div className="p-4 border-2 border-brand-dark bg-white mb-4">
                <div className="flex items-center justify-between text-[11px] font-mono text-brand-muted mb-2 border-b border-brand-dark/10 pb-1.5">
                  <span className="font-bold text-brand-navy">Question from Scholar:</span>
                  <span>{new Date(activeDoubt.created_at || '').toLocaleString()}</span>
                </div>
                <p className="font-sans text-xs text-brand-navy whitespace-pre-wrap leading-relaxed">
                  {activeDoubt.question}
                </p>

                {(activeDoubt.plan_title || activeDoubt.task_title || activeDoubt.assignment_title) && (
                  <div className="mt-3 pt-2 border-t border-brand-dark/10 flex flex-wrap gap-2 text-[10px] font-mono text-brand-muted">
                    {activeDoubt.plan_title && <span>Study Plan: {activeDoubt.plan_title}</span>}
                    {activeDoubt.task_title && <span>Task: {activeDoubt.task_title}</span>}
                    {activeDoubt.assignment_title && <span>Assignment: {activeDoubt.assignment_title}</span>}
                  </div>
                )}
              </div>

              {/* Conversation Thread */}
              <div className="space-y-3 mb-4">
                <h4 className="font-mono text-xs font-bold uppercase text-brand-navy flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
                  Dialogue Thread ({activeDoubt.responses?.length || 0})
                </h4>

                {(!activeDoubt.responses || activeDoubt.responses.length === 0) ? (
                  <div className="p-4 border border-dashed border-brand-dark/30 bg-brand-light/40 text-center font-mono text-xs text-brand-muted">
                    No replies sent yet. Provide an explanation or guiding hint below to answer this question.
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
                            {isMentor ? (
                              <span className="px-1.5 py-0.2 font-mono text-[9px] uppercase font-bold bg-brand-teal text-white">
                                Mentor (You)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 font-mono text-[9px] uppercase font-bold bg-brand-navy text-white">
                                Scholar
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

            {/* Response Form */}
            <div className="pt-3 border-t-2 border-brand-dark space-y-3">
              {replyError && (
                <div className="p-2 border border-red-600 bg-red-50 text-red-900 text-xs font-mono">
                  {replyError}
                </div>
              )}

              <form onSubmit={handleSendReply} className="space-y-2">
                <textarea
                  rows={3}
                  placeholder="Provide conceptual clarification, formula proof, step-by-step guidance..."
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full p-2.5 border-2 border-brand-dark bg-white font-sans text-xs text-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-teal"
                />
                <div className="flex items-center justify-between">
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

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveDoubt(null)}
                    >
                      Close
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={submittingReply}
                      className="shadow-brutal flex items-center gap-1.5"
                    >
                      {submittingReply ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Dispatch Response</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
