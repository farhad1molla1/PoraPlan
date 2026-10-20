-- ==============================================================================
-- PoraPlan Milestone 11: Mentor Review & Evaluation Feedback
-- Schema Updates:
-- 1. Extend public.submissions with feedback, score, reviewed_by, reviewed_at
-- 2. Expand status check to support 'needs_revision'
-- 3. Row Level Security policies ensuring mentors can review assigned scholars' work
--    and students can read (but never forge) mentor feedback
-- ==============================================================================

-- 1. ADD REVIEW COLUMNS TO SUBMISSIONS
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS score NUMERIC(5, 2) CHECK (score IS NULL OR score >= 0),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Performance Indexes for Review Queries
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by ON public.submissions(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_at ON public.submissions(reviewed_at);

-- 2. UPDATE STATUS CONSTRAINT TO SUPPORT 'needs_revision'
ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS submissions_status_check;
ALTER TABLE public.submissions
  ADD CONSTRAINT submissions_status_check
  CHECK (status IN ('submitted', 'under_review', 'reviewed', 'needs_revision'));

-- 3. TRIGGER TO PREVENT STUDENT TAMPERING WITH FEEDBACK OR SCORE
CREATE OR REPLACE FUNCTION public.protect_submission_review_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If updated by the student (not an admin or assigned mentor)
  IF (auth.uid() = OLD.student_id) AND NOT (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('mentor', 'admin'))
  ) THEN
    -- Preserve existing feedback, score, reviewer, and review timestamp
    NEW.feedback := OLD.feedback;
    NEW.score := OLD.score;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_protect_submission_review_fields ON public.submissions;
CREATE TRIGGER on_protect_submission_review_fields
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_submission_review_fields();

-- 4. ROW LEVEL SECURITY POLICIES FOR MENTOR REVIEW
-- Ensure mentors can update review feedback for their assigned students
DROP POLICY IF EXISTS "Mentors can review assigned student submissions" ON public.submissions;
CREATE POLICY "Mentors can review assigned student submissions"
  ON public.submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.submissions.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.submissions.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
