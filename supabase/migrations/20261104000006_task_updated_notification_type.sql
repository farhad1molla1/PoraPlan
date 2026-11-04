-- Migration: Add 'task_updated' to notifications type check constraint
-- Phase 3.2: Task Update Notifications

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS check_notifications_type;

ALTER TABLE public.notifications ADD CONSTRAINT check_notifications_type CHECK (
  type IN (
    'task_created',
    'task_updated',
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

