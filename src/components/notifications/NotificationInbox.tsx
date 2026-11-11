import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getUserNotificationsPaginated,
  getUserNotificationStatusCounts,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  DEFAULT_NOTIFICATIONS_PAGE_SIZE,
  type NotificationStatusCounts,
} from '../../lib/notifications';
import type { NotificationWithActor } from '../../lib/notifications';
import type { PaginationMeta } from '../../types/pagination';
import { PaginationControls } from '../common/PaginationControls';
import {
  getNotificationTypeMeta,
} from '../../lib/notificationMeta';
import type { NotificationTypeMeta } from '../../lib/notificationMeta';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Trash2,
  ExternalLink,
  AlertCircle,
  Filter,
  RefreshCw,
  Loader2,
} from 'lucide-react';

export { getNotificationTypeMeta, type NotificationTypeMeta };

/**
 * Recognizes legacy application routes: /student/applications, /mentor/applications, /admin/applications
 * Supports optional trailing slashes, query parameters, and URL fragments.
 */
export function isLegacyApplicationRoute(link?: string | null): boolean {
  if (!link || typeof link !== 'string') return false;
  const clean = link.split('?')[0].split('#')[0].replace(/\/+$/, '');
  return (
    clean === '/student/applications' ||
    clean === '/mentor/applications' ||
    clean === '/admin/applications'
  );
}

export interface NotificationInboxProps {
  role: 'student' | 'mentor' | 'admin';
  title: string;
  subtitle: string;
  emptyTitle?: string;
  emptyDescription?: string;
}

