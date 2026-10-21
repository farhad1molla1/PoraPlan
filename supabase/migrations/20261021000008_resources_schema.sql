-- ==============================================================================
-- PoraPlan Milestone 14: Academic Resources & Reference Library Foundation
-- Schema Updates:
-- 1. Create public.resources table (curated study materials, formula sheets, links, notes)
-- 2. Performance indexes, updated_at trigger, and foreign key relationships
-- 3. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE RESOURCES TABLE
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL DEFAULT 'link' CHECK (resource_type IN ('link', 'file', 'note')),
  url TEXT,
  file_name TEXT,
  file_size INTEGER CHECK (file_size IS NULL OR file_size >= 0),
  content TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Resources
CREATE INDEX IF NOT EXISTS idx_resources_student_id ON public.resources(student_id);
CREATE INDEX IF NOT EXISTS idx_resources_mentor_id ON public.resources(mentor_id);
CREATE INDEX IF NOT EXISTS idx_resources_subject_id ON public.resources(subject_id);
CREATE INDEX IF NOT EXISTS idx_resources_plan_id ON public.resources(plan_id);
CREATE INDEX IF NOT EXISTS idx_resources_type ON public.resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at);

-- Automatic Updated At Trigger for Resources
DROP TRIGGER IF EXISTS on_resources_updated ON public.resources;
CREATE TRIGGER on_resources_updated
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. ROW LEVEL SECURITY (RLS) FOR RESOURCES
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Students can view only resources shared with them
DROP POLICY IF EXISTS "Students can view own resources" ON public.resources;
CREATE POLICY "Students can view own resources"
  ON public.resources
  FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can view resources of their assigned students or created by them
DROP POLICY IF EXISTS "Mentors can view assigned student resources" ON public.resources;
CREATE POLICY "Mentors can view assigned student resources"
  ON public.resources
  FOR SELECT
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.resources.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can create resources for their assigned students
DROP POLICY IF EXISTS "Mentors can create resources for assigned students" ON public.resources;
CREATE POLICY "Mentors can create resources for assigned students"
  ON public.resources
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.resources.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update resources for their assigned students
DROP POLICY IF EXISTS "Mentors can update assigned student resources" ON public.resources;
CREATE POLICY "Mentors can update assigned student resources"
  ON public.resources
  FOR UPDATE
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.resources.student_id
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
        AND ms.student_id = public.resources.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can delete resources for their assigned students
DROP POLICY IF EXISTS "Mentors can delete assigned student resources" ON public.resources;
CREATE POLICY "Mentors can delete assigned student resources"
  ON public.resources
  FOR DELETE
  USING (
    auth.uid() = mentor_id
    OR EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.resources.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
