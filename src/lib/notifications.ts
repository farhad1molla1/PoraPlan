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
  getMockStudentNotifications,
  getMockUnreadNotificationCount,
  createMockNotification,
  markMockNotificationAsRead,
  markAllMockNotificationsAsRead,
  deleteMockNotification,
} from './mockAuthStore';

export interface NotificationWithActor extends Notification {
  actor_name?: string;
  actor_role?: string;
  actor_poraplan_id?: string;
}

function notifyUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('notifications-updated'));
  }
}

/**
 * Fetch all notifications belonging to a student.
 */
export async function getStudentNotifications(studentId: string): Promise<{
  notifications: NotificationWithActor[];
  error: Error | null;
}> {
  if (!studentId) {
    return { notifications: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockStudentNotifications(studentId);
    return { notifications: list as NotificationWithActor[], error: null };
  }

  try {
    const { data, error } = await (supabase.from('notifications') as any)
      .select('*, profiles!actor_id(full_name, role, poraplan_id)')
      .eq('recipient_id', studentId)
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
      actor_name: row.profiles?.full_name || (row.type === 'system' ? 'PoraPlan System' : 'Academic Faculty'),
      actor_role: row.profiles?.role,
      actor_poraplan_id: row.profiles?.poraplan_id,
    }));

    return { notifications, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { notifications: [], error };
  }
}

/**
 * Get total unread notification count for a student.
 */
export async function getUnreadNotificationCount(studentId: string): Promise<{
  count: number;
  error: Error | null;
}> {
  if (!studentId) {
    return { count: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const count = getMockUnreadNotificationCount(studentId);
    return { count, error: null };
  }

  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', studentId)
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
    if (!res.error) notifyUpdate();
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
        notifyUpdate();
        return { notification: existing as Notification, error: null };
      }
      return { notification: null, error };
    }

    notifyUpdate();
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
  studentId: string
): Promise<{
  notification: Notification | null;
  error: Error | null;
}> {
  if (!notificationId || !studentId) {
    return { notification: null, error: new Error('Notification ID and Student ID are required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = markMockNotificationAsRead(notificationId, studentId);
    if (!res.error) notifyUpdate();
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
      .eq('recipient_id', studentId)
      .select('*')
      .single();

    if (error) {
      return { notification: null, error };
    }

    notifyUpdate();
    return { notification: data as Notification, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { notification: null, error };
  }
}

/**
 * Mark all unread notifications for a student as read.
 */
export async function markAllNotificationsAsRead(studentId: string): Promise<{
  count: number;
  error: Error | null;
}> {
  if (!studentId) {
    return { count: 0, error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = markAllMockNotificationsAsRead(studentId);
    if (!res.error) notifyUpdate();
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
      .eq('recipient_id', studentId)
      .eq('read', false)
      .select('id');

    if (error) {
      return { count: 0, error };
    }

    notifyUpdate();
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
  studentId: string
): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!notificationId || !studentId) {
    return { success: false, error: new Error('Notification ID and Student ID are required.') };
  }

  if (!isSupabaseConfigured()) {
    const res = deleteMockNotification(notificationId, studentId);
    if (res.success) notifyUpdate();
    return res;
  }

  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('recipient_id', studentId);

    if (error) {
      return { success: false, error };
    }

    notifyUpdate();
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
