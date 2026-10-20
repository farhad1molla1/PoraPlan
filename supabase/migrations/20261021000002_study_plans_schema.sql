-- ==============================================================================
-- PoraPlan Milestone 8: Study Plans & Syllabus Roadmap Foundation
-- Schema Updates:
-- 1. Create public.study_plans table (roadmap linking student, mentor, and study area)
-- 2. Create public.study_plan_items table (ordered curriculum items, duration, and targets)
-- 3. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE STUDY PLANS TABLE
CREATE TABLE IF NOT EXISTS public.study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Study Plans
CREATE INDEX IF NOT EXISTS idx_study_plans_student_id ON public.study_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_created_by ON public.study_plans(created_by);
CREATE INDEX IF NOT EXISTS idx_study_plans_subject_id ON public.study_plans(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_status ON public.study_plans(status);

-- Automatic Updated At Trigger for Study Plans
DROP TRIGGER IF EXISTS on_study_plans_updated ON public.study_plans;
CREATE TRIGGER on_study_plans_updated
  BEFORE UPDATE ON public.study_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. CREATE STUDY PLAN ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.study_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.study_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  instructions TEXT,
  estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
  target_date DATE,
  item_order INTEGER NOT NULL DEFAULT 1 CHECK (item_order >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Study Plan Items
CREATE INDEX IF NOT EXISTS idx_study_plan_items_plan_order ON public.study_plan_items(plan_id, item_order);
CREATE INDEX IF NOT EXISTS idx_study_plan_items_status ON public.study_plan_items(status);

-- Automatic Updated At Trigger for Study Plan Items
DROP TRIGGER IF EXISTS on_study_plan_items_updated ON public.study_plan_items;
CREATE TRIGGER on_study_plan_items_updated
  BEFORE UPDATE ON public.study_plan_items
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) FOR STUDY PLANS
ALTER TABLE public.study_plans ENABLE ROW LEVEL SECURITY;

-- Students can view only their own assigned study plans
DROP POLICY IF EXISTS "Students can view own study plans" ON public.study_plans;
CREATE POLICY "Students can view own study plans"
  ON public.study_plans
  FOR SELECT
  USING (auth.uid() = student_id);

-- Mentors can view study plans of their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned student study plans" ON public.study_plans;
CREATE POLICY "Mentors can view assigned student study plans"
  ON public.study_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.study_plans.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can create study plans for their assigned students
DROP POLICY IF EXISTS "Mentors can create study plans for assigned students" ON public.study_plans;
CREATE POLICY "Mentors can create study plans for assigned students"
  ON public.study_plans
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.study_plans.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update study plans for their assigned students
DROP POLICY IF EXISTS "Mentors can update assigned student study plans" ON public.study_plans;
CREATE POLICY "Mentors can update assigned student study plans"
  ON public.study_plans
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.study_plans.student_id
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
        AND ms.student_id = public.study_plans.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can delete study plans for their assigned students
DROP POLICY IF EXISTS "Mentors can delete assigned student study plans" ON public.study_plans;
CREATE POLICY "Mentors can delete assigned student study plans"
  ON public.study_plans
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.study_plans.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admins can view all study plans
DROP POLICY IF EXISTS "Admins can view all study plans" ON public.study_plans;
CREATE POLICY "Admins can view all study plans"
  ON public.study_plans
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 4. ROW LEVEL SECURITY (RLS) FOR STUDY PLAN ITEMS
ALTER TABLE public.study_plan_items ENABLE ROW LEVEL SECURITY;

-- Students can view items of their own study plans
DROP POLICY IF EXISTS "Students can view own study plan items" ON public.study_plan_items;
CREATE POLICY "Students can view own study plan items"
  ON public.study_plan_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND sp.student_id = auth.uid()
    )
  );

-- Mentors can view items of assigned student study plans
DROP POLICY IF EXISTS "Mentors can view assigned student plan items" ON public.study_plan_items;
CREATE POLICY "Mentors can view assigned student plan items"
  ON public.study_plan_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      JOIN public.mentor_students ms ON ms.student_id = sp.student_id
      WHERE sp.id = public.study_plan_items.plan_id
        AND ms.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can insert items for assigned student study plans
DROP POLICY IF EXISTS "Mentors can insert assigned student plan items" ON public.study_plan_items;
CREATE POLICY "Mentors can insert assigned student plan items"
  ON public.study_plan_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      JOIN public.mentor_students ms ON ms.student_id = sp.student_id
      WHERE sp.id = public.study_plan_items.plan_id
        AND ms.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update items of assigned student study plans
DROP POLICY IF EXISTS "Mentors can update assigned student plan items" ON public.study_plan_items;
CREATE POLICY "Mentors can update assigned student plan items"
  ON public.study_plan_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      JOIN public.mentor_students ms ON ms.student_id = sp.student_id
      WHERE sp.id = public.study_plan_items.plan_id
        AND ms.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      JOIN public.mentor_students ms ON ms.student_id = sp.student_id
      WHERE sp.id = public.study_plan_items.plan_id
        AND ms.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can delete items of assigned student study plans
DROP POLICY IF EXISTS "Mentors can delete assigned student plan items" ON public.study_plan_items;
CREATE POLICY "Mentors can delete assigned student plan items"
  ON public.study_plan_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      JOIN public.mentor_students ms ON ms.student_id = sp.student_id
      WHERE sp.id = public.study_plan_items.plan_id
        AND ms.mentor_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
