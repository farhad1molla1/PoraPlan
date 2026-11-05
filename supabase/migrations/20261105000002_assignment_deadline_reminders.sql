-- ==============================================================================
-- PoraPlan Milestone: Assignment Deadline Reminders Schema & Scheduling
-- Phase 3.4: Server-Side Assignment Deadline Reminders
-- Phase 3.4.1: Production-Safety Hardening (Timezone-safe & Idempotent pg_cron)
-- Phase 3.4.2: pg_cron Registration Concurrency & Lifecycle Fix (Advisory Lock & Strict Extension Check)
--
-- 1. Add published_at column to public.assignments
-- 2. Automatic trigger ensuring set-once semantics for published_at (now() invariant)
-- 3. Extend check_notifications_type constraint with 'assignment_deadline_reminder'
-- 4. Create public.assignment_reminder_deliveries durable tracking table (default now())
-- 5. Create process_assignment_deadline_reminders() SECURITY DEFINER function
--    (Checks student status = 'active' and uses now() instead of session timezone)
-- 6. Create register_assignment_deadline_reminder_cron() procedure
-- 7. Conditionally register pg_cron schedule (* * * * *)
-- ==============================================================================

-- 1. ADD published_at TO public.assignments
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Backfill existing published assignments with created_at if published_at is null
UPDATE public.assignments
SET published_at = created_at
WHERE status = 'published' AND published_at IS NULL;

-- 2. AUTOMATIC published_at TRIGGER (Enforce set-once semantics, timezone-invariant now())
CREATE OR REPLACE FUNCTION public.handle_assignment_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- If transitioning to 'published' for the first time, set published_at
    IF OLD.status != 'published' AND NEW.status = 'published' AND OLD.published_at IS NULL THEN
      NEW.published_at := now();
    -- If published_at was already set, preserve original publication timestamp
    ELSIF OLD.published_at IS NOT NULL THEN
      NEW.published_at := OLD.published_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assignment_published_at ON public.assignments;
CREATE TRIGGER trg_assignment_published_at
  BEFORE INSERT OR UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_assignment_published_at();

-- 3. EXTEND NOTIFICATIONS TYPE CHECK CONSTRAINT
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS check_notifications_type;

