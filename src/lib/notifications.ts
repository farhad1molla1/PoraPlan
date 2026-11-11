/**
 * PoraPlan — Mentor-Triggered Notifications Service Layer (Milestone 17)
 *
 * Provides student in-app notifications center, unread counters, mark-as-read workflows,
 * and reliable mentor/admin event dispatching with idempotency and cross-student isolation.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Notification,
  NotificationInsert,
  NotificationType,
} from '../types/database';
import {
  DEFAULT_PAGE,
  type PaginationMeta,
  type PaginationParams,
} from '../types/pagination';
import {
  calculatePaginationRange,
  createPaginationMeta,
} from './pagination';
import {
  getMockUserNotifications,
  getMockUnreadNotificationCount,
  createMockNotification,
  markMockNotificationAsRead,
  markAllMockNotificationsAsRead,
  deleteMockNotification,
} from './mockAuthStore';

export const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 25;

export interface NotificationWithActor extends Notification {
  actor_name?: string;
  actor_role?: string;
  actor_poraplan_id?: string;
}

export interface NotificationEventDetail {
  source?: string;
  notificationId?: string;
  count?: number;
}

export function notifyUpdate(detail?: NotificationEventDetail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('notifications-updated', { detail }));
  }
}

export interface UserNotificationsPaginatedParams extends PaginationParams {
  userId: string;
  statusFilter?: 'all' | 'unread' | 'read';
  typeFilter?: string;
}

export interface UserNotificationsPaginatedResult {
  notifications: NotificationWithActor[];
  pagination: PaginationMeta;
  error: Error | null;
}

export interface NotificationStatusCounts {
  all: number;
  unread: number;
  read: number;
  error: Error | null;
}

/**
 * Fetch all notifications belonging to a member (Student, Mentor, or Admin).
 */
