-- ==============================================================================
-- PoraPlan Milestone 5: Existing Modules Integration, Access Control & Security
-- Migration: 20261030000005_modules_program_isolation_and_security.sql
-- Description:
-- 1. Add program_id and cohort_id columns to existing academic & operational tables
-- 2. Create public.is_authorized_mentor_for_student centralized authorization function (Fail-Closed on NULL program_id)
-- 3. Update and harden Row Level Security (RLS) policies across all academic tables
-- 4. Eliminate inactive mentor access and enforce strict precedence (Override > Default)
-- 5. Child-table security via parent-based authorization (submissions, study_plan_items, doubt_responses)
-- ==============================================================================

-- 1. ADDITIVE SCHEMA: PROGRAM & COHORT SCOPE ON ACADEMIC ENTITIES

-- Subjects
ALTER TABLE public.subjects
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_subjects_program_id ON public.subjects(program_id);
CREATE INDEX IF NOT EXISTS idx_subjects_cohort_id ON public.subjects(cohort_id);

-- Study Plans
ALTER TABLE public.study_plans
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_study_plans_program_id ON public.study_plans(program_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_cohort_id ON public.study_plans(cohort_id);

-- Tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_program_id ON public.tasks(program_id);
CREATE INDEX IF NOT EXISTS idx_tasks_cohort_id ON public.tasks(cohort_id);

-- Assignments
ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assignments_program_id ON public.assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_assignments_cohort_id ON public.assignments(cohort_id);

-- Evaluations
ALTER TABLE public.evaluations
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evaluations_program_id ON public.evaluations(program_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_cohort_id ON public.evaluations(cohort_id);

-- Resources
ALTER TABLE public.resources
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_resources_program_id ON public.resources(program_id);
CREATE INDEX IF NOT EXISTS idx_resources_cohort_id ON public.resources(cohort_id);

-- Doubts
ALTER TABLE public.doubts
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_doubts_program_id ON public.doubts(program_id);
CREATE INDEX IF NOT EXISTS idx_doubts_cohort_id ON public.doubts(cohort_id);

-- Announcements
ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_announcements_program_id ON public.announcements(program_id);
CREATE INDEX IF NOT EXISTS idx_announcements_cohort_id ON public.announcements(cohort_id);

-- Mentor-Students (Legacy Table Upgrade)
ALTER TABLE public.mentor_students
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_mentor_students_program_id ON public.mentor_students(program_id);

-- 2. CENTRALIZED AUTHORIZATION FUNCTIONS

-- 3-Argument Core Function: Evaluates authorization for a given mentor and student in a program
-- Precedence: Individual Override > Cohort Default > None
-- Security Rule: Fails closed on NULL program_id for mentors to prevent cross-program data leakage
CREATE OR REPLACE FUNCTION public.is_authorized_mentor_for_student(
  p_mentor_id UUID,
  p_student_id UUID,
  p_program_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_has_override BOOLEAN;
  v_is_override_mentor BOOLEAN;
BEGIN
  -- 1. Admins have platform-wide oversight
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_mentor_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 2. Verify mentor account status (suspended or non-mentors are denied)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_mentor_id AND role = 'mentor' AND status != 'suspended'
  ) THEN
    RETURN FALSE;
  END IF;

  -- 3. Fail Closed on NULL program_id for mentors!
  -- Unscoped / ambiguous records are restricted from mentor access.
  -- Students access their own records via (auth.uid() = student_id), and admins retain oversight.
  IF p_program_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 4. Verify student has an active enrollment in the specified program
  IF NOT EXISTS (
    SELECT 1 FROM public.program_enrollments
    WHERE student_id = p_student_id
      AND program_id = p_program_id
      AND status = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  -- 5. Check an active individual override first (Precedence: Override > Default)
  SELECT
    EXISTS (
      SELECT 1 FROM public.student_mentor_assignments
      WHERE student_id = p_student_id
        AND program_id = p_program_id
        AND is_active = true
    ),
    EXISTS (
      SELECT 1 FROM public.student_mentor_assignments
      WHERE student_id = p_student_id
        AND mentor_id = p_mentor_id
        AND program_id = p_program_id
        AND is_active = true
    )
  INTO v_has_override, v_is_override_mentor;

  -- If an active individual override exists:
  IF v_has_override THEN
    -- Only the assigned override mentor has operational access. Cohort default or former mentors are denied!
    RETURN v_is_override_mentor;
  END IF;

  -- 6. Check active cohort-level assignment
  IF EXISTS (
    SELECT 1
    FROM public.cohort_mentors cm
    JOIN public.program_enrollments pe ON pe.cohort_id = cm.cohort_id
    WHERE cm.mentor_id = p_mentor_id
      AND cm.program_id = p_program_id
      AND cm.is_active = true
      AND pe.student_id = p_student_id
      AND pe.program_id = p_program_id
      AND pe.status = 'active'
  ) THEN
    RETURN TRUE;
  END IF;

  -- 7. Reject all other mentors
  RETURN FALSE;
END;
$$;

-- 2-Argument Helper: Derives mentor ID internally from auth.uid() (Security Hardening)
-- Prevents caller from supplying or spoofing mentor IDs in operational RLS policies
CREATE OR REPLACE FUNCTION public.is_authorized_mentor_for_student(
  p_student_id UUID,
  p_program_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.is_authorized_mentor_for_student(auth.uid(), p_student_id, p_program_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID) TO authenticated;

-- 3. HARDENED ROW LEVEL SECURITY (RLS) POLICIES

-- ==============================================================================
-- A. SUBJECTS RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student subjects" ON public.subjects;
CREATE POLICY "Mentors can view assigned student subjects"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can create subjects for assigned students" ON public.subjects;
CREATE POLICY "Mentors can create subjects for assigned students"
  ON public.subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update assigned student subjects" ON public.subjects;
CREATE POLICY "Mentors can update assigned student subjects"
  ON public.subjects
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can delete assigned student subjects" ON public.subjects;
CREATE POLICY "Mentors can delete assigned student subjects"
  ON public.subjects
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ==============================================================================
-- B. STUDY PLANS & ITEMS RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student study plans" ON public.study_plans;
CREATE POLICY "Mentors can view assigned student study plans"
  ON public.study_plans
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can create study plans for assigned students" ON public.study_plans;
CREATE POLICY "Mentors can create study plans for assigned students"
  ON public.study_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update assigned student study plans" ON public.study_plans;
CREATE POLICY "Mentors can update assigned student study plans"
  ON public.study_plans
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can delete assigned student study plans" ON public.study_plans;
CREATE POLICY "Mentors can delete assigned student study plans"
  ON public.study_plans
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- Study Plan Items (Child-Table: Inherits Parent Authorization)
DROP POLICY IF EXISTS "Mentors can view items for assigned student plans" ON public.study_plan_items;
CREATE POLICY "Mentors can view items for assigned student plans"
  ON public.study_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (sp.student_id = auth.uid() OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id))
    )
  );

DROP POLICY IF EXISTS "Mentors can insert items for assigned student plans" ON public.study_plan_items;
CREATE POLICY "Mentors can insert items for assigned student plans"
  ON public.study_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
    )
  );

