/**
 * PoraPlan — Academic Announcements & Notices Desk Service Layer
 *
 * Provides mentor and admin announcement creation, multi-tier audience targeting
 * (individual scholar, mentor-assigned cohort, platform-wide), per-student acknowledgment
 * isolation, and status/archive management across Supabase and mock stores.
 */

import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Announcement,
  AnnouncementInsert,
  AnnouncementUpdate,
  AnnouncementScope,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementAcknowledgment,
} from '../types/database';
import {
  getMockStudentAnnouncements,
  getMockMentorAnnouncements,
  getMockAnnouncementById,
  createMockAnnouncement,
  updateMockAnnouncement,
  acknowledgeMockAnnouncement,
  deleteMockAnnouncement,
} from './mockAuthStore';
import { createNotification } from './notifications';

export interface AnnouncementAcknowledgmentWithScholar extends AnnouncementAcknowledgment {
  student_name?: string;
  student_poraplan_id?: string;
}

export interface AnnouncementWithMeta extends Announcement {
  author_name?: string;
  author_role?: string;
  author_poraplan_id?: string;
  student_name?: string;
  student_poraplan_id?: string;
  subject_name?: string;
  subject_code?: string | null;
  is_acknowledged?: boolean;
  acknowledged_at?: string | null;
  acknowledgments_count?: number;
  acknowledgments?: AnnouncementAcknowledgmentWithScholar[];
}

/**
 * Fetch all announcements targeted to a student (platform-wide, mentor cohort, or individual).
 */
