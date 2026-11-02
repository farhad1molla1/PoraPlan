-- ==============================================================================
-- PoraPlan Milestone 11: Mentor Notification Inbox & Admin System Alerts
-- Schema Updates:
-- 1. Extend notifications type constraint to support mentor and admin event alerts:
--    - 'submission_created': student submitted practice assignment for mentor review
--    - 'doubt_created': student submitted academic doubt for mentor guidance
--    - 'application_submitted': applicant submitted program application for admin review
--    - 'capacity_alert': cohort approaching or reaching maximum capacity
-- 2. Update Row Level Security (RLS) on public.notifications:
--    - Mentors can insert notifications for their assigned students
--    - Students can insert notifications for their assigned mentors (submissions, doubts)
--    - Applicants/students can insert system alert notifications for admins
--    - Users can only read, update, and delete their own notifications (recipient_id = auth.uid())
--    - Admins maintain full administrative visibility
-- ==============================================================================

-- 1. EXTEND NOTIFICATIONS TYPE CHECK CONSTRAINT
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS check_notifications_type;

ALTER TABLE public.notifications ADD CONSTRAINT check_notifications_type CHECK (
  type IN (
    'task_created',
    'assignment_created',
    'resource_published',
    'evaluation_published',
    'submission_reviewed',
    'doubt_replied',
    'announcement_published',
    'plan_updated',
    'submission_created',
    'doubt_created',
    'application_submitted',
    'capacity_alert',
    'system'
  )
);

COMMENT ON TABLE public.notifications IS
  'Unified notification inbox across Student, Mentor, and Admin workflows with idempotency and safe deep links.';

-- 2. HARDENED ROW LEVEL SECURITY (RLS)

-- Select Policy: Users can only read their own notifications; Admins have full access
DROP POLICY IF EXISTS "Notifications select policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;

CREATE POLICY "Notifications select policy"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Update Policy: Users can only update their own notifications (e.g. read status)
DROP POLICY IF EXISTS "Notifications update policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

CREATE POLICY "Notifications update policy"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert Policy: Enforce strictly authorized notification dispatch:
-- 1. Admins can create notifications for any user.
-- 2. Mentors can create notifications for their assigned students.
-- 3. Students can create notifications for their assigned mentors (submissions, doubts).
-- 4. Authenticated users can create application notifications for administrators.
DROP POLICY IF EXISTS "Notifications insert policy" ON public.notifications;
DROP POLICY IF EXISTS "Authorized mentors and admins can create notifications" ON public.notifications;

CREATE POLICY "Notifications insert policy"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin creation: admins can notify anyone
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
    -- Mentor creation: author is auth.uid() and recipient is an assigned mentee
    OR (
      actor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor' AND status != 'suspended'
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.student_mentor_assignments sma
          WHERE sma.mentor_id = auth.uid()
            AND sma.student_id = public.notifications.recipient_id
            AND sma.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.cohort_mentors cm
          JOIN public.program_enrollments pe ON pe.cohort_id = cm.cohort_id
          WHERE cm.mentor_id = auth.uid()
            AND cm.is_active = true
            AND pe.student_id = public.notifications.recipient_id
            AND pe.status = 'active'
        )
      )
    )
    -- Student creation: author is auth.uid() and recipient is their assigned mentor
    OR (
      actor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'active'
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.student_mentor_assignments sma
          WHERE sma.student_id = auth.uid()
            AND sma.mentor_id = public.notifications.recipient_id
            AND sma.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.program_enrollments pe
          JOIN public.cohort_mentors cm ON cm.cohort_id = pe.cohort_id
          WHERE pe.student_id = auth.uid()
            AND cm.mentor_id = public.notifications.recipient_id
            AND cm.is_active = true
            AND pe.status = 'active'
        )
      )
    )
    -- Applicant / Member creation: alerting system administrators
    OR (
      actor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = public.notifications.recipient_id AND role = 'admin'
      )
    )
  );

-- Delete Policy: Users can delete their own notifications; Admins have full access
DROP POLICY IF EXISTS "Notifications delete policy" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

CREATE POLICY "Notifications delete policy"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
