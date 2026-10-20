-- ==============================================================================
-- PoraPlan Milestone 9: Tasks Foundation (Step 2: Study Activity Management)
-- Schema Updates:
-- 1. Create public.tasks table (activity items assigned to students by mentors)
-- 2. Performance indexes, updated_at trigger, and foreign key relationships
-- 3. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE TASKS TABLE
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  due_date DATE,
  estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Tasks
CREATE INDEX IF NOT EXISTS idx_tasks_student_id ON public.tasks(student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_subject_id ON public.tasks(subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON public.tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);

-- Automatic Updated At Trigger for Tasks
DROP TRIGGER IF EXISTS on_tasks_updated ON public.tasks;
CREATE TRIGGER on_tasks_updated
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. ROW LEVEL SECURITY (RLS) FOR TASKS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Students can view only their own assigned tasks
DROP POLICY IF EXISTS "Students can view own tasks" ON public.tasks;
CREATE POLICY "Students can view own tasks"
  ON public.tasks
  FOR SELECT
  USING (auth.uid() = student_id);

-- Students can update status and completion of their own tasks
DROP POLICY IF EXISTS "Students can update own task status" ON public.tasks;
CREATE POLICY "Students can update own task status"
  ON public.tasks
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Mentors can view tasks of their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned student tasks" ON public.tasks;
CREATE POLICY "Mentors can view assigned student tasks"
  ON public.tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.tasks.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can create tasks for their assigned students
DROP POLICY IF EXISTS "Mentors can create tasks for assigned students" ON public.tasks;
CREATE POLICY "Mentors can create tasks for assigned students"
  ON public.tasks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.tasks.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update tasks for their assigned students
DROP POLICY IF EXISTS "Mentors can update assigned student tasks" ON public.tasks;
CREATE POLICY "Mentors can update assigned student tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.tasks.student_id
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
        AND ms.student_id = public.tasks.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can delete tasks for their assigned students
DROP POLICY IF EXISTS "Mentors can delete assigned student tasks" ON public.tasks;
CREATE POLICY "Mentors can delete assigned student tasks"
  ON public.tasks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.tasks.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can manage all tasks
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
CREATE POLICY "Admins can manage all tasks"
  ON public.tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
