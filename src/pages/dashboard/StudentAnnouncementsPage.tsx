import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentAnnouncements,
  acknowledgeAnnouncement,
  type AnnouncementWithMeta,
} from '../../lib/announcements';
import type { AnnouncementPriority, AnnouncementScope } from '../../types/database';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  Megaphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  RefreshCw,
  X,
  BookOpen,
  User,
  ShieldCheck,
  Check,
  Sparkles,
  Filter,
} from 'lucide-react';

export const StudentAnnouncementsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const studentId = profile?.id || user?.id || '';

  const [announcements, setAnnouncements] = useState<AnnouncementWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [ackFilter, setAckFilter] = useState<'all' | 'unacknowledged' | 'acknowledged'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | AnnouncementPriority>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | AnnouncementScope>('all');

  // Detail Modal
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementWithMeta | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [ackSuccessMessage, setAckSuccessMessage] = useState<string | null>(null);

  const fetchData = async (isRefresh = false) => {
    if (!studentId) return;
    if (isRefresh) {
      setRefreshing(true);
    }
    setErrorMessage(null);

    try {
      const { announcements: list, error } = await getStudentAnnouncements(studentId);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setAnnouncements(list);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      if (isRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;

    async function loadData() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const { announcements: list, error } = await getStudentAnnouncements(studentId);
        if (!isMounted) return;
        if (error) {
          setErrorMessage(error.message);
        } else {
          setAnnouncements(list);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleAcknowledge = async (announcementId: string) => {
    if (!studentId || acknowledgingId) return;
    setAcknowledgingId(announcementId);
    setAckSuccessMessage(null);

    try {
      const { acknowledgment, error } = await acknowledgeAnnouncement(announcementId, studentId);
      if (error) {
        setErrorMessage(`Failed to acknowledge notice: ${error.message}`);
      } else if (acknowledgment) {
        // Update local state reactively
        const now = new Date().toISOString();
        setAnnouncements((prev) =>
          prev.map((item) =>
            item.id === announcementId
              ? {
                  ...item,
                  is_acknowledged: true,
                  acknowledged_at: acknowledgment.acknowledged_at || now,
                }
              : item
          )
        );

        if (activeAnnouncement && activeAnnouncement.id === announcementId) {
          setActiveAnnouncement((prev) =>
            prev
              ? {
                  ...prev,
                  is_acknowledged: true,
                  acknowledged_at: acknowledgment.acknowledged_at || now,
                }
              : null
          );
        }

        setAckSuccessMessage('Notice successfully acknowledged.');
        setTimeout(() => setAckSuccessMessage(null), 4000);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setAcknowledgingId(null);
    }
  };

  // Metrics
  const totalCount = announcements.length;
  const unackCount = announcements.filter((a) => !a.is_acknowledged).length;
  const ackCount = announcements.filter((a) => a.is_acknowledged).length;

  // Filtered List
  const filteredAnnouncements = announcements.filter((a) => {
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = a.title.toLowerCase().includes(q);
      const matchContent = a.content.toLowerCase().includes(q);
      const matchAuthor = (a.author_name || '').toLowerCase().includes(q);
      const matchSubject = (a.subject_name || '').toLowerCase().includes(q);
      if (!matchTitle && !matchContent && !matchAuthor && !matchSubject) return false;
    }

    // Acknowledgment filter
    if (ackFilter === 'unacknowledged' && a.is_acknowledged) return false;
    if (ackFilter === 'acknowledged' && !a.is_acknowledged) return false;

    // Priority filter
    if (priorityFilter !== 'all' && a.priority !== priorityFilter) return false;

    // Scope filter
    if (scopeFilter !== 'all' && a.target_scope !== scopeFilter) return false;

    return true;
  });

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Recent';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const getPriorityBadge = (priority: AnnouncementPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-red-700 bg-red-100 text-red-900 font-mono text-[11px] font-extrabold uppercase shadow-xs">
            <AlertTriangle className="w-3 h-3 text-red-700 stroke-[2.5]" />
            Urgent
          </span>
        );
      case 'important':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-amber-600 bg-amber-100 text-amber-900 font-mono text-[11px] font-extrabold uppercase shadow-xs">
            <Clock className="w-3 h-3 text-amber-700 stroke-[2.5]" />
            Important
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border-2 border-brand-teal bg-teal-50 text-brand-teal font-mono text-[11px] font-extrabold uppercase shadow-xs">
            Notice
          </span>
        );
    }
  };

  const getScopeBadge = (scope: AnnouncementScope) => {
    switch (scope) {
      case 'platform':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-navy bg-brand-navy text-white font-mono text-[10px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-2.5 h-2.5" />
            Platform Wide
          </span>
        );
      case 'assigned_students':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-blue-700 bg-blue-50 text-blue-900 font-mono text-[10px] font-bold uppercase tracking-wider">
            <User className="w-2.5 h-2.5" />
            Mentor Cohort
          </span>
        );
      case 'individual':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-purple-700 bg-purple-50 text-purple-900 font-mono text-[10px] font-bold uppercase tracking-wider">
            <Sparkles className="w-2.5 h-2.5" />
            Targeted To You
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* 1. Header & Actions */}
      <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 border-2 border-brand-dark bg-brand-gold text-brand-dark flex items-center justify-center shadow-brutal-xs">
              <Megaphone className="w-5 h-5 stroke-[2.5]" />
            </div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
              Announcements
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-brand-muted font-sans">
            Important notices, schedule updates, and guidance from your mentor.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint"
            title="Refresh announcements list"
          >
            <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Success Banner */}
      {ackSuccessMessage && (
        <div className="border-2 border-green-700 bg-green-50 p-4 shadow-brutal flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-900 font-sans text-xs sm:text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0" />
            <span>{ackSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setAckSuccessMessage(null)}
            className="text-green-800 hover:text-green-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Error Banner */}
      {errorMessage && (
        <div className="border-2 border-red-700 bg-red-50 p-4 shadow-brutal flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-900 font-sans text-xs sm:text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-800 hover:text-red-950 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Statistics Dashboard Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Total Bulletins */}
        <div className="border-2 border-brand-dark bg-brand-paper p-4 shadow-brutal flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
              TOTAL DIRECTIVES
            </span>
            <span className="font-heading font-extrabold text-2xl text-brand-navy">
              {totalCount}
            </span>
          </div>
          <div className="w-10 h-10 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center">
            <Megaphone className="w-5 h-5 text-brand-navy" />
          </div>
        </div>

        {/* Unacknowledged Notice Counter */}
        <button
          type="button"
          onClick={() => setAckFilter('unacknowledged')}
          className={`border-2 border-brand-dark p-4 shadow-brutal flex items-center justify-between text-left transition-transform hover:-translate-y-0.5 ${
            ackFilter === 'unacknowledged' ? 'ring-2 ring-brand-navy bg-amber-50' : 'bg-brand-paper'
          }`}
        >
          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-amber-800 block">
              PENDING ACKNOWLEDGMENT
            </span>
            <div className="flex items-center gap-2">
              <span className="font-heading font-extrabold text-2xl text-amber-900">
                {unackCount}
              </span>
              {unackCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-600 text-white font-mono text-[10px] font-bold uppercase rounded-xs">
                  Action Required
                </span>
              )}
            </div>
          </div>
          <div className="w-10 h-10 border-2 border-brand-dark bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-800" />
          </div>
        </button>

        {/* Acknowledged Counter */}
        <button
          type="button"
          onClick={() => setAckFilter('acknowledged')}
          className={`border-2 border-brand-dark p-4 shadow-brutal flex items-center justify-between text-left transition-transform hover:-translate-y-0.5 ${
            ackFilter === 'acknowledged' ? 'ring-2 ring-brand-navy bg-teal-50' : 'bg-brand-paper'
          }`}
        >
          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-teal block">
              ACKNOWLEDGED
            </span>
            <span className="font-heading font-extrabold text-2xl text-brand-navy">
              {ackCount}
            </span>
          </div>
          <div className="w-10 h-10 border-2 border-brand-dark bg-teal-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-brand-teal" />
          </div>
        </button>
      </div>

      {/* 5. Filter Controls */}
      <div className="border-2 border-brand-dark bg-brand-paper p-4 shadow-brutal space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search announcements by title, content, author, or study area..."
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border-2 border-brand-dark bg-brand-bg font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-dark p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setAckFilter('all')}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark shadow-xs transition-colors whitespace-nowrap ${
                ackFilter === 'all'
                  ? 'bg-brand-navy text-white'
                  : 'bg-brand-paper hover:bg-brand-paper-tint text-brand-dark'
              }`}
            >
              All Notices ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setAckFilter('unacknowledged')}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark shadow-xs transition-colors whitespace-nowrap flex items-center gap-1 ${
                ackFilter === 'unacknowledged'
                  ? 'bg-amber-600 text-white'
                  : 'bg-brand-paper hover:bg-amber-50 text-amber-900'
              }`}
            >
              Unacknowledged ({unackCount})
            </button>
            <button
              type="button"
              onClick={() => setAckFilter('acknowledged')}
              className={`px-3 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark shadow-xs transition-colors whitespace-nowrap ${
                ackFilter === 'acknowledged'
                  ? 'bg-brand-teal text-white'
                  : 'bg-brand-paper hover:bg-teal-50 text-brand-teal'
              }`}
            >
              Acknowledged ({ackCount})
            </button>
          </div>
        </div>

        {/* Secondary filters: Priority & Scope */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-brand-dark/15 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-brand-muted" />
            <span className="font-mono text-[11px] font-bold text-brand-muted uppercase">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as any)}
              className="px-2 py-1 border border-brand-dark bg-brand-bg font-sans text-xs focus:outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="important">Important</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] font-bold text-brand-muted uppercase">Audience Scope:</span>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as any)}
              className="px-2 py-1 border border-brand-dark bg-brand-bg font-sans text-xs focus:outline-none"
            >
              <option value="all">All Scopes</option>
              <option value="platform">Platform Wide</option>
              <option value="assigned_students">Mentor Cohort</option>
              <option value="individual">Targeted To You</option>
            </select>
          </div>

          {(searchQuery || ackFilter !== 'all' || priorityFilter !== 'all' || scopeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setAckFilter('all');
                setPriorityFilter('all');
                setScopeFilter('all');
              }}
              className="font-mono text-[11px] text-brand-teal hover:underline ml-auto"
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>

      {/* 6. Main List or Empty State */}
      {loading ? (
        <div className="border-2 border-brand-dark bg-brand-paper p-12 text-center shadow-brutal space-y-3">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-teal border-t-brand-navy rounded-full" />
          <p className="font-heading font-bold text-brand-navy text-sm">
            Retrieving Academic Directives...
          </p>
          <span className="font-mono text-[11px] text-brand-muted block">
            Verifying authorized student announcements and acknowledgment records
          </span>
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="border-2 border-brand-dark bg-brand-paper p-10 sm:p-14 text-center shadow-brutal space-y-3">
          <div className="w-12 h-12 border-2 border-brand-dark bg-brand-paper-tint mx-auto flex items-center justify-center shadow-brutal-xs">
            <Megaphone className="w-6 h-6 text-brand-muted" />
          </div>
          <h2 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
            {totalCount === 0
              ? 'No Announcements on Record'
              : ackFilter === 'unacknowledged'
              ? 'All Caught Up!'
              : 'No Directives Match Current Filters'}
          </h2>
          <p className="font-sans text-xs sm:text-sm text-brand-muted max-w-md mx-auto leading-relaxed">
            {totalCount === 0
              ? 'Your faculty mentors and platform administrators have not published any announcements to your desk yet.'
              : ackFilter === 'unacknowledged'
              ? 'You have successfully acknowledged all active notices dispatched to your academic desk.'
              : 'Try clearing your search query or adjusting your priority and audience filters.'}
          </p>
          {(searchQuery || ackFilter !== 'all' || priorityFilter !== 'all' || scopeFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setAckFilter('all');
                setPriorityFilter('all');
                setScopeFilter('all');
              }}
              className="mt-3"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => {
            const isUnack = !announcement.is_acknowledged;
            const isAcknowledging = acknowledgingId === announcement.id;

            return (
              <article
                key={announcement.id}
                className={`border-2 border-brand-dark p-5 sm:p-6 shadow-brutal transition-all flex flex-col justify-between gap-4 ${
                  isUnack ? 'bg-brand-paper ring-1 ring-amber-400' : 'bg-brand-paper-tint/60'
                }`}
              >
                {/* Announcement Card Top Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-dark/15 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {getPriorityBadge(announcement.priority)}
                    {getScopeBadge(announcement.target_scope)}
                    {announcement.subject_name && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-dark/30 bg-brand-paper font-mono text-[10px] text-brand-dark font-bold">
                        <BookOpen className="w-2.5 h-2.5 text-brand-teal" />
                        {announcement.subject_code ? `${announcement.subject_code}: ` : ''}
                        {announcement.subject_name}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {announcement.is_acknowledged ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-green-800 bg-green-100 border border-green-700 px-2 py-0.5">
                        <Check className="w-3 h-3 text-green-700 stroke-[3]" />
                        Acknowledged
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-extrabold text-amber-900 bg-amber-100 border border-amber-600 px-2 py-0.5">
                        <Clock className="w-3 h-3 text-amber-700" />
                        Action Required
                      </span>
                    )}
                  </div>
                </div>

                {/* Announcement Content & Title */}
                <div className="space-y-2">
                  <h2
                    onClick={() => setActiveAnnouncement(announcement)}
                    className="font-heading font-extrabold text-base sm:text-lg text-brand-navy hover:text-brand-teal transition-colors cursor-pointer"
                  >
                    {announcement.title}
                  </h2>
                  <p className="font-sans text-xs sm:text-sm text-brand-dark leading-relaxed whitespace-pre-line">
                    {announcement.content}
                  </p>
                </div>

                {/* Footer Metadata & Acknowledgment Action */}
                <div className="border-t border-brand-dark/15 pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Author & Timestamp Info */}
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-brand-muted">
                    <span className="flex items-center gap-1 font-bold text-brand-navy">
                      <User className="w-3 h-3 text-brand-dark" />
                      {announcement.author_name}
                      {announcement.author_role && (
                        <span className="text-[10px] uppercase font-bold text-brand-teal">
                          ({announcement.author_role})
                        </span>
                      )}
                    </span>
                    <span>•</span>
                    <span title={announcement.published_at}>
                      Published {formatDate(announcement.published_at)}
                    </span>
                    {announcement.is_acknowledged && announcement.acknowledged_at && (
                      <>
                        <span>•</span>
                        <span className="text-green-800">
                          Ack'd {formatDate(announcement.acknowledged_at)}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Acknowledge Button */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setActiveAnnouncement(announcement)}
                      className="px-2.5 py-1 text-xs font-mono font-bold text-brand-navy hover:underline"
                    >
                      View Details
                    </button>

                    {isUnack ? (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleAcknowledge(announcement.id)}
                        disabled={isAcknowledging}
                        className="bg-brand-navy text-white hover:bg-brand-teal border-2 border-brand-dark shadow-xs"
                      >
                        {isAcknowledging ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Recording...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Acknowledge Notice
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="px-3 py-1 bg-green-50 border border-green-600 text-green-800 font-mono text-xs font-bold flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-green-700 stroke-[3]" />
                        Acknowledged
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* 7. Announcement Detail Modal */}
      {activeAnnouncement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-2xl w-full max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-100">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b-2 border-brand-dark flex items-start justify-between bg-brand-paper-tint">
              <div className="space-y-1.5 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  {getPriorityBadge(activeAnnouncement.priority)}
                  {getScopeBadge(activeAnnouncement.target_scope)}
                  {activeAnnouncement.subject_name && (
                    <Badge variant="paper" size="sm">
                      {activeAnnouncement.subject_name}
                    </Badge>
                  )}
                </div>
                <h3 className="font-heading font-extrabold text-base sm:text-xl text-brand-navy leading-snug">
                  {activeAnnouncement.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveAnnouncement(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-brand-dark shadow-brutal-xs"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {/* Author & Timestamp Card */}
              <div className="p-3 border-2 border-brand-dark/20 bg-brand-bg flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div>
                  <span className="text-brand-muted block text-[10px]">DISPATCHED BY</span>
                  <span className="font-bold text-brand-navy">
                    {activeAnnouncement.author_name}{' '}
                    {activeAnnouncement.author_role && `(${activeAnnouncement.author_role.toUpperCase()})`}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-brand-muted block text-[10px]">PUBLICATION TIME</span>
                  <span className="font-bold text-brand-dark">
                    {formatDate(activeAnnouncement.published_at)}
                  </span>
                </div>
              </div>

              {/* Notice Body */}
              <div className="space-y-2">
                <h4 className="font-mono text-xs font-bold uppercase text-brand-muted">
                  Notice Communication
                </h4>
                <div className="p-4 border-2 border-brand-dark bg-brand-paper font-sans text-xs sm:text-sm text-brand-dark leading-relaxed whitespace-pre-line shadow-xs">
                  {activeAnnouncement.content}
                </div>
              </div>

              {/* Acknowledgment Status Section */}
              <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                    Scholar Acknowledgment Status
                  </span>
                  {activeAnnouncement.is_acknowledged ? (
                    <span className="px-2 py-0.5 bg-green-100 text-green-900 border border-green-700 font-mono text-xs font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-green-700 stroke-[3]" />
                      Acknowledged
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-600 font-mono text-xs font-bold">
                      Pending Action
                    </span>
                  )}
                </div>

                <p className="text-xs text-brand-muted">
                  {activeAnnouncement.is_acknowledged
                    ? `You recorded your acknowledgment on ${formatDate(
                        activeAnnouncement.acknowledged_at
                      )}. Your mentor and administration have received your confirmation.`
                    : 'Please review the directives above and confirm receipt. Your mentor tracks scholar confirmations.'}
                </p>

                {!activeAnnouncement.is_acknowledged && (
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      onClick={() => handleAcknowledge(activeAnnouncement.id)}
                      disabled={acknowledgingId === activeAnnouncement.id}
                      className="w-full bg-brand-navy text-white hover:bg-brand-teal border-2 border-brand-dark shadow-xs"
                    >
                      {acknowledgingId === activeAnnouncement.id ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Submitting Confirmation...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Confirm &amp; Acknowledge Notice
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t-2 border-brand-dark bg-brand-paper-tint flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveAnnouncement(null)}
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