export async function getStudentAnnouncements(studentId: string, programId?: string): Promise<{
  announcements: AnnouncementWithMeta[];
  error: Error | null;
}> {
  if (!studentId) {
    return { announcements: [], error: new Error('Student ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    let list = getMockStudentAnnouncements(studentId);
    if (programId && programId !== 'all') {
      list = list.filter((a) => !a.program_id || a.program_id === programId);
    }
    return { announcements: list as AnnouncementWithMeta[], error: null };
  }

  try {
    let query = (supabase.from('announcements') as any)
      .select('*, profiles!author_id(full_name, poraplan_id, role), subjects(name, code), announcement_acknowledgments(id, student_id, acknowledged_at)')
      .eq('status', 'published');

    if (programId && programId !== 'all') {
      query = query.or(`program_id.is.null,program_id.eq.${programId}`);
    }

    const { data, error } = await query.order('published_at', { ascending: false });

    if (error) {
      return { announcements: [], error };
    }

    const announcements: AnnouncementWithMeta[] = (data || []).map((row: any) => {
      const acks: any[] = row.announcement_acknowledgments || [];
      const userAck = acks.find((ack) => ack.student_id === studentId);

      return {
        id: row.id,
        author_id: row.author_id,
        title: row.title,
        content: row.content,
        target_scope: row.target_scope,
        student_id: row.student_id,
        subject_id: row.subject_id,
        priority: row.priority,
        status: row.status,
        published_at: row.published_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        author_name: row.profiles?.full_name || 'Academic Faculty',
        author_role: row.profiles?.role,
        author_poraplan_id: row.profiles?.poraplan_id,
        subject_name: row.subjects?.name,
        subject_code: row.subjects?.code,
        is_acknowledged: Boolean(userAck),
        acknowledged_at: userAck?.acknowledged_at || null,
        acknowledgments_count: acks.length,
      };
    });

    return { announcements, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { announcements: [], error };
  }
}

/**
 * Fetch announcements managed by a mentor or all announcements for administrators.
 */
export async function getMentorAnnouncements(
  userId: string,
  userRole?: string
): Promise<{
  announcements: AnnouncementWithMeta[];
  error: Error | null;
}> {
  if (!userId) {
    return { announcements: [], error: new Error('User ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const list = getMockMentorAnnouncements(userId);
    return { announcements: list as AnnouncementWithMeta[], error: null };
  }

  try {
    let query = (supabase.from('announcements') as any)
      .select('*, profiles!author_id(full_name, poraplan_id, role), profiles!student_id(full_name, poraplan_id), subjects(name, code), announcement_acknowledgments(*, profiles!student_id(full_name, poraplan_id))')
      .order('published_at', { ascending: false });

    // Mentors only see their own authored announcements; admins see all
    if (userRole !== 'admin') {
      query = query.eq('author_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      return { announcements: [], error };
    }

    const announcements: AnnouncementWithMeta[] = (data || []).map((row: any) => {
      const rawAcks: any[] = row.announcement_acknowledgments || [];
      const acknowledgments: AnnouncementAcknowledgmentWithScholar[] = rawAcks.map((ack) => ({
        id: ack.id,
        announcement_id: ack.announcement_id,
        student_id: ack.student_id,
        acknowledged_at: ack.acknowledged_at,
        student_name: ack.profiles?.full_name || 'Scholar',
        student_poraplan_id: ack.profiles?.poraplan_id,
      }));

      return {
        id: row.id,
        author_id: row.author_id,
        title: row.title,
        content: row.content,
        target_scope: row.target_scope,
        student_id: row.student_id,
        subject_id: row.subject_id,
        priority: row.priority,
        status: row.status,
        published_at: row.published_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        author_name: row.profiles?.full_name || 'Academic Faculty',
        author_role: row.profiles?.role,
        author_poraplan_id: row.profiles?.poraplan_id,
        student_name: row.profiles_student_id?.full_name,
        student_poraplan_id: row.profiles_student_id?.poraplan_id,
        subject_name: row.subjects?.name,
        subject_code: row.subjects?.code,
        acknowledgments_count: acknowledgments.length,
        acknowledgments,
      };
    });

    return { announcements, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { announcements: [], error };
  }
}

/**
 * Fetch a single announcement by ID with authorization verification.
 */
export async function getAnnouncementById(
  announcementId: string,
  viewerId: string
): Promise<{
  announcement: AnnouncementWithMeta | null;
  error: Error | null;
}> {
  if (!announcementId) {
    return { announcement: null, error: new Error('Announcement ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    const result = getMockAnnouncementById(announcementId, viewerId);
    return { announcement: result.announcement as AnnouncementWithMeta | null, error: result.error };
  }

  try {
    const { data, error } = await (supabase.from('announcements') as any)
      .select('*, profiles!author_id(full_name, poraplan_id, role), profiles!student_id(full_name, poraplan_id), subjects(name, code), announcement_acknowledgments(*, profiles!student_id(full_name, poraplan_id))')
      .eq('id', announcementId)
      .single();

    if (error) {
      return { announcement: null, error };
    }

    const rawAcks: any[] = data.announcement_acknowledgments || [];
    const acknowledgments: AnnouncementAcknowledgmentWithScholar[] = rawAcks.map((ack) => ({
      id: ack.id,
      announcement_id: ack.announcement_id,
      student_id: ack.student_id,
      acknowledged_at: ack.acknowledged_at,
      student_name: ack.profiles?.full_name || 'Scholar',
      student_poraplan_id: ack.profiles?.poraplan_id,
    }));

    const userAck = acknowledgments.find((ack) => ack.student_id === viewerId);

    const announcement: AnnouncementWithMeta = {
      id: data.id,
      author_id: data.author_id,
      title: data.title,
      content: data.content,
      target_scope: data.target_scope,
      student_id: data.student_id,
      subject_id: data.subject_id,
      priority: data.priority,
      status: data.status,
      published_at: data.published_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      author_name: data.profiles?.full_name || 'Academic Faculty',
      author_role: data.profiles?.role,
      author_poraplan_id: data.profiles?.poraplan_id,
      student_name: data.profiles_student_id?.full_name,
      student_poraplan_id: data.profiles_student_id?.poraplan_id,
      subject_name: data.subjects?.name,
      subject_code: data.subjects?.code,
      is_acknowledged: Boolean(userAck),
      acknowledged_at: userAck?.acknowledged_at || null,
      acknowledgments_count: acknowledgments.length,
      acknowledgments,
    };

    return { announcement, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { announcement: null, error };
  }
}

/**
 * Create a new targeted academic announcement.
 */
export async function createAnnouncement(input: {
  authorId: string;
  authorRole?: string;
  title: string;
  content: string;
  targetScope?: AnnouncementScope;
  programId?: string | null;
  cohortId?: string | null;
  studentId?: string | null;
  subjectId?: string | null;
  priority?: AnnouncementPriority;
  status?: AnnouncementStatus;
}): Promise<{
  announcement: Announcement | null;
  error: Error | null;
}> {
  if (!input.title || !input.title.trim()) {
    return { announcement: null, error: new Error('Announcement title is required.') };
  }
  if (!input.content || !input.content.trim()) {
    return { announcement: null, error: new Error('Announcement content is required.') };
  }

  // Pre-validate role authorization for platform-wide announcements
  if (input.targetScope === 'platform' && input.authorRole && input.authorRole !== 'admin') {
    return {
      announcement: null,
      error: new Error('Only platform administrators are authorized to publish platform-wide announcements.'),
    };
  }

  if (input.targetScope === 'individual' && !input.studentId) {
    return {
      announcement: null,
      error: new Error('Individual announcements require a target student to be selected.'),
    };
  }

  if (!isSupabaseConfigured()) {
    return createMockAnnouncement({
      authorId: input.authorId,
      title: input.title,
      content: input.content,
      targetScope: input.targetScope,
      programId: input.programId,
      cohortId: input.cohortId,
      studentId: input.studentId,
      subjectId: input.subjectId,
      priority: input.priority,
      status: input.status,
    });
  }

  try {
    const payload: AnnouncementInsert = {
      author_id: input.authorId,
      title: input.title.trim(),
      content: input.content.trim(),
      target_scope: input.targetScope || 'assigned_students',
      program_id: input.programId || null,
      cohort_id: input.cohortId || null,
      student_id: input.targetScope === 'individual' ? input.studentId : null,
      subject_id: input.subjectId || null,
      priority: input.priority || 'normal',
      status: input.status || 'published',
    };

    const { data, error } = await supabase
      .from('announcements')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      return { announcement: null, error };
    }

    if (payload.status === 'published') {
      (async () => {
        try {
          let recipients: string[] = [];
          if (payload.target_scope === 'individual' && payload.student_id) {
            recipients = [payload.student_id];
          } else if (payload.target_scope === 'assigned_students') {
            const { data: assignments } = await supabase
              .from('mentor_students')
              .select('student_id')
              .eq('mentor_id', input.authorId);
            recipients = (assignments || []).map((r: any) => r.student_id);
          } else if (payload.target_scope === 'platform') {
            const { data: students } = await supabase
              .from('profiles')
              .select('id')
              .eq('role', 'student');
            recipients = (students || []).map((s: any) => s.id);
          }

          for (const recipientId of recipients) {
            await createNotification({
              recipientId,
              actorId: input.authorId,
              type: 'announcement_published',
              title: payload.title,
              message: 'Academic faculty published an announcement',
              link: '/student/announcements',
              idempotencyKey: `announcement:${data.id}:${recipientId}`,
            });
          }
        } catch {
          // Non-blocking notification dispatch
        }
      })();
    }

    return { announcement: data as Announcement, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { announcement: null, error };
  }
}

/**
 * Update an announcement (title, content, priority, status/archive, subject).
 */
export async function updateAnnouncement(
  announcementId: string,
  userId: string,
  updates: Partial<AnnouncementUpdate>
): Promise<{
  announcement: Announcement | null;
  error: Error | null;
}> {
  if (!announcementId) {
    return { announcement: null, error: new Error('Announcement ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return updateMockAnnouncement(announcementId, userId, updates);
  }

  try {
    const { data, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('id', announcementId)
      .select('*')
      .single();

    if (error) {
      return { announcement: null, error };
    }

    return { announcement: data as Announcement, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { announcement: null, error };
  }
}

/**
 * Record a scholar's acknowledgment of an announcement.
 */
export async function acknowledgeAnnouncement(
  announcementId: string,
  studentId: string
): Promise<{
  acknowledgment: AnnouncementAcknowledgment | null;
  error: Error | null;
}> {
  if (!announcementId || !studentId) {
    return { acknowledgment: null, error: new Error('Announcement ID and Student ID are required.') };
  }

  if (!isSupabaseConfigured()) {
    return acknowledgeMockAnnouncement(announcementId, studentId);
  }

  try {
    const { data, error } = await supabase
      .from('announcement_acknowledgments')
      .insert({
        announcement_id: announcementId,
        student_id: studentId,
      })
      .select('*')
      .single();

    if (error) {
      // If error is unique constraint violation (code 23505), student already acknowledged
      if (error.code === '23505') {
        const { data: existing } = await supabase
          .from('announcement_acknowledgments')
          .select('*')
          .eq('announcement_id', announcementId)
          .eq('student_id', studentId)
          .single();
        return { acknowledgment: existing as AnnouncementAcknowledgment, error: null };
      }
      return { acknowledgment: null, error };
    }

    return { acknowledgment: data as AnnouncementAcknowledgment, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { acknowledgment: null, error };
  }
}

/**
 * Delete an announcement (author or admin only).
 */
export async function deleteAnnouncement(
  announcementId: string,
  userId: string
): Promise<{
  success: boolean;
  error: Error | null;
}> {
  if (!announcementId) {
    return { success: false, error: new Error('Announcement ID is required.') };
  }

  if (!isSupabaseConfigured()) {
    return deleteMockAnnouncement(announcementId, userId);
  }

  try {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', announcementId);

    if (error) {
      return { success: false, error };
    }

    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