export const NotificationInbox: React.FC<NotificationInboxProps> = ({
  role,
  title,
  subtitle,
  emptyTitle = 'All clear — no notifications',
  emptyDescription = 'You have no new alerts or notices right now.',
}) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Server-side pagination state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_NOTIFICATIONS_PAGE_SIZE);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [statusCounts, setStatusCounts] = useState<NotificationStatusCounts | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const userId = profile?.id || user?.id || '';

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);

  const loadStatusCounts = useCallback(async () => {
    if (!userId) return;
    const res = await getUserNotificationStatusCounts(userId);
    if (isMountedRef.current && !res.error) {
      setStatusCounts(res);
    }
  }, [userId]);

  const fetchNotifications = useCallback(
    async (isManualRefresh = false) => {
      if (!userId || !isMountedRef.current) return;

      const currentRequestId = ++requestIdRef.current;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const [notifsRes] = await Promise.all([
          getUserNotificationsPaginated({
            userId,
            page,
            pageSize,
            statusFilter,
            typeFilter,
          }),
          isManualRefresh ? loadStatusCounts() : Promise.resolve(),
        ]);

        if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
          return;
        }

        if (notifsRes.error) {
          setError(notifsRes.error.message || 'Unable to retrieve notifications.');
        } else {
          setNotifications(notifsRes.notifications);
          setPagination(notifsRes.pagination);
        }
      } catch (err: unknown) {
        if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
          return;
        }
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message || 'An unexpected error occurred while loading notifications.');
      } finally {
        inFlightRef.current = false;
        if (isMountedRef.current && currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [userId, page, pageSize, statusFilter, typeFilter, loadStatusCounts]
  );

  useEffect(() => {
    isMountedRef.current = true;
    fetchNotifications();
    loadStatusCounts();

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      const source = customEvent?.detail?.source;
      // Prevent self-triggered refetch on local mark-as-read actions
      if (source === 'single_read' || source === 'mark_all_read') {
        return;
      }
      fetchNotifications(false);
      loadStatusCounts();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('notifications-updated', handleUpdate);
    }

    return () => {
      isMountedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('notifications-updated', handleUpdate);
      }
    };
  }, [fetchNotifications, loadStatusCounts]);

  const handleStatusFilterChange = (newStatus: 'all' | 'unread' | 'read') => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleTypeFilterChange = (newType: string) => {
    setTypeFilter(newType);
    setPage(1);
  };

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userId || actionLoadingId === notificationId) return;

    const target = notifications.find((n) => n.id === notificationId);
    if (!target || target.read) return;

    // Optimistic local update
    const prevNotifications = notifications;
    const prevCounts = statusCounts;
    const now = new Date().toISOString();

    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notificationId ? { ...n, read: true, read_at: now } : n
      )
    );
    setStatusCounts((prev) =>
      prev
        ? {
            ...prev,
            unread: Math.max(0, prev.unread - 1),
            read: prev.read + 1,
          }
        : null
    );

    setActionLoadingId(notificationId);
    try {
      const { error: markErr } = await markNotificationAsRead(notificationId, userId);
      if (markErr) {
        // Rollback on failure
        setNotifications(prevNotifications);
        setStatusCounts(prevCounts);
        console.error('Failed to mark notification as read:', markErr);
      }
    } catch (err) {
      setNotifications(prevNotifications);
      setStatusCounts(prevCounts);
      console.error('Failed to mark notification as read:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId || isMarkingAll) return;

    const prevNotifications = notifications;
    const prevCounts = statusCounts;
    const now = new Date().toISOString();

    // Optimistic local update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true, read_at: n.read_at || now }))
    );
    setStatusCounts((prev) =>
      prev
        ? {
            ...prev,
            unread: 0,
            read: prev.all,
          }
        : null
    );

    setIsMarkingAll(true);
    try {
      const { error: markErr } = await markAllNotificationsAsRead(userId);
      if (markErr) {
        // Rollback on failure
        setNotifications(prevNotifications);
        setStatusCounts(prevCounts);
        console.error('Failed to mark all notifications as read:', markErr);
      }
    } catch (err) {
      setNotifications(prevNotifications);
      setStatusCounts(prevCounts);
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDelete = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userId || actionLoadingId === notificationId) return;

    const target = notifications.find((n) => n.id === notificationId);
    const prevNotifications = notifications;
    const prevCounts = statusCounts;

    // Optimistic local update
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    if (target) {
      setStatusCounts((prev) =>
        prev
          ? {
              ...prev,
              all: Math.max(0, prev.all - 1),
              unread: !target.read ? Math.max(0, prev.unread - 1) : prev.unread,
              read: target.read ? Math.max(0, prev.read - 1) : prev.read,
            }
          : null
      );
    }

    setActionLoadingId(notificationId);
    try {
      const { success, error: delErr } = await deleteNotification(notificationId, userId);
      if (!success || delErr) {
        setNotifications(prevNotifications);
        setStatusCounts(prevCounts);
        console.error('Failed to dismiss notification:', delErr);
      }
    } catch (err) {
      setNotifications(prevNotifications);
      setStatusCounts(prevCounts);
      console.error('Failed to dismiss notification:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const isSafeRoute = (link?: string | null) => {
    return Boolean(link && link.startsWith('/') && !link.startsWith('//') && !link.includes(':'));
  };

  const handleCardClick = async (notif: NotificationWithActor) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    if (isLegacyApplicationRoute(notif.link)) {
      // Historical application notification: marked as read, do not navigate to unrelated page
      return;
    }
    if (isSafeRoute(notif.link)) {
      navigate(notif.link as string);
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Just now';
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

  const unreadCount = statusCounts
    ? statusCounts.unread
    : notifications.filter((n) => !n.read).length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3 sm:space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="p-2.5 sm:p-6 border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-2.5 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
            <span className="font-mono text-[10px] sm:text-xs uppercase font-bold text-brand-teal tracking-wider">
              INBOX & ALERTS
            </span>
            {unreadCount > 0 ? (
              <Badge variant="gold" size="sm">
                {unreadCount} Unread
              </Badge>
            ) : (
              <Badge variant="muted" size="sm">
                All Read
              </Badge>
            )}
          </div>
          <h1 className="text-lg sm:text-2xl md:text-3xl font-heading font-extrabold text-brand-navy tracking-tight">
            {title}
          </h1>
          <p className="text-[11px] sm:text-sm text-brand-dark/80 mt-0.5 sm:mt-1 max-w-2xl font-sans">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(true)}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll}
              leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
            >
              {isMarkingAll ? 'Marking...' : 'Mark All Read'}
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-2.5 sm:p-4 border sm:border-2 border-brand-dark bg-red-50 text-red-900 shadow-none sm:shadow-brutal-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0" />
            <span className="text-xs font-mono">{error}</span>
          </div>
          <button
            onClick={() => fetchNotifications(true)}
            className="text-xs font-mono font-bold uppercase underline hover:text-brand-dark"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal p-2 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => handleStatusFilterChange('all')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase transition-colors border ${
              statusFilter === 'all'
                ? 'bg-brand-navy text-white border-brand-dark shadow-none sm:shadow-brutal-xs'
                : 'bg-brand-paper text-brand-dark border-brand-dark/30 hover:bg-brand-paper-tint'
            }`}
          >
            All ({statusCounts ? statusCounts.all : (pagination ? pagination.totalCount : notifications.length)})
          </button>
          <button
            onClick={() => handleStatusFilterChange('unread')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase transition-colors border ${
              statusFilter === 'unread'
                ? 'bg-brand-navy text-white border-brand-dark shadow-none sm:shadow-brutal-xs'
                : 'bg-brand-paper text-brand-dark border-brand-dark/30 hover:bg-brand-paper-tint'
            }`}
          >
            Unread ({statusCounts ? statusCounts.unread : unreadCount})
          </button>
          <button
            onClick={() => handleStatusFilterChange('read')}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-mono font-bold uppercase transition-colors border ${
              statusFilter === 'read'
                ? 'bg-brand-navy text-white border-brand-dark shadow-none sm:shadow-brutal-xs'
                : 'bg-brand-paper text-brand-dark border-brand-dark/30 hover:bg-brand-paper-tint'
            }`}
          >
            Read ({statusCounts ? statusCounts.read : Math.max(0, notifications.length - unreadCount)})
          </button>
        </div>

        {/* Type Filter Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => handleTypeFilterChange(e.target.value)}
            className="bg-brand-paper border sm:border-2 border-brand-dark px-2.5 sm:px-3 py-1.5 sm:py-1 text-base sm:text-xs min-h-[36px] sm:min-h-0 font-mono font-bold text-brand-navy shadow-none sm:shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal cursor-pointer"
            aria-label="Filter notifications by category"
          >
            <option value="all">All Categories</option>
            {role === 'mentor' && (
              <>
                <option value="submission_created">Submissions</option>
                <option value="doubt_created">Student Doubts</option>
                <option value="assignment_created">Assignments</option>
              </>
            )}
            {role === 'admin' && (
              <>
                <option value="application_submitted">Applications</option>
                <option value="capacity_alert">Capacity Alerts</option>
              </>
            )}
            {role === 'student' && (
              <>
                <option value="assignment_created">Assignments</option>
                <option value="task_created">Daily Tasks</option>
                <option value="submission_reviewed">Evaluations & Reviews</option>
                <option value="doubt_replied">Doubt Replies</option>
                <option value="plan_updated">Study Plans</option>
                <option value="resource_published">Resources</option>
                <option value="evaluation_published">Evaluations</option>
              </>
            )}
            <option value="announcement_published">Announcements</option>
            <option value="system">System Notices</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-6 sm:p-12 border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal text-center space-y-2 sm:space-y-3">
          <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-brand-teal mx-auto" />
          <p className="font-mono text-[10px] sm:text-xs text-brand-muted uppercase tracking-wider">
            Loading notifications...
          </p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-6 sm:p-10 border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal text-center space-y-2 sm:space-y-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 border sm:border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center mx-auto shadow-none sm:shadow-brutal-xs">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-brand-muted" />
          </div>
          <h2 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
            {emptyTitle}
          </h2>
          <p className="text-[11px] sm:text-xs text-brand-dark/70 max-w-sm mx-auto font-sans">
            {emptyDescription}
          </p>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
                setPage(1);
              }}
              className="mt-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 sm:space-y-3">
          {notifications.map((notif) => {
            const meta = getNotificationTypeMeta(notif.type, role);
            const Icon = meta.icon;
            const isLegacyApp = isLegacyApplicationRoute(notif.link);
            const hasLink = !isLegacyApp && isSafeRoute(notif.link);

            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`p-2.5 sm:p-5 border sm:border-2 border-brand-dark transition-all duration-100 ${
                  !notif.read
                    ? 'bg-amber-50/70 border-l-3 sm:border-l-6 border-l-brand-gold shadow-none sm:shadow-brutal'
                    : 'bg-brand-paper shadow-none sm:shadow-brutal-xs hover:bg-brand-paper-tint'
                } ${hasLink || !notif.read ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-2.5 sm:gap-4">
                  {/* Category Icon */}
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border sm:border-2 border-brand-dark bg-brand-paper flex items-center justify-center shrink-0 shadow-none sm:shadow-brutal-xs mt-0.5">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-brand-navy" />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 space-y-0.5 sm:space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Badge variant={meta.badgeVariant} size="sm">
                        {meta.label}
                      </Badge>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-brand-coral border border-brand-dark shrink-0" />
                      )}
                      <span className="font-mono text-[10px] sm:text-[11px] text-brand-muted">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>

                    <h2 className="font-heading font-bold text-xs sm:text-base text-brand-navy break-words">
                      {notif.title}
                    </h2>

                    <p className="font-sans text-[11px] sm:text-sm text-brand-dark/90 leading-relaxed break-words whitespace-pre-wrap">
                      {notif.message}
                    </p>

                    {/* Sender and destination indicator */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1 text-[10px] sm:text-[11px] font-mono text-brand-muted">
                      {notif.actor_name && (
                        <span>From: <strong className="text-brand-navy font-bold">{notif.actor_name}</strong></span>
                      )}
                      {isLegacyApp ? (
                        <span className="text-brand-muted font-bold font-mono">
                          Archived Notice
                        </span>
                      ) : hasLink ? (
                        <span className="text-brand-teal font-bold flex items-center gap-1 hover:underline">
                          <span>{meta.actionText}</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {!notif.read && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        disabled={actionLoadingId === notif.id}
                        className="p-1 sm:p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-gold hover:text-brand-dark text-brand-navy transition-colors shadow-none sm:shadow-brutal-xs"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      disabled={actionLoadingId === notif.id}
                      className="p-1 sm:p-1.5 border border-brand-dark bg-brand-paper hover:bg-red-500 hover:text-white text-brand-muted transition-colors shadow-none sm:shadow-brutal-xs"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Server-Side Pagination Controls */}
      {!loading && !error && pagination && pagination.totalCount > 0 && (
        <div className="pt-2">
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalCount={pagination.totalCount}
            pageSize={pagination.pageSize}
            onPageChange={setPage}
            isLoading={loading}
            ariaLabel="Notifications pagination"
          />
        </div>
      )}
    </div>
  );
};