ALTER TABLE public.notifications ADD CONSTRAINT check_notifications_type CHECK (
  type IN (
    'task_created',
    'task_updated',
    'assignment_created',
    'assignment_updated',
    'assignment_deadline_reminder',
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

-- 4. DURABLE DELIVERY TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.assignment_reminder_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  scheduled_reminder_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_assignment_reminder UNIQUE (assignment_id)
);

CREATE INDEX IF NOT EXISTS idx_assignment_reminder_deliveries_student
  ON public.assignment_reminder_deliveries(student_id);
CREATE INDEX IF NOT EXISTS idx_assignment_reminder_deliveries_assignment
  ON public.assignment_reminder_deliveries(assignment_id);

ALTER TABLE public.assignment_reminder_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS: Students can view their own deliveries (audit log); Admins have full access.
-- Mentors and students cannot insert, update, or delete.
DROP POLICY IF EXISTS "Students can view own reminder deliveries" ON public.assignment_reminder_deliveries;
CREATE POLICY "Students can view own reminder deliveries"
  ON public.assignment_reminder_deliveries
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. SCHEDULED SERVER-SIDE REMINDER PROCESSING FUNCTION
CREATE OR REPLACE FUNCTION public.process_assignment_deadline_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_processed_count INTEGER := 0;
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT 
      a.id,
      a.student_id,
      a.title,
      a.due_date,
      a.published_at,
      ((a.due_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Asia/Dhaka') AS deadline_at,
      CASE 
        WHEN (((a.due_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Asia/Dhaka') - a.published_at) <= INTERVAL '24 hours'
          THEN a.published_at + INTERVAL '6 hours'
        ELSE ((a.due_date::text || ' 23:59:00')::timestamp AT TIME ZONE 'Asia/Dhaka') - INTERVAL '6 hours'
      END AS reminder_at
    FROM public.assignments a
    JOIN public.profiles p ON p.id = a.student_id
    WHERE a.status = 'published'
      AND a.due_date IS NOT NULL
      AND a.published_at IS NOT NULL
      AND p.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.assignment_reminder_deliveries ard
        WHERE ard.assignment_id = a.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.submissions s
        WHERE s.assignment_id = a.id
          AND s.student_id = a.student_id
          AND s.status IN ('submitted', 'under_review', 'reviewed')
      )
  LOOP
    -- Eligibility conditions:
    -- 1. reminder_at strictly before deadline_at (e.g. skip <= 3h assignments)
    -- 2. current time at or after reminder_at
    -- 3. current time strictly before deadline_at
    IF v_rec.reminder_at < v_rec.deadline_at 
       AND v_now >= v_rec.reminder_at 
       AND v_now < v_rec.deadline_at THEN

      BEGIN
        -- Atomically insert delivery tracking record
        INSERT INTO public.assignment_reminder_deliveries (
          assignment_id,
          student_id,
          due_date,
          scheduled_reminder_at,
          sent_at
        ) VALUES (
          v_rec.id,
          v_rec.student_id,
          v_rec.due_date,
          v_rec.reminder_at,
          v_now
        );

        -- Atomically insert recipient notification
        INSERT INTO public.notifications (
          recipient_id,
          actor_id,
          type,
          title,
          message,
          link,
          idempotency_key
        ) VALUES (
          v_rec.student_id,
          NULL,
          'assignment_deadline_reminder',
          'Assignment Deadline Reminder',
          'Your assignment "' || v_rec.title || '" is approaching its deadline. Please complete and submit it on time.',
          '/student/assignments',
          'assignment_reminder:' || v_rec.id::text
        );

        v_processed_count := v_processed_count + 1;
      EXCEPTION
        WHEN unique_violation THEN
          -- Concurrent or duplicate execution safely ignored
          NULL;
      END;

    END IF;
  END LOOP;

  RETURN v_processed_count;
END;
$$;

-- Restrict function execution permissions to postgres and service_role
REVOKE ALL ON FUNCTION public.process_assignment_deadline_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_assignment_deadline_reminders() FROM authenticated;
REVOKE ALL ON FUNCTION public.process_assignment_deadline_reminders() FROM anon;
GRANT EXECUTE ON FUNCTION public.process_assignment_deadline_reminders() TO postgres;
GRANT EXECUTE ON FUNCTION public.process_assignment_deadline_reminders() TO service_role;

-- 6. PG_CRON SCHEDULER REGISTRATION PROCEDURE (Idempotent & serialized job registration)
CREATE OR REPLACE FUNCTION public.register_assignment_deadline_reminder_cron()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- 1. Verify pg_cron extension is installed and active
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension is not active. Please enable pg_cron in the Supabase Dashboard under Database -> Extensions before registering the deadline reminder cron job.';
  END IF;

  -- 2. Acquire transaction-level advisory lock to serialize concurrent registrations
  PERFORM pg_advisory_xact_lock(hashtext('process-assignment-deadline-reminders')::bigint);

  -- 3. Idempotent unschedule: remove any existing jobs with this exact name by jobid
  FOR v_job_id IN (
    SELECT jobid FROM cron.job WHERE jobname = 'process-assignment-deadline-reminders'
  ) LOOP
    PERFORM cron.unschedule(v_job_id);
  END LOOP;

  -- 4. Register exactly one job scheduled once per minute
  PERFORM cron.schedule(
    'process-assignment-deadline-reminders',
    '* * * * *',
    'SELECT public.process_assignment_deadline_reminders()'
  );

  RETURN true;
END;
$$;

-- Restrict permissions: only postgres and service_role can manage scheduled jobs
REVOKE ALL ON FUNCTION public.register_assignment_deadline_reminder_cron() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_assignment_deadline_reminder_cron() FROM authenticated;
REVOKE ALL ON FUNCTION public.register_assignment_deadline_reminder_cron() FROM anon;
GRANT EXECUTE ON FUNCTION public.register_assignment_deadline_reminder_cron() TO postgres;
GRANT EXECUTE ON FUNCTION public.register_assignment_deadline_reminder_cron() TO service_role;

-- 7. CONDITIONAL INITIAL REGISTRATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM public.register_assignment_deadline_reminder_cron();
      RAISE NOTICE 'pg_cron scheduled job registered successfully for assignment deadline reminders.';
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'pg_cron registration encountered an issue (%): Run SELECT public.register_assignment_deadline_reminder_cron(); after verifying pg_cron extension status.', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'pg_cron extension is not active yet. To activate automated reminders on hosted Supabase: Enable pg_cron in Database Extensions, then execute: SELECT public.register_assignment_deadline_reminder_cron();';
  END IF;
END;
$$;
