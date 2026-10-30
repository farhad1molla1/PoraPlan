import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getStudentNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type NotificationWithActor,
} from '../../lib/notifications';
import type { NotificationType } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Bell,
  CheckCircle2,
  CheckCheck,
  Trash2,
  ExternalLink,
  ListTodo,
  FileText,
  FileCheck,
  Calendar,
  HelpCircle,
  Megaphone,
  BookMarked,
  Compass,
  AlertCircle,
  Filter,
  RefreshCw,
} from 'lucide-react';

export const StudentNotificationsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const studentId = profile?.id || user?.id || '';

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!studentId) return;
    if (isRefresh) {
      setLoading(true);
    }
    setError(null);
    try {
      const { notifications: list, error: fetchErr } = await getStudentNotifications(studentId);
      if (fetchErr) {
        setError(fetchErr.message || 'Unable to retrieve your academic notifications.');
      } else {
        setNotifications(list);
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e.message || 'An unexpected error occurred while loading notifications.');
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;

    async function initialLoad() {
      try {
        const { notifications: list, error: fetchErr } = await getStudentNotifications(studentId);
        if (!isMounted) return;
        if (fetchErr) {
          setError(fetchErr.message || 'Unable to retrieve your academic notifications.');
        } else {
          setNotifications(list);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message || 'An unexpected error occurred while loading notifications.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initialLoad();
    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!studentId || actionLoadingId === notificationId) return;

    setActionLoadingId(notificationId);
    try {
      const { error: markErr } = await markNotificationAsRead(notificationId, studentId);
      if (!markErr) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n))
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!studentId || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      const { error: markErr } = await markAllNotificationsAsRead(studentId);
      if (!markErr) {
        const now = new Date().toISOString();
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, read: true, read_at: n.read_at || now }))
        );
      }
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleDelete = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!studentId || actionLoadingId === notificationId) return;

    setActionLoadingId(notificationId);
    try {
      const { success, error: delErr } = await deleteNotification(notificationId, studentId);
      if (success && !delErr) {
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      }
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const isSafeRoute = (link?: string | null) => {
    return Boolean(link && link.startsWith('/student/') && !link.startsWith('//') && !link.includes(':'));
  };

  const handleCardClick = async (notif: NotificationWithActor) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    if (isSafeRoute(notif.link)) {
      navigate(notif.link!);
    }
  };

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (statusFilter === 'unread' && n.read) return false;
      if (statusFilter === 'read' && !n.read) return false;
      if (typeFilter !== 'all' && n.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  const getTypeMeta = (type: NotificationType) => {
    switch (type) {
      case 'task_created':
        return {
          label: 'Task',
          icon: ListTodo,
          badgeVariant: 'teal' as const,
          actionText: 'View Task',
        };
      case 'assignment_created':
        return {
          label: 'Assignment',
          icon: FileText,
          badgeVariant: 'navy' as const,
          actionText: 'View Assignment',
        };
      case 'submission_reviewed':
        return {
          label: 'Reviewed',
          icon: FileCheck,
          badgeVariant: 'gold' as const,
          actionText: 'See Feedback',
        };
      case 'evaluation_published':
        return {
          label: 'Evaluation',
          icon: Calendar,
          badgeVariant: 'gold' as const,
          actionText: 'View Evaluation',
        };
      case 'doubt_replied':
        return {
          label: 'Doubt Reply',
          icon: HelpCircle,
          badgeVariant: 'danger' as const,
          actionText: 'Open Doubt',
        };
      case 'announcement_published':
        return {
          label: 'Notice',
          icon: Megaphone,
          badgeVariant: 'paper' as const,
          actionText: 'Read Notice',
        };
      case 'plan_updated':
        return {
          label: 'Study Plan',
          icon: Compass,
          badgeVariant: 'teal' as const,
          actionText: 'View Plan',
        };
      case 'resource_published':
        return {
          label: 'Resource',
          icon: BookMarked,
          badgeVariant: 'navy' as const,
          actionText: 'View Resource',
        };
      default:
        return {
          label: 'System',
          icon: Bell,
          badgeVariant: 'muted' as const,
          actionText: 'Open Link',
        };
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

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase font-bold text-brand-teal tracking-wider">
              INBOX & ALERTS
            </span>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-brand-coral text-white border border-brand-dark">
                {unreadCount} NEW
              </span>
            )}
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy">
            Notifications
          </h1>
          <p className="text-xs sm:text-sm text-brand-dark/70 font-sans mt-0.5">
            Updates and alerts from your mentor on tasks, plans, reviews, and announcements.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNotifications(true)}
            disabled={loading}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />}
            className="text-xs"
          >
            Refresh
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAll || loading}
              leftIcon={<CheckCheck className="w-3.5 h-3.5" />}
              className="text-xs font-bold"
            >
              {isMarkingAll ? 'Marking...' : 'Mark All Read'}
            </Button>
          )}
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-3 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-mono font-bold border-2 transition-all ${
              statusFilter === 'all'
                ? 'bg-brand-navy text-white border-brand-dark shadow-brutal-xs'
                : 'bg-brand-bg text-brand-dark border-brand-dark/30 hover:border-brand-dark'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('unread')}
            className={`px-3 py-1.5 text-xs font-mono font-bold border-2 transition-all flex items-center gap-1.5 ${
              statusFilter === 'unread'
                ? 'bg-brand-teal text-white border-brand-dark shadow-brutal-xs'
                : 'bg-brand-bg text-brand-dark border-brand-dark/30 hover:border-brand-dark'
            }`}
          >
            Unread
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] bg-brand-coral text-white rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('read')}
            className={`px-3 py-1.5 text-xs font-mono font-bold border-2 transition-all ${
              statusFilter === 'read'
                ? 'bg-brand-dark text-white border-brand-dark shadow-brutal-xs'
                : 'bg-brand-bg text-brand-dark border-brand-dark/30 hover:border-brand-dark'
            }`}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs font-mono font-bold border-2 border-brand-dark bg-brand-bg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-teal w-full sm:w-auto"
            aria-label="Filter notifications by event type"
          >
            <option value="all">All Notification Types</option>
            <option value="task_created">Tasks Assigned</option>
            <option value="assignment_created">Assignments</option>
            <option value="submission_reviewed">Submissions Reviewed</option>
            <option value="evaluation_published">Evaluations</option>
            <option value="doubt_replied">Doubt Replies</option>
            <option value="announcement_published">Announcements</option>
            <option value="plan_updated">Study Plans</option>
            <option value="resource_published">Resources</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 border-2 border-brand-coral bg-brand-coral/10 text-brand-coral flex items-center justify-between gap-3 shadow-brutal-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-bold font-mono">{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchNotifications(true)} className="text-xs bg-brand-paper">
            Retry
          </Button>
        </div>
      )}

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs animate-pulse space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-brand-dark/10 rounded w-24" />
                <div className="h-3 bg-brand-dark/10 rounded w-20" />
              </div>
              <div className="h-5 bg-brand-dark/15 rounded w-3/4" />
              <div className="h-4 bg-brand-dark/10 rounded w-full" />
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-8 sm:p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <div className="w-12 h-12 bg-brand-teal/10 border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
            <CheckCircle2 className="w-6 h-6 text-brand-teal" />
          </div>
          <h2 className="font-heading font-extrabold text-lg text-brand-navy">
            {statusFilter === 'unread' ? 'No Unread Notifications' : 'Notification Feed Clear'}
          </h2>
          <p className="text-xs sm:text-sm text-brand-muted max-w-md mx-auto">
            {statusFilter === 'unread'
              ? 'You have caught up with all mentor tasks, assignment reviews, and announcements.'
              : 'When your mentors publish study plans, assign tasks, review assignments, or reply to doubts, notifications will appear here.'}
          </p>
          {statusFilter !== 'all' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="text-xs mt-2"
            >
              View All Notifications
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const meta = getTypeMeta(notif.type);
            const TypeIcon = meta.icon;
            const isUnread = !notif.read;

            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`p-4 border-2 border-brand-dark transition-all relative ${
                  isUnread
                    ? 'bg-brand-paper border-l-8 border-l-brand-teal shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 cursor-pointer'
                    : isSafeRoute(notif.link)
                    ? 'bg-brand-paper/80 border-l-4 border-l-brand-dark/30 shadow-brutal-xs hover:bg-brand-paper cursor-pointer'
                    : 'bg-brand-paper/80 border-l-4 border-l-brand-dark/30 shadow-brutal-xs'
                }`}
              >
                {/* Top metadata row */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={meta.badgeVariant} size="sm" className="font-mono text-[10px] font-bold">
                      <TypeIcon className="w-3 h-3 mr-1 inline" />
                      {meta.label}
                    </Badge>
                    {isUnread && (
                      <span className="flex items-center gap-1 font-mono text-[10px] font-bold text-brand-teal">
                        <span className="w-2 h-2 rounded-full bg-brand-teal animate-pulse" />
                        UNREAD
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-[11px] text-brand-muted">
                    {formatDate(notif.created_at)}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <h3 className={`font-heading text-base ${isUnread ? 'font-bold text-brand-navy' : 'font-semibold text-brand-dark'}`}>
                    {notif.title}
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                {/* Bottom row: Actor & Actions */}
                <div className="mt-3 pt-2.5 border-t border-brand-dark/15 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-brand-muted">
                    <span>Source:</span>
                    <span className="font-bold text-brand-dark">
                      {notif.actor_name || 'Academic Faculty'}
                    </span>
                    {notif.actor_poraplan_id && (
                      <span className="text-[10px] text-brand-teal font-bold">
                        ({notif.actor_poraplan_id})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isSafeRoute(notif.link) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCardClick(notif);
                        }}
                        rightIcon={<ExternalLink className="w-3 h-3" />}
                        className="text-[11px] py-1 px-2.5 h-auto bg-brand-paper hover:bg-brand-paper-tint"
                      >
                        {meta.actionText}
                      </Button>
                    )}

                    {isUnread ? (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        disabled={actionLoadingId === notif.id}
                        className="px-2.5 py-1 text-[11px] font-mono font-bold border border-brand-dark bg-brand-bg hover:bg-brand-teal hover:text-white transition-colors"
                        title="Mark as read"
                      >
                        Mark Read
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-brand-muted flex items-center gap-1">
                        <CheckCheck className="w-3 h-3 text-brand-teal" /> Read
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDelete(notif.id, e)}
                      disabled={actionLoadingId === notif.id}
                      className="p-1 text-brand-muted hover:text-brand-coral transition-colors"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
