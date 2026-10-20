-- ==============================================================================
-- PoraPlan Milestone 7: Subjects & Study Areas Foundation
-- Schema Updates:
-- 1. Ensure mentor_students has status column (resolves migration 5 dependency)
-- 2. Create public.subjects table (study areas per student)
-- 3. Strict Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. ENSURE STATUS COLUMN EXISTS ON MENTOR_STUDENTS
ALTER TABLE public.mentor_students
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'));

-- 2. CREATE SUBJECTS / STUDY AREAS TABLE
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT subjects_student_name_unique UNIQUE (student_id, name)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_subjects_student_id ON public.subjects(student_id);
CREATE INDEX IF NOT EXISTS idx_subjects_created_by ON public.subjects(created_by);
CREATE INDEX IF NOT EXISTS idx_subjects_status ON public.subjects(status);

-- Automatic Updated At Trigger
DROP TRIGGER IF EXISTS on_subjects_updated ON public.subjects;
CREATE TRIGGER on_subjects_updated
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) FOR SUBJECTS
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Policy: Students can view only their own assigned study areas
DROP POLICY IF EXISTS "Students can view own subjects" ON public.subjects;
CREATE POLICY "Students can view own subjects"
  ON public.subjects
  FOR SELECT
  USING (auth.uid() = student_id);

-- Policy: Mentors can view study areas of their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned student subjects" ON public.subjects;
CREATE POLICY "Mentors can view assigned student subjects"
  ON public.subjects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.subjects.student_id
    )
  );

-- Policy: Mentors can create study areas for their assigned students
DROP POLICY IF EXISTS "Mentors can create subjects for assigned students" ON public.subjects;
CREATE POLICY "Mentors can create subjects for assigned students"
  ON public.subjects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.subjects.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Mentors can update study areas of their assigned students
DROP POLICY IF EXISTS "Mentors can update assigned student subjects" ON public.subjects;
CREATE POLICY "Mentors can update assigned student subjects"
  ON public.subjects
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.subjects.student_id
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
        AND ms.student_id = public.subjects.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Mentors can delete study areas of their assigned students
DROP POLICY IF EXISTS "Mentors can delete assigned student subjects" ON public.subjects;
CREATE POLICY "Mentors can delete assigned student subjects"
  ON public.subjects
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.subjects.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Policy: Admins can view all study areas
DROP POLICY IF EXISTS "Admins can view all subjects" ON public.subjects;
CREATE POLICY "Admins can view all subjects"
  ON public.subjects
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
