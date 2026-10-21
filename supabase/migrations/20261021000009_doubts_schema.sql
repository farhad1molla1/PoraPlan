-- ==============================================================================
-- PoraPlan Milestone 15: Academic Doubts Resolution Desk Foundation
-- Schema Updates:
-- 1. Create public.doubts table (student questions, status, subject/academic links)
-- 2. Create public.doubt_responses table (mentor/student conversational replies)
-- 3. Performance indexes, updated_at trigger, auto-status transition trigger
-- 4. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE DOUBTS TABLE
CREATE TABLE IF NOT EXISTS public.doubts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'resolved')),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Doubts
CREATE INDEX IF NOT EXISTS idx_doubts_student_id ON public.doubts(student_id);
CREATE INDEX IF NOT EXISTS idx_doubts_mentor_id ON public.doubts(mentor_id);
CREATE INDEX IF NOT EXISTS idx_doubts_subject_id ON public.doubts(subject_id);
CREATE INDEX IF NOT EXISTS idx_doubts_plan_id ON public.doubts(plan_id);
CREATE INDEX IF NOT EXISTS idx_doubts_task_id ON public.doubts(task_id);
CREATE INDEX IF NOT EXISTS idx_doubts_assignment_id ON public.doubts(assignment_id);
CREATE INDEX IF NOT EXISTS idx_doubts_status ON public.doubts(status);
CREATE INDEX IF NOT EXISTS idx_doubts_priority ON public.doubts(priority);
CREATE INDEX IF NOT EXISTS idx_doubts_created_at ON public.doubts(created_at);

-- 2. CREATE DOUBT RESPONSES TABLE
CREATE TABLE IF NOT EXISTS public.doubt_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id UUID NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Responses
CREATE INDEX IF NOT EXISTS idx_doubt_responses_doubt_id ON public.doubt_responses(doubt_id);
CREATE INDEX IF NOT EXISTS idx_doubt_responses_author_id ON public.doubt_responses(author_id);
CREATE INDEX IF NOT EXISTS idx_doubt_responses_created_at ON public.doubt_responses(created_at);

-- Updated_at Trigger for Doubts
DROP TRIGGER IF EXISTS on_doubts_updated ON public.doubts;
CREATE TRIGGER on_doubts_updated
  BEFORE UPDATE ON public.doubts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Auto-update doubt status when mentor or admin responds
CREATE OR REPLACE FUNCTION public.handle_doubt_response_added()
RETURNS TRIGGER AS $$
BEGIN
  -- When someone other than the student responds, move open doubts to answered
  UPDATE public.doubts
  SET status = 'answered',
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.doubt_id
    AND student_id != NEW.author_id
    AND status = 'open';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_doubt_response_added ON public.doubt_responses;
CREATE TRIGGER on_doubt_response_added
  AFTER INSERT ON public.doubt_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_doubt_response_added();

-- 3. ROW LEVEL SECURITY (RLS) FOR DOUBTS
ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_responses ENABLE ROW LEVEL SECURITY;

-- Students can view only their own doubts
DROP POLICY IF EXISTS "Students can view own doubts" ON public.doubts;
CREATE POLICY "Students can view own doubts"
  ON public.doubts
  FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can view doubts for their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned student doubts" ON public.doubts;
CREATE POLICY "Mentors can view assigned student doubts"
  ON public.doubts
  FOR SELECT
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.doubts.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Students can create doubts for themselves
DROP POLICY IF EXISTS "Students can create own doubts" ON public.doubts;
CREATE POLICY "Students can create own doubts"
  ON public.doubts
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Students can update their own doubts (e.g. resolve or edit)
DROP POLICY IF EXISTS "Students can update own doubts" ON public.doubts;
CREATE POLICY "Students can update own doubts"
  ON public.doubts
  FOR UPDATE
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update doubts of assigned students (e.g. status)
DROP POLICY IF EXISTS "Mentors can update assigned student doubts" ON public.doubts;
CREATE POLICY "Mentors can update assigned student doubts"
  ON public.doubts
  FOR UPDATE
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.doubts.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.doubts.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Students can delete their own doubts
DROP POLICY IF EXISTS "Students can delete own doubts" ON public.doubts;
CREATE POLICY "Students can delete own doubts"
  ON public.doubts
  FOR DELETE
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 4. ROW LEVEL SECURITY (RLS) FOR DOUBT RESPONSES
-- View responses
DROP POLICY IF EXISTS "Users can view authorized doubt responses" ON public.doubt_responses;
CREATE POLICY "Users can view authorized doubt responses"
  ON public.doubt_responses
  FOR SELECT
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = doubt_id
        AND (
          d.student_id = auth.uid()
          OR d.mentor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.mentor_students ms
            WHERE ms.mentor_id = auth.uid() AND ms.student_id = d.student_id
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Insert responses
DROP POLICY IF EXISTS "Authorized users can post doubt responses" ON public.doubt_responses;
CREATE POLICY "Authorized users can post doubt responses"
  ON public.doubt_responses
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND (
      EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id = doubt_id
          AND (
            d.student_id = auth.uid()
            OR d.mentor_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.mentor_students ms
              WHERE ms.mentor_id = auth.uid() AND ms.student_id = d.student_id
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );
