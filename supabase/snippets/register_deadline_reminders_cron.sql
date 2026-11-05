-- ==============================================================================
-- PoraPlan: Register Assignment Deadline Reminders Cron Job
--
-- Instructions:
-- 1. In your Supabase Project Dashboard, go to Database -> Extensions.
-- 2. Search for 'pg_cron' and ensure it is enabled.
-- 3. Run this script in the Supabase SQL Editor.
--
-- Behavior:
-- - Idempotently removes any existing scheduled job named 'process-assignment-deadline-reminders'.
-- - Schedules exactly one job running every minute (* * * * *) to evaluate deadlines.
-- - Safe to run repeatedly; will never create duplicate jobs.
-- ==============================================================================

SELECT public.register_assignment_deadline_reminder_cron();
