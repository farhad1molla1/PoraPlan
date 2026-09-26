-- ==============================================================================
-- PoraPlan Milestone 3: Mentor-Student Relationships & Strict Row Level Security
-- Tables: mentor_students
-- Policies: Strict relationship-based visibility, no open USING (true)
-- ==============================================================================

-- 1. MENTOR_STUDENTS RELATIONSHIP TABLE
CREATE TABLE IF NOT EXISTS public.mentor_students (
  mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (mentor_id, student_id),
  CONSTRAINT no_self_mentoring CHECK (mentor_id != student_id)
);

-- Performance indexes for reciprocal queries
CREATE INDEX IF NOT EXISTS idx_mentor_students_mentor ON public.mentor_students(mentor_id);
CREATE INDEX IF NOT EXISTS idx_mentor_students_student ON public.mentor_students(student_id);

-- 2. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.mentor_students ENABLE ROW LEVEL SECURITY;

-- 3. MENTOR_STUDENTS RLS POLICIES
-- Strict Isolation: Mentors can only view records where they are the assigned mentor
DROP POLICY IF EXISTS "Mentors can view their assigned students" ON public.mentor_students;
CREATE POLICY "Mentors can view their assigned students"
  ON public.mentor_students
  FOR SELECT
  USING (auth.uid() = mentor_id);

-- Strict Isolation: Students can only view records where they are the assigned student
DROP POLICY IF EXISTS "Students can view their assigned mentors" ON public.mentor_students;
CREATE POLICY "Students can view their assigned mentors"
  ON public.mentor_students
  FOR SELECT
  USING (auth.uid() = student_id);

-- Admins have full access to manage mentorship pairings
DROP POLICY IF EXISTS "Admins manage mentor pairings" ON public.mentor_students;
CREATE POLICY "Admins manage mentor pairings"
  ON public.mentor_students
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 4. EXTEND PROFILES RLS POLICIES FOR ASSIGNED RELATIONSHIPS
-- Mentors can view the profile details of their assigned students
DROP POLICY IF EXISTS "Mentors can view assigned students profiles" ON public.profiles;
CREATE POLICY "Mentors can view assigned students profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.mentor_id = auth.uid()
        AND ms.student_id = public.profiles.id
    )
  );

-- Students can view the profile details of their assigned mentors
DROP POLICY IF EXISTS "Students can view assigned mentor profiles" ON public.profiles;
CREATE POLICY "Students can view assigned mentor profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.mentor_students ms
      WHERE ms.student_id = auth.uid()
        AND ms.mentor_id = public.profiles.id
    )
  );

-- Admins can view all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