DROP POLICY IF EXISTS "Mentors can update items for assigned student plans" ON public.study_plan_items;
CREATE POLICY "Mentors can update items for assigned student plans"
  ON public.study_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
    )
  );

DROP POLICY IF EXISTS "Mentors can delete items for assigned student plans" ON public.study_plan_items;
CREATE POLICY "Mentors can delete items for assigned student plans"
  ON public.study_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
    )
  );

-- ==============================================================================
-- C. TASKS RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student tasks" ON public.tasks;
CREATE POLICY "Mentors can view assigned student tasks"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can create tasks for assigned students" ON public.tasks;
CREATE POLICY "Mentors can create tasks for assigned students"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update assigned student tasks" ON public.tasks;
CREATE POLICY "Mentors can update assigned student tasks"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can delete assigned student tasks" ON public.tasks;
CREATE POLICY "Mentors can delete assigned student tasks"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ==============================================================================
-- D. ASSIGNMENTS & SUBMISSIONS RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student assignments" ON public.assignments;
CREATE POLICY "Mentors can view assigned student assignments"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can create assignments for assigned students" ON public.assignments;
CREATE POLICY "Mentors can create assignments for assigned students"
  ON public.assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update assignments for assigned students" ON public.assignments;
CREATE POLICY "Mentors can update assignments for assigned students"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can delete assignments for assigned students" ON public.assignments;
CREATE POLICY "Mentors can delete assignments for assigned students"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- Submissions (Child-Table: Inherits Assignment Parent Authorization)
DROP POLICY IF EXISTS "Mentors can view assigned student submissions" ON public.submissions;
CREATE POLICY "Mentors can view assigned student submissions"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(a.student_id, a.program_id)
    )
  );

