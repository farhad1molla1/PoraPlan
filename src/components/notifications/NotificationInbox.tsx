import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  type NotificationWithActor,
} from '../../lib/notifications';
import type { NotificationType } from '../../types/database';
import { Badge, type BadgeVariant } from '../common/Badge';
import { Button } from '../common/Button';
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
  Clock,
  AlertTriangle,
  ClipboardList,
  Filter,
  RefreshCw,
  Loader2,
} from 'lucide-react';

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

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const userId = profile?.id || user?.id || '';

  const fetchNotifications = useCallback(
    async (isRefresh = false) => {
      if (!userId) return;
      if (isRefresh) setLoading(true);
      setError(null);
      try {
        const { notifications: list, error: fetchErr } = await getUserNotifications(userId);
        if (fetchErr) {
          setError(fetchErr.message || 'Unable to retrieve notifications.');
        } else {
          setNotifications(list);
        }
      } catch (err: unknown) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message || 'An unexpected error occurred while loading notifications.');
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  useEffect(() => {
    fetchNotifications();

    const handleUpdate = () => {
      fetchNotifications();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('notifications-updated', handleUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('notifications-updated', handleUpdate);
      }
    };
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notificationId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userId || actionLoadingId === notificationId) return;

    setActionLoadingId(notificationId);
    try {
      const { error: markErr } = await markNotificationAsRead(notificationId, userId);
      if (!markErr) {
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n
          )
        );
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId || isMarkingAll) return;
    setIsMarkingAll(true);
    try {
      const { error: markErr } = await markAllNotificationsAsRead(userId);
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
    if (!userId || actionLoadingId === notificationId) return;

    setActionLoadingId(notificationId);
    try {
      const { success, error: delErr } = await deleteNotification(notificationId, userId);
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
    return Boolean(link && link.startsWith('/') && !link.startsWith('//') && !link.includes(':'));
  };

  const handleCardClick = async (notif: NotificationWithActor) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    if (isSafeRoute(notif.link)) {
      navigate(notif.link as string);
    }
  };

  // Type metadata resolver
  const getTypeMeta = (type: NotificationType) => {
    switch (type) {
      case 'submission_created':
        return {
          label: 'Submission',
          icon: FileCheck,
          badgeVariant: 'teal' as BadgeVariant,
          actionText: 'Review Submission',
        };
      case 'submission_reviewed':
        return {
          label: 'Review',
          icon: CheckCircle2,
          badgeVariant: 'gold' as BadgeVariant,
          actionText: 'View Feedback',
        };
      case 'assignment_deadline_reminder':
        return {
          label: 'Deadline Reminder',
          icon: Clock,
          badgeVariant: 'danger' as BadgeVariant,
          actionText: 'View Assignment',
        };
      case 'assignment_created':
      case 'assignment_updated':
        return {
          label: 'Assignment',
          icon: FileText,
          badgeVariant: 'gold' as BadgeVariant,
          actionText: 'View Assignment',
        };
      case 'doubt_created':
        return {
          label: 'New Doubt',
          icon: HelpCircle,
          badgeVariant: 'gold' as BadgeVariant,
          actionText: 'Open Doubt',
        };
      case 'doubt_replied':
        return {
          label: 'Doubt Reply',
          icon: HelpCircle,
          badgeVariant: 'teal' as BadgeVariant,
          actionText: 'View Response',
        };
      case 'application_submitted':
        return {
          label: 'Application',
          icon: ClipboardList,
          badgeVariant: 'navy' as BadgeVariant,
          actionText: 'Review Application',
        };
      case 'capacity_alert':
        return {
          label: 'Capacity Alert',
          icon: AlertTriangle,
          badgeVariant: 'danger' as BadgeVariant,
          actionText: 'View Cohorts',
        };
      case 'task_created':
      case 'task_updated':
        return {
          label: 'Target Task',
          icon: ListTodo,
          badgeVariant: 'teal' as BadgeVariant,
          actionText: 'View Tasks',
        };
      case 'evaluation_published':
        return {
          label: 'Evaluation',
          icon: Calendar,
          badgeVariant: 'gold' as BadgeVariant,
          actionText: 'View Evaluation',
        };
      case 'announcement_published':
        return {
          label: 'Announcement',
          icon: Megaphone,
          badgeVariant: 'danger' as BadgeVariant,
          actionText: 'Read Notice',
        };
      case 'plan_updated':
        return {
          label: 'Study Plan',
          icon: Compass,
          badgeVariant: 'teal' as BadgeVariant,
          actionText: 'View Plan',
        };
      case 'resource_published':
        return {
          label: 'Resource',
          icon: BookMarked,
          badgeVariant: 'navy' as BadgeVariant,
          actionText: 'View Resource',
        };
      case 'system':
      default:
        return {
          label: 'System',
          icon: Bell,
          badgeVariant: 'muted' as BadgeVariant,
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

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      if (statusFilter === 'unread' && item.read) return false;
      if (statusFilter === 'read' && !item.read) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });
  }, [notifications, statusFilter, typeFilter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12 animate-fade-in">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase font-bold text-brand-teal tracking-wider">
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
          <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-brand-navy tracking-tight">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-brand-dark/80 mt-1 max-w-2xl font-sans">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
        <div className="p-4 border-2 border-brand-dark bg-red-50 text-red-900 shadow-brutal-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
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
      <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors border ${
              statusFilter === 'all'
                ? 'bg-brand-navy text-white border-brand-dark shadow-brutal-xs'
                : 'bg-white text-brand-dark border-brand-dark/30 hover:bg-brand-paper-tint'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setStatusFilter('unread')}
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors border ${
              statusFilter === 'unread'
                ? 'bg-brand-navy text-white border-brand-dark shadow-brutal-xs'
                : 'bg-white text-brand-dark border-brand-dark/30 hover:bg-brand-paper-tint'
            }`}
          >
            Unread ({unreadCount})
          </button>
          <button
            onClick={() => setStatusFilter('read')}
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase transition-colors border ${
              statusFilter === 'read'
                ? 'bg-brand-navy text-white border-brand-dark shadow-brutal-xs'
                : 'bg-white text-brand-dark border-brand-dark/30 hover:bg-brand-paper-tint'
            }`}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>

        {/* Type Filter Dropdown */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-brand-muted shrink-0" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border-2 border-brand-dark px-2.5 py-1 text-xs font-mono font-bold text-brand-navy shadow-brutal-xs focus:outline-none focus:ring-1 focus:ring-brand-teal"
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
              </>
            )}
            <option value="announcement_published">Announcements</option>
            <option value="system">System Notices</option>
          </select>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
          <p className="font-mono text-xs text-brand-muted uppercase tracking-wider">
            Loading notifications...
          </p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="p-10 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
          <div className="w-12 h-12 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center mx-auto shadow-brutal-xs">
            <Bell className="w-6 h-6 text-brand-muted" />
          </div>
          <h2 className="font-heading font-extrabold text-base text-brand-navy">
            {emptyTitle}
          </h2>
          <p className="text-xs text-brand-dark/70 max-w-sm mx-auto font-sans">
            {emptyDescription}
          </p>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatusFilter('all');
                setTypeFilter('all');
              }}
              className="mt-2"
            >
              Reset Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => {
            const meta = getTypeMeta(notif.type);
            const Icon = meta.icon;
            const hasLink = isSafeRoute(notif.link);

            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`p-4 sm:p-5 border-2 border-brand-dark transition-all duration-100 ${
                  !notif.read
                    ? 'bg-amber-50/70 border-l-6 border-l-brand-gold shadow-brutal'
                    : 'bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint'
                } ${hasLink ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  {/* Category Icon */}
                  <div className="w-10 h-10 border-2 border-brand-dark bg-brand-paper flex items-center justify-center shrink-0 shadow-brutal-xs mt-0.5">
                    <Icon className="w-5 h-5 text-brand-navy" />
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={meta.badgeVariant} size="sm">
                        {meta.label}
                      </Badge>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-brand-coral border border-brand-dark shrink-0" />
                      )}
                      <span className="font-mono text-[11px] text-brand-muted">
                        {formatDate(notif.created_at)}
                      </span>
                    </div>

                    <h2 className="font-heading font-bold text-sm sm:text-base text-brand-navy break-words">
                      {notif.title}
                    </h2>

                    <p className="font-sans text-xs sm:text-sm text-brand-dark/90 leading-relaxed break-words whitespace-pre-wrap">
                      {notif.message}
                    </p>

                    {/* Sender and destination indicator */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-brand-muted">
                      {notif.actor_name && (
                        <span>From: <strong className="text-brand-navy font-bold">{notif.actor_name}</strong></span>
                      )}
                      {hasLink && (
                        <span className="text-brand-teal font-bold flex items-center gap-1 hover:underline">
                          <span>{meta.actionText}</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {!notif.read && (
                      <button
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        disabled={actionLoadingId === notif.id}
                        className="p-1.5 border border-brand-dark bg-white hover:bg-brand-gold hover:text-brand-dark text-brand-navy transition-colors shadow-brutal-xs"
                        title="Mark as read"
                        aria-label="Mark as read"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(notif.id, e)}
                      disabled={actionLoadingId === notif.id}
                      className="p-1.5 border border-brand-dark bg-white hover:bg-red-500 hover:text-white text-brand-muted transition-colors shadow-brutal-xs"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <Trash2 className="w-4 h-4" />
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
