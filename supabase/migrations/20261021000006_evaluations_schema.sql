-- ==============================================================================
-- PoraPlan Milestone 12: Evaluations & Milestone Assessments Foundation
-- Schema Updates:
-- 1. Create public.evaluations table (structured oral, written, practical milestone reviews)
-- 2. Performance indexes, updated_at triggers, and foreign key relationships
-- 3. Row Level Security policies for Students, Mentors, and Admins
-- 4. Field tamper protection trigger preventing unauthorized student score updates
-- ==============================================================================

-- 1. CREATE EVALUATIONS TABLE
CREATE TABLE IF NOT EXISTS public.evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT, -- Syllabus scope, assessment focus, or agenda
  format TEXT NOT NULL DEFAULT 'oral' CHECK (format IN ('oral', 'written', 'practical')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  duration_minutes INTEGER DEFAULT 30 CHECK (duration_minutes IS NULL OR duration_minutes > 0),
  total_points NUMERIC(5, 2) DEFAULT 100.00 CHECK (total_points IS NULL OR total_points >= 0),
  score NUMERIC(5, 2) CHECK (score IS NULL OR (score >= 0 AND score <= 1000)),
  feedback TEXT, -- Qualitative mentor assessment commentary & concept retention notes
  recommendation TEXT, -- Study pacing calibration & next roadmap milestone guidance
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Evaluations
CREATE INDEX IF NOT EXISTS idx_evaluations_student_id ON public.evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_mentor_id ON public.evaluations(mentor_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_subject_id ON public.evaluations(subject_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_plan_id ON public.evaluations(plan_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_assignment_id ON public.evaluations(assignment_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_status ON public.evaluations(status);
CREATE INDEX IF NOT EXISTS idx_evaluations_scheduled_date ON public.evaluations(scheduled_date);

-- Automatic Updated At Trigger for Evaluations
DROP TRIGGER IF EXISTS on_evaluations_updated ON public.evaluations;
CREATE TRIGGER on_evaluations_updated
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. FIELD PROTECTION TRIGGER: PREVENT STUDENTS FROM TAMPERING WITH EVALUATIONS
CREATE OR REPLACE FUNCTION public.protect_evaluation_grading_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If update is initiated by a student, disallow modifying scores, feedback, or status
  IF auth.uid() = OLD.student_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('mentor', 'admin')
  ) THEN
    NEW.score := OLD.score;
    NEW.feedback := OLD.feedback;
    NEW.recommendation := OLD.recommendation;
    NEW.evaluated_at := OLD.evaluated_at;
    NEW.status := OLD.status;
    NEW.total_points := OLD.total_points;
    NEW.title := OLD.title;
    NEW.scheduled_date := OLD.scheduled_date;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_protect_evaluation_grading ON public.evaluations;
CREATE TRIGGER on_protect_evaluation_grading
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_evaluation_grading_fields();

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Students can view only their own evaluations
DROP POLICY IF EXISTS "Students can view own evaluations" ON public.evaluations;
CREATE POLICY "Students can view own evaluations"
  ON public.evaluations
  FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can view evaluations for their assigned students or created by them
DROP POLICY IF EXISTS "Mentors can view evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can view evaluations for assigned students"
  ON public.evaluations
  FOR SELECT
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.evaluations.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can create evaluations for assigned students
DROP POLICY IF EXISTS "Mentors can create evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can create evaluations for assigned students"
  ON public.evaluations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.evaluations.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update evaluations for assigned students
DROP POLICY IF EXISTS "Mentors can update evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can update evaluations for assigned students"
  ON public.evaluations
  FOR UPDATE
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.evaluations.student_id
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
        AND ms.student_id = public.evaluations.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can delete evaluations for assigned students
DROP POLICY IF EXISTS "Mentors can delete evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can delete evaluations for assigned students"
  ON public.evaluations
  FOR DELETE
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.evaluations.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin full access to evaluations
DROP POLICY IF EXISTS "Admins have full access to evaluations" ON public.evaluations;
CREATE POLICY "Admins have full access to evaluations"
  ON public.evaluations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