DROP POLICY IF EXISTS "Mentors can review submissions" ON public.submissions;
CREATE POLICY "Mentors can review submissions"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(a.student_id, a.program_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(a.student_id, a.program_id)
    )
  );

-- ==============================================================================
-- E. EVALUATIONS RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student evaluations" ON public.evaluations;
CREATE POLICY "Mentors can view assigned student evaluations"
  ON public.evaluations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can create evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can create evaluations for assigned students"
  ON public.evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can update evaluations for assigned students"
  ON public.evaluations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can delete evaluations for assigned students" ON public.evaluations;
CREATE POLICY "Mentors can delete evaluations for assigned students"
  ON public.evaluations
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ==============================================================================
-- F. RESOURCES RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student resources" ON public.resources;
CREATE POLICY "Mentors can view assigned student resources"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can create resources for assigned students" ON public.resources;
CREATE POLICY "Mentors can create resources for assigned students"
  ON public.resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update resources for assigned students" ON public.resources;
CREATE POLICY "Mentors can update resources for assigned students"
  ON public.resources
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can delete resources for assigned students" ON public.resources;
CREATE POLICY "Mentors can delete resources for assigned students"
  ON public.resources
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ==============================================================================
-- G. DOUBTS & RESPONSES RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Mentors can view assigned student doubts" ON public.doubts;
CREATE POLICY "Mentors can view assigned student doubts"
  ON public.doubts
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Mentors can update assigned student doubts" ON public.doubts;
CREATE POLICY "Mentors can update assigned student doubts"
  ON public.doubts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = student_id
    OR auth.uid() = mentor_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- Doubt Responses (Child-Table: Inherits Doubt Parent Authorization)
DROP POLICY IF EXISTS "Users can view doubt responses for accessible doubts" ON public.doubt_responses;
CREATE POLICY "Users can view doubt responses for accessible doubts"
  ON public.doubt_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = public.doubt_responses.doubt_id
        AND (d.student_id = auth.uid() OR public.is_authorized_mentor_for_student(d.student_id, d.program_id))
    )
  );

DROP POLICY IF EXISTS "Mentors and students can add responses to active doubts" ON public.doubt_responses;
CREATE POLICY "Mentors and students can add responses to active doubts"
  ON public.doubt_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = public.doubt_responses.doubt_id
        AND (d.student_id = auth.uid() OR public.is_authorized_mentor_for_student(d.student_id, d.program_id))
    )
  );

-- ==============================================================================
-- H. ANNOUNCEMENTS RLS
-- ==============================================================================
DROP POLICY IF EXISTS "Students can view published assigned announcements" ON public.announcements;
CREATE POLICY "Students can view published assigned announcements"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    status = 'published'
    AND (
      target_scope = 'platform'
      OR (target_scope = 'individual' AND student_id = auth.uid())
      OR (
        target_scope = 'assigned_students'
        AND public.is_authorized_mentor_for_student(public.announcements.author_id, auth.uid(), public.announcements.program_id)
      )
    )
  );

DROP POLICY IF EXISTS "Mentors can manage own announcements" ON public.announcements;
CREATE POLICY "Mentors can manage own announcements"
  ON public.announcements
  FOR ALL
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
