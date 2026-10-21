-- ==============================================================================
-- PoraPlan Milestone 13: Progress Tracking Foundation & Performance Indexes
-- Schema Updates:
-- 1. Performance composite indexes for student & mentor progress aggregations
-- 2. Covers status, completion timestamps, and scholar pairing queries
-- 3. Fully reuses existing tables (tasks, assignments, submissions, evaluations, study_plans)
--    without duplicate tracking tables or denormalized counters
-- ==============================================================================

-- 1. PERFORMANCE INDEXES FOR PROGRESS AGGREGATION QUERIES
CREATE INDEX IF NOT EXISTS idx_tasks_student_status ON public.tasks(student_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_student_completed ON public.tasks(student_id, completed_at) WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_assignments_student_status ON public.assignments(student_id, status);

CREATE INDEX IF NOT EXISTS idx_submissions_student_status ON public.submissions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_submissions_student_submitted ON public.submissions(student_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_submissions_student_reviewed ON public.submissions(student_id, reviewed_at) WHERE status IN ('reviewed', 'needs_revision');

CREATE INDEX IF NOT EXISTS idx_evaluations_student_status ON public.evaluations(student_id, status);
CREATE INDEX IF NOT EXISTS idx_evaluations_student_evaluated ON public.evaluations(student_id, evaluated_at) WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_study_plans_student_status ON public.study_plans(student_id, status);
