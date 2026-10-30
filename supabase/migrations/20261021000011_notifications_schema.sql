-- ==============================================================================
-- PoraPlan Milestone 17: Mentor-Triggered Notifications Foundation
-- Schema Updates:
-- 1. Create public.notifications table
-- 2. Indexes and idempotency uniqueness constraint
-- 3. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'task_created',
    'assignment_created',
    'resource_published',
    'evaluation_published',
    'submission_reviewed',
    'doubt_replied',
    'announcement_published',
    'plan_updated',
    'system'
  )),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT check_notifications_safe_link CHECK (
    link IS NULL OR (link LIKE '/%' AND link NOT LIKE '//%' AND link NOT LIKE '%:%')
  )
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON public.notifications(recipient_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON public.notifications(actor_id);

-- Enforce idempotency: prevent duplicate notification for same recipient and event key
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_idempotency
  ON public.notifications(recipient_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Select Policy: Students can only read their own notifications; Admins can view all
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  USING (
    auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Update Policy: Students can only update read status of their own notifications
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  USING (
    auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Insert Policy:
-- Admins can insert notifications for any user.
-- Mentors can insert notifications ONLY for students assigned to them.
-- Students are prevented from creating arbitrary notifications.
DROP POLICY IF EXISTS "Authorized mentors and admins can create notifications" ON public.notifications;
CREATE POLICY "Authorized mentors and admins can create notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (
    -- Admin creation
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    -- Mentor creation: author must be auth.uid() and recipient must be assigned
    OR (
      actor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'mentor'
      )
      AND EXISTS (
        SELECT 1 FROM public.mentor_students ms
        WHERE ms.mentor_id = auth.uid()
          AND ms.student_id = public.notifications.recipient_id
      )
    )
  );

-- Delete Policy: Recipient or Admin can delete notification
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  USING (
    auth.uid() = recipient_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