export async function getUserNotifications(userId: string): Promise<{
  notifications: NotificationWithActor[];
  error: Error | null;
}> {
  if (!userId) {
    return { notifications: [], error: new Error('User ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockUserNotifications(userId);
    return { notifications: list as NotificationWithActor[], error: null };
  }

  try {
    const { data, error } = await (supabase.from('notifications') as any)
      .select('*, profiles!actor_id(full_name, role, poraplan_id)')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return { notifications: [], error };
    }

    const notifications: NotificationWithActor[] = (data || []).map((row: any) => ({
      id: row.id,
      recipient_id: row.recipient_id,
      actor_id: row.actor_id,
      type: row.type,
      title: row.title,
      message: row.message,
      link: row.link,
      read: row.read,
      read_at: row.read_at,
      idempotency_key: row.idempotency_key,
      created_at: row.created_at,
      actor_name: row.profiles?.full_name || (row.type === 'system' ? 'PoraPlan System' : 'Academic Member'),
      actor_role: row.profiles?.role,
      actor_poraplan_id: row.profiles?.poraplan_id,
    }));

    return { notifications, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { notifications: [], error };
  }
}

/** Backward-compatible & role-specific aliases */
export const getStudentNotifications = getUserNotifications;
export const getMentorNotifications = getUserNotifications;
export const getAdminNotifications = getUserNotifications;

/**
 * Fetch paginated notifications belonging to a member (Student, Mentor, or Admin).
 * Enforces server-side status/type filters, deterministic ordering, and standard pagination metadata.
 */
export async function getUserNotificationsPaginated(
  params: UserNotificationsPaginatedParams
): Promise<UserNotificationsPaginatedResult> {
  const { userId, statusFilter = 'all', typeFilter = 'all' } = params;
  const page = params.page ?? DEFAULT_PAGE;
  const pageSize = params.pageSize ?? DEFAULT_NOTIFICATIONS_PAGE_SIZE;
  const range = calculatePaginationRange({ page, pageSize });

  const emptyMeta = createPaginationMeta({
    page: range.page,
    pageSize: range.pageSize,
    totalCount: 0,
  });

  if (!userId) {
    return {
      notifications: [],
      pagination: emptyMeta,
      error: new Error('User ID is required.'),
    };
  }

  if (!isSupabaseConfigured()) {
    let list = (getMockUserNotifications(userId) as NotificationWithActor[]) || [];

    if (statusFilter === 'unread') {
      list = list.filter((n) => !n.read);
    } else if (statusFilter === 'read') {
      list = list.filter((n) => n.read);
    }

    if (typeFilter && typeFilter !== 'all') {
      if (typeFilter === 'task_created') {
        list = list.filter((n) => n.type === 'task_created' || n.type === 'task_updated');
      } else if (typeFilter === 'assignment_created') {
        list = list.filter(
          (n) =>
            n.type === 'assignment_created' ||
            n.type === 'assignment_updated' ||
            n.type === 'assignment_deadline_reminder'
        );
      } else {
        list = list.filter((n) => n.type === typeFilter);
      }
    }

    // Deterministic sort: created_at DESC (nulls last), id ASC
    list.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (a.id || '').localeCompare(b.id || '');
    });

    const totalCount = list.length;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });
    const sliced = list.slice(range.from, range.to + 1);

    return {
      notifications: sliced,
      pagination,
      error: null,
    };
  }

  try {
    let query = (supabase.from('notifications') as any)
      .select('*, profiles!actor_id(full_name, role, poraplan_id)', { count: 'exact' })
      .eq('recipient_id', userId);

    if (statusFilter === 'unread') {
      query = query.eq('read', false);
    } else if (statusFilter === 'read') {
      query = query.eq('read', true);
    }

    if (typeFilter && typeFilter !== 'all') {
      if (typeFilter === 'task_created') {
        query = query.in('type', ['task_created', 'task_updated']);
      } else if (typeFilter === 'assignment_created') {
        query = query.in('type', [
          'assignment_created',
          'assignment_updated',
          'assignment_deadline_reminder',
        ]);
      } else {
        query = query.eq('type', typeFilter);
      }
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(range.from, range.to);

    if (error) {
      return {
        notifications: [],
        pagination: emptyMeta,
        error,
      };
    }

    const notifications: NotificationWithActor[] = (data || []).map((row: any) => ({
      id: row.id,
      recipient_id: row.recipient_id,
      actor_id: row.actor_id,
      type: row.type,
      title: row.title,
      message: row.message,
      link: row.link,
      read: row.read,
      read_at: row.read_at,
      idempotency_key: row.idempotency_key,
      created_at: row.created_at,
      actor_name:
        row.profiles?.full_name ||
        (row.type === 'system' ? 'PoraPlan System' : 'Academic Member'),
      actor_role: row.profiles?.role,
      actor_poraplan_id: row.profiles?.poraplan_id,
    }));

    const totalCount = count ?? 0;
    const pagination = createPaginationMeta({
      page: range.page,
      pageSize: range.pageSize,
      totalCount,
    });

    return {
      notifications,
      pagination,
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return {
      notifications: [],
      pagination: emptyMeta,
      error,
    };
  }
}

/** Paginated role-specific aliases */
export const getStudentNotificationsPaginated = getUserNotificationsPaginated;
export const getMentorNotificationsPaginated = getUserNotificationsPaginated;
export const getAdminNotificationsPaginated = getUserNotificationsPaginated;

/**
 * Get notification status counts (all, unread, read) for a user.
 * Uses lightweight count: exact with head: true to minimize database network transfer.
 */
export async function getUserNotificationStatusCounts(
  userId: string
): Promise<NotificationStatusCounts> {
  if (!userId) {
    return { all: 0, unread: 0, read: 0, error: new Error('User ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockUserNotifications(userId);
    const unread = list.filter((n) => !n.read).length;
    const all = list.length;
    return { all, unread, read: Math.max(0, all - unread), error: null };
  }

  try {
    const [allRes, unreadRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', userId)
        .eq('read', false),
    ]);

    if (allRes.error) {
      return { all: 0, unread: 0, read: 0, error: allRes.error };
    }
    if (unreadRes.error) {
      return { all: 0, unread: 0, read: 0, error: unreadRes.error };
    }

    const all = allRes.count ?? 0;
    const unread = unreadRes.count ?? 0;
    return {
      all,
      unread,
      read: Math.max(0, all - unread),
      error: null,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { all: 0, unread: 0, read: 0, error };
  }
}

export const getStudentNotificationStatusCounts = getUserNotificationStatusCounts;
export const getMentorNotificationStatusCounts = getUserNotificationStatusCounts;
export const getAdminNotificationStatusCounts = getUserNotificationStatusCounts;

/**
 * Get total unread notification count for a user (Student, Mentor, or Admin).
 */
export async function getUnreadNotificationCount(userId: string): Promise<{
  count: number;
  error: Error | null;
}> {
  if (!userId) {
    return { count: 0, error: new Error('User ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const count = getMockUnreadNotificationCount(userId);
    return { count, error: null };
  }

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false);

    if (error) {
      return { count: 0, error };
    }

    return { count: count || 0, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { count: 0, error };
  }
}

export const getStudentUnreadNotificationCount = getUnreadNotificationCount;

/**
 * Create a notification for a recipient scholar.
 * Enforces idempotency if an idempotency key is provided.
 */
export async function createNotification(params: {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  idempotencyKey?: string | null;
}): Promise<{
  notification: Notification | null;
  error: Error | null;
}> {
  if (!params.recipientId) {
    return { notification: null, error: new Error('Recipient ID is required.') };
  }
  if (!params.title || !params.title.trim()) {
    return { notification: null, error: new Error('Notification title is required.') };
  }
  if (!params.message || !params.message.trim()) {
    return { notification: null, error: new Error('Notification message is required.') };
  }
  if (params.link) {
    if (!params.link.startsWith('/') || params.link.startsWith('//') || params.link.includes(':')) {
      return { notification: null, error: new Error('Notification link must be a safe internal route.') };
    }
  }

  if (!isSupabaseConfigured()) {
    const res = createMockNotification(params);
    if (!res.error) notifyUpdate({ source: 'create' });
    return res;
  }

  try {
    const payload: NotificationInsert = {
      recipient_id: params.recipientId,
      actor_id: params.actorId || null,
      type: params.type,
      title: params.title.trim(),
      message: params.message.trim(),
      link: params.link || null,
      idempotency_key: params.idempotencyKey || null,
      read: false,
    };

    const { data, error } = await supabase
      .from('notifications')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      // If unique constraint violation on idempotency_key, fetch existing
      if (error.code === '23505' && params.idempotencyKey) {
        const { data: existing } = await supabase
          .from('notifications')
          .select('*')
          .eq('recipient_id', params.recipientId)
          .eq('idempotency_key', params.idempotencyKey)
          .single();
        notifyUpdate({ source: 'create' });
        return { notification: existing as Notification, error: null };
      }
      return { notification: null, error };
    }

    notifyUpdate({ source: 'create' });
    return { notification: data as Notification, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { notification: null, error };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<{
  notification: Notification | null;
  error: Error | null;
}> {
  if (!notificationId || !userId) {
    return { notification: null, error: new Error('Notification ID and User ID are required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = markMockNotificationAsRead(notificationId, userId);
    if (!res.error) notifyUpdate({ source: 'single_read', notificationId });
    return res;
  }

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: now,
      })
      .eq('id', notificationId)
      .eq('recipient_id', userId)
      .select('*')
      .single();

    if (error) {
      return { notification: null, error };
    }

    notifyUpdate({ source: 'single_read', notificationId });
    return { notification: data as Notification, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { notification: null, error };
  }
}

/**
 * Mark all unread notifications for a user as read.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<{
  count: number;
  error: Error | null;
}> {
  if (!userId) {
    return { count: 0, error: new Error('User ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = markAllMockNotificationsAsRead(userId);
    if (!res.error) notifyUpdate({ source: 'mark_all_read', count: 0 });
    return res;
  }

  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: now,
      })
      .eq('recipient_id', userId)
      .eq('read', false)
      .select('id');

    if (error) {
      return { count: 0, error };
    }

    notifyUpdate({ source: 'mark_all_read', count: 0 });
    return { count: data?.length || 0, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { count: 0, error };
  }
}

/**
 * Delete a notification.
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!notificationId || !userId) {
    return { success: false, error: new Error('Notification ID and User ID are required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = deleteMockNotification(notificationId, userId);
    if (res.success) notifyUpdate({ source: 'delete', notificationId });
    return res;
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', userId);

    if (error) {
      return { success: false, error };
    }

    notifyUpdate({ source: 'delete', notificationId });
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
