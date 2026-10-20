-- ==============================================================================
-- PoraPlan Milestone 10: Assignments Foundation & Student Submission Workflow
-- Schema Updates:
-- 1. Create public.assignments table (homework / practice problem sets assigned by mentors)
-- 2. Create public.submissions table (student work provided via text, link, or file)
-- 3. Performance indexes, updated_at triggers, and foreign key relationships
-- 4. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE ASSIGNMENTS TABLE
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES public.study_plans(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  instructions TEXT,
  due_date DATE,
  total_points INTEGER DEFAULT 100 CHECK (total_points IS NULL OR total_points >= 0),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance Indexes for Assignments
CREATE INDEX IF NOT EXISTS idx_assignments_student_id ON public.assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_mentor_id ON public.assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_assignments_subject_id ON public.assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_assignments_plan_id ON public.assignments(plan_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON public.assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON public.assignments(due_date);

-- Automatic Updated At Trigger for Assignments
DROP TRIGGER IF EXISTS on_assignments_updated ON public.assignments;
CREATE TRIGGER on_assignments_updated
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 2. CREATE SUBMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submission_type TEXT NOT NULL DEFAULT 'text' CHECK (submission_type IN ('text', 'link', 'file')),
  content TEXT NOT NULL, -- Text explanation, answer body, or notes
  link_url TEXT, -- External link (e.g. Google Drive, GitHub, Overleaf, Notion)
  file_name TEXT, -- Original file name if uploaded or referenced
  file_size INTEGER, -- File size in bytes if uploaded or referenced
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'reviewed')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_assignment_student_submission UNIQUE (assignment_id, student_id)
);

-- Performance Indexes for Submissions
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON public.submissions(submitted_at);

-- Automatic Updated At Trigger for Submissions
DROP TRIGGER IF EXISTS on_submissions_updated ON public.submissions;
CREATE TRIGGER on_submissions_updated
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) FOR ASSIGNMENTS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Students can view only their own assigned assignments
DROP POLICY IF EXISTS "Students can view own assignments" ON public.assignments;
CREATE POLICY "Students can view own assignments"
  ON public.assignments
  FOR SELECT
  USING (auth.uid() = student_id);

-- Mentors can view assignments of their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned student assignments" ON public.assignments;
CREATE POLICY "Mentors can view assigned student assignments"
  ON public.assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.assignments.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can create assignments for their assigned students
DROP POLICY IF EXISTS "Mentors can create assignments for assigned students" ON public.assignments;
CREATE POLICY "Mentors can create assignments for assigned students"
  ON public.assignments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.assignments.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can update assignments for their assigned students
DROP POLICY IF EXISTS "Mentors can update assigned student assignments" ON public.assignments;
CREATE POLICY "Mentors can update assigned student assignments"
  ON public.assignments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.assignments.student_id
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
        AND ms.student_id = public.assignments.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Mentors can delete assignments for their assigned students
DROP POLICY IF EXISTS "Mentors can delete assigned student assignments" ON public.assignments;
CREATE POLICY "Mentors can delete assigned student assignments"
  ON public.assignments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.assignments.student_id
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Admin full access to assignments
DROP POLICY IF EXISTS "Admins have full access to assignments" ON public.assignments;
CREATE POLICY "Admins have full access to assignments"
  ON public.assignments
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 4. ROW LEVEL SECURITY (RLS) FOR SUBMISSIONS
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Students can view only their own submissions
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
CREATE POLICY "Students can view own submissions"
  ON public.submissions
  FOR SELECT
  USING (auth.uid() = student_id);

-- Students can insert submissions ONLY for assignments assigned to them
DROP POLICY IF EXISTS "Students can insert own submissions for valid assignments" ON public.submissions;
CREATE POLICY "Students can insert own submissions for valid assignments"
  ON public.submissions
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = submissions.assignment_id
        AND a.student_id = auth.uid()
    )
  );

-- Students can update their own submissions
DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
CREATE POLICY "Students can update own submissions"
  ON public.submissions
  FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

-- Mentors can view submissions of their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned student submissions" ON public.submissions;
CREATE POLICY "Mentors can view assigned student submissions"
  ON public.submissions
  FOR SELECT
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
  );

-- Mentors can update submission status (review flag) for assigned students
DROP POLICY IF EXISTS "Mentors can update assigned student submissions" ON public.submissions;
CREATE POLICY "Mentors can update assigned student submissions"
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

-- Admin full access to submissions
DROP POLICY IF EXISTS "Admins have full access to submissions" ON public.submissions;
CREATE POLICY "Admins have full access to submissions"
  ON public.submissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
