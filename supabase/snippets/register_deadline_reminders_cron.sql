-- ==============================================================================
-- PoraPlan: Register Assignment Deadline Reminders Cron Job
--
-- Lifecycle Instructions:
-- 1. Apply the migration: supabase/migrations/20261105000002_assignment_deadline_reminders.sql
-- 2. Enable pg_cron from Supabase Dashboard: Navigate to Database -> Extensions,
--    search for 'pg_cron', and enable it.
-- 3. Execute this registration SQL snippet in the Supabase SQL Editor:
--    SELECT public.register_assignment_deadline_reminder_cron();
-- 4. Verify exactly one matching job exists in cron.job:
--    SELECT jobid, jobname, schedule, command, active FROM cron.job WHERE jobname = 'process-assignment-deadline-reminders';
--
-- Concurrency & Idempotency:
-- - Uses a transaction-level advisory lock to serialize concurrent registrations.
-- - Idempotently removes any existing scheduled jobs named 'process-assignment-deadline-reminders' by job ID.
-- - Schedules exactly one job running every minute (* * * * *) to evaluate deadlines.
-- - Safe to re-run whenever necessary without creating duplicate jobs.
-- ==============================================================================

SELECT public.register_assignment_deadline_reminder_cron();
