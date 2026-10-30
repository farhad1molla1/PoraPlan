-- ==============================================================================
-- PoraPlan Milestone 4: Mentor Assignment & Matching System
-- Schema Migration: 20261030000004_mentor_assignments_schema.sql
-- Description:
-- 1. Create public.cohort_mentors (Cohort-level default mentor allocations)
-- 2. Create public.student_mentor_assignments (Individual student-level overrides)
-- 3. Row Level Security (RLS) policies for Admin, Mentors, and Students
-- 4. Atomic database functions for assigning, replacing, and ending assignments
-- 5. Helper function for effective mentor resolution: Individual Override ?? Cohort Default ?? None
-- 6. Synchronization with legacy public.mentor_students for backward compatibility
-- ==============================================================================

-- 1. COHORT MENTORS (Cohort-Level Allocations)
CREATE TABLE IF NOT EXISTS public.cohort_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES public.cohorts(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enforce exactly one active default mentor per cohort at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_cohort_mentors_active_unique
  ON public.cohort_mentors (cohort_id)
  WHERE (is_active = true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cohort_mentors_mentor_id ON public.cohort_mentors(mentor_id);
CREATE INDEX IF NOT EXISTS idx_cohort_mentors_cohort_id ON public.cohort_mentors(cohort_id);
CREATE INDEX IF NOT EXISTS idx_cohort_mentors_program_id ON public.cohort_mentors(program_id);
CREATE INDEX IF NOT EXISTS idx_cohort_mentors_is_active ON public.cohort_mentors(is_active);

-- 2. STUDENT MENTOR ASSIGNMENTS (Individual Student Overrides)
CREATE TABLE IF NOT EXISTS public.student_mentor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  assignment_type TEXT NOT NULL DEFAULT 'individual' CHECK (assignment_type IN ('individual')),
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT no_self_mentoring CHECK (mentor_id != student_id)
);

-- Enforce exactly one active individual override per student per program at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_mentor_active_unique
  ON public.student_mentor_assignments (student_id, program_id)
  WHERE (is_active = true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_student_mentor_student_id ON public.student_mentor_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_mentor_mentor_id ON public.student_mentor_assignments(mentor_id);
CREATE INDEX IF NOT EXISTS idx_student_mentor_program_id ON public.student_mentor_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_student_mentor_is_active ON public.student_mentor_assignments(is_active);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.cohort_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mentor_assignments ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES FOR COHORT MENTORS
DROP POLICY IF EXISTS "Admins have full access to cohort_mentors" ON public.cohort_mentors;
CREATE POLICY "Admins have full access to cohort_mentors"
  ON public.cohort_mentors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Mentors can view their own cohort assignments" ON public.cohort_mentors;
CREATE POLICY "Mentors can view their own cohort assignments"
  ON public.cohort_mentors
  FOR SELECT
  TO authenticated
  USING (mentor_id = auth.uid());

DROP POLICY IF EXISTS "Students can view cohort mentor of their enrolled cohorts" ON public.cohort_mentors;
CREATE POLICY "Students can view cohort mentor of their enrolled cohorts"
  ON public.cohort_mentors
  FOR SELECT
  TO authenticated
  USING (
    cohort_id IN (
      SELECT pe.cohort_id FROM public.program_enrollments pe
      WHERE pe.student_id = auth.uid() AND pe.status = 'active'
    )
  );

-- 5. RLS POLICIES FOR STUDENT MENTOR ASSIGNMENTS
DROP POLICY IF EXISTS "Admins have full access to student_mentor_assignments" ON public.student_mentor_assignments;
CREATE POLICY "Admins have full access to student_mentor_assignments"
  ON public.student_mentor_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Mentors can view their individual assignments" ON public.student_mentor_assignments;
CREATE POLICY "Mentors can view their individual assignments"
  ON public.student_mentor_assignments
  FOR SELECT
  TO authenticated
  USING (mentor_id = auth.uid());

DROP POLICY IF EXISTS "Students can view their own individual assignments" ON public.student_mentor_assignments;
CREATE POLICY "Students can view their own individual assignments"
  ON public.student_mentor_assignments
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

-- 6. EFFECTIVE MENTOR RESOLUTION HELPER FUNCTION
-- Precedence: Individual Override ?? Cohort Default ?? None
CREATE OR REPLACE FUNCTION public.get_effective_mentor_for_student(
  p_student_id UUID,
  p_program_id UUID DEFAULT NULL
)
RETURNS TABLE (
  mentor_id UUID,
  assignment_type TEXT,
  assignment_id UUID,
  cohort_id UUID,
  program_id UUID,
  assigned_at TIMESTAMPTZ,
  mentor_name TEXT,
  mentor_email TEXT,
  mentor_poraplan_id TEXT,
  mentor_whatsapp TEXT,
  mentor_background TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_override_record RECORD;
  v_cohort_record RECORD;
BEGIN
  -- 1. Check for active individual override
  SELECT
    sma.id AS a_id,
    sma.mentor_id AS m_id,
    'individual'::TEXT AS a_type,
    sma.cohort_id AS c_id,
    sma.program_id AS p_id,
    sma.assigned_at AS a_at,
    p.full_name AS m_name,
    p.email AS m_email,
    p.poraplan_id AS m_pid,
    p.whatsapp_number AS m_wa,
    p.academic_background AS m_bg
  INTO v_override_record
  FROM public.student_mentor_assignments sma
  JOIN public.profiles p ON p.id = sma.mentor_id
  WHERE sma.student_id = p_student_id
    AND sma.is_active = true
    AND (p_program_id IS NULL OR sma.program_id = p_program_id)
  ORDER BY sma.assigned_at DESC
  LIMIT 1;

  IF FOUND THEN
    mentor_id := v_override_record.m_id;
    assignment_type := v_override_record.a_type;
    assignment_id := v_override_record.a_id;
    cohort_id := v_override_record.c_id;
    program_id := v_override_record.p_id;
    assigned_at := v_override_record.a_at;
    mentor_name := v_override_record.m_name;
    mentor_email := v_override_record.m_email;
    mentor_poraplan_id := v_override_record.m_pid;
    mentor_whatsapp := v_override_record.m_wa;
    mentor_background := v_override_record.m_bg;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 2. Fall back to active cohort-level default mentor
  SELECT
    cm.id AS a_id,
    cm.mentor_id AS m_id,
    'cohort'::TEXT AS a_type,
    pe.cohort_id AS c_id,
    pe.program_id AS p_id,
    cm.assigned_at AS a_at,
    p.full_name AS m_name,
    p.email AS m_email,
    p.poraplan_id AS m_pid,
    p.whatsapp_number AS m_wa,
    p.academic_background AS m_bg
  INTO v_cohort_record
  FROM public.program_enrollments pe
  JOIN public.cohort_mentors cm ON cm.cohort_id = pe.cohort_id AND cm.is_active = true
  JOIN public.profiles p ON p.id = cm.mentor_id
  WHERE pe.student_id = p_student_id
    AND pe.status = 'active'
    AND (p_program_id IS NULL OR pe.program_id = p_program_id)
  ORDER BY pe.enrolled_at DESC
  LIMIT 1;

  IF FOUND THEN
    mentor_id := v_cohort_record.m_id;
    assignment_type := v_cohort_record.a_type;
    assignment_id := v_cohort_record.a_id;
    cohort_id := v_cohort_record.c_id;
    program_id := v_cohort_record.p_id;
    assigned_at := v_cohort_record.a_at;
    mentor_name := v_cohort_record.m_name;
    mentor_email := v_cohort_record.m_email;
    mentor_poraplan_id := v_cohort_record.m_pid;
    mentor_whatsapp := v_cohort_record.m_wa;
    mentor_background := v_cohort_record.m_bg;
    RETURN NEXT;
    RETURN;
  END IF;

  -- No mentor found
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_effective_mentor_for_student(UUID, UUID) TO authenticated;

-- 7. ATOMIC ASSIGNMENT MANAGEMENT RPCS
-- A. Assign / Replace Cohort Default Mentor
CREATE OR REPLACE FUNCTION public.admin_assign_cohort_mentor(
  p_cohort_id UUID,
  p_mentor_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cohort RECORD;
  v_mentor RECORD;
  v_existing RECORD;
  v_new_id UUID;
BEGIN
  -- 1. Authorization check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can assign cohort mentors.';
  END IF;

  -- 2. Validate cohort
  SELECT id, program_id, name, status INTO v_cohort
  FROM public.cohorts
  WHERE id = p_cohort_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cohort not found.';
  END IF;

  IF v_cohort.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Cannot assign mentor to a completed or archived cohort.';
  END IF;

  -- 3. Validate mentor eligibility
  SELECT id, role, status INTO v_mentor
  FROM public.profiles
  WHERE id = p_mentor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentor profile not found.';
  END IF;

  IF v_mentor.role != 'mentor' THEN
    RAISE EXCEPTION 'Target user does not hold the mentor role.';
  END IF;

  IF v_mentor.status = 'suspended' THEN
    RAISE EXCEPTION 'Cannot assign a suspended mentor.';
  END IF;

  -- Validate approved mentor application for target program
  IF NOT EXISTS (
    SELECT 1 FROM public.program_applications
    WHERE applicant_id = p_mentor_id
      AND program_id = v_cohort.program_id
      AND application_type = 'mentor'
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Mentor does not have an approved application for this program.';
  END IF;

  -- 4. End existing active assignment for this cohort (if any)
  UPDATE public.cohort_mentors
  SET is_active = false,
      ended_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now()),
      notes = COALESCE(notes || E'\n[Replaced by admin]', notes)
  WHERE cohort_id = p_cohort_id AND is_active = true;

  -- 5. Insert new active cohort assignment
  INSERT INTO public.cohort_mentors (
    cohort_id,
    mentor_id,
    program_id,
    assigned_by,
    assigned_at,
    is_active,
    notes
  ) VALUES (
    p_cohort_id,
    p_mentor_id,
    v_cohort.program_id,
    auth.uid(),
    timezone('utc'::text, now()),
    true,
    p_notes
  )
  RETURNING id INTO v_new_id;

  -- 6. Synchronize legacy mentor_students table for enrolled students without overrides
  -- Deactivate previous cohort mentor pairings for this cohort where no individual override exists
  UPDATE public.mentor_students ms
  SET status = 'inactive'
  WHERE ms.student_id IN (
    SELECT pe.student_id FROM public.program_enrollments pe
    WHERE pe.cohort_id = p_cohort_id AND pe.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.student_mentor_assignments sma
        WHERE sma.student_id = pe.student_id AND sma.is_active = true
      )
  ) AND ms.mentor_id != p_mentor_id;

  -- Upsert new cohort mentor pairing
  INSERT INTO public.mentor_students (mentor_id, student_id, status, created_at)
  SELECT p_mentor_id, pe.student_id, 'active', timezone('utc'::text, now())
  FROM public.program_enrollments pe
  WHERE pe.cohort_id = p_cohort_id AND pe.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.student_mentor_assignments sma
      WHERE sma.student_id = pe.student_id AND sma.is_active = true
    )
  ON CONFLICT (mentor_id, student_id)
  DO UPDATE SET status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'message', 'Cohort mentor assigned successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) TO authenticated;

-- B. End Cohort Default Mentor Assignment
CREATE OR REPLACE FUNCTION public.admin_end_cohort_mentor(
  p_cohort_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentor_id UUID;
BEGIN
  -- 1. Authorization check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify assignments.';
  END IF;

  SELECT mentor_id INTO v_mentor_id
  FROM public.cohort_mentors
  WHERE cohort_id = p_cohort_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active cohort mentor found for this cohort.');
  END IF;

  -- 2. Mark assignment ended
  UPDATE public.cohort_mentors
  SET is_active = false,
      ended_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now()),
      notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n' || p_notes, p_notes) ELSE notes END
  WHERE cohort_id = p_cohort_id AND is_active = true;

  -- 3. Synchronize legacy mentor_students table
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE mentor_id = v_mentor_id
    AND student_id IN (
      SELECT pe.student_id FROM public.program_enrollments pe
      WHERE pe.cohort_id = p_cohort_id AND pe.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.student_mentor_assignments sma
          WHERE sma.student_id = pe.student_id AND sma.is_active = true
        )
    );

  RETURN jsonb_build_object('success', true, 'message', 'Cohort mentor assignment ended.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_end_cohort_mentor(UUID, TEXT) TO authenticated;

-- C. Assign Individual Student Mentor Override
CREATE OR REPLACE FUNCTION public.admin_assign_individual_mentor(
  p_student_id UUID,
  p_mentor_id UUID,
  p_program_id UUID,
  p_cohort_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student RECORD;
  v_mentor RECORD;
  v_cohort_id UUID := p_cohort_id;
  v_new_id UUID;
BEGIN
  -- 1. Authorization check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can assign individual mentors.';
  END IF;

  IF p_student_id = p_mentor_id THEN
    RAISE EXCEPTION 'Student and Mentor cannot be the same account.';
  END IF;

  -- 2. Validate student enrollment
  SELECT pe.student_id, pe.cohort_id INTO v_student
  FROM public.program_enrollments pe
  WHERE pe.student_id = p_student_id
    AND pe.program_id = p_program_id
    AND pe.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not actively enrolled in the specified program.';
  END IF;

  IF v_cohort_id IS NULL THEN
    v_cohort_id := v_student.cohort_id;
  END IF;

  -- 3. Validate mentor eligibility
  SELECT id, role, status INTO v_mentor
  FROM public.profiles
  WHERE id = p_mentor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mentor profile not found.';
  END IF;

  IF v_mentor.role != 'mentor' THEN
    RAISE EXCEPTION 'Selected user is not a mentor.';
  END IF;

  IF v_mentor.status = 'suspended' THEN
    RAISE EXCEPTION 'Cannot assign a suspended mentor.';
  END IF;

  -- Validate approved mentor application for target program
  IF NOT EXISTS (
    SELECT 1 FROM public.program_applications
    WHERE applicant_id = p_mentor_id
      AND program_id = p_program_id
      AND application_type = 'mentor'
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Mentor does not have an approved application for this program.';
  END IF;

  -- 4. End existing active individual override for this student & program
  UPDATE public.student_mentor_assignments
  SET is_active = false,
      ended_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now()),
      notes = COALESCE(notes || E'\n[Replaced by admin]', notes)
  WHERE student_id = p_student_id AND program_id = p_program_id AND is_active = true;

  -- 5. Insert new individual override
  INSERT INTO public.student_mentor_assignments (
    student_id,
    mentor_id,
    program_id,
    cohort_id,
    assignment_type,
    assigned_by,
    assigned_at,
    is_active,
    notes
  ) VALUES (
    p_student_id,
    p_mentor_id,
    p_program_id,
    v_cohort_id,
    'individual',
    auth.uid(),
    timezone('utc'::text, now()),
    true,
    p_notes
  )
  RETURNING id INTO v_new_id;

  -- 6. Synchronize legacy mentor_students table
  -- Deactivate any prior pairing for this student
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE student_id = p_student_id AND mentor_id != p_mentor_id;

  -- Activate new pairing
  INSERT INTO public.mentor_students (mentor_id, student_id, status, created_at)
  VALUES (p_mentor_id, p_student_id, 'active', timezone('utc'::text, now()))
  ON CONFLICT (mentor_id, student_id)
  DO UPDATE SET status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'message', 'Individual mentor override assigned successfully.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- D. End Individual Student Mentor Override (Reverts to Cohort Default)
CREATE OR REPLACE FUNCTION public.admin_end_individual_mentor(
  p_assignment_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment RECORD;
  v_cohort_mentor_id UUID;
BEGIN
  -- 1. Authorization check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can end individual overrides.';
  END IF;

  SELECT id, student_id, mentor_id, cohort_id, program_id INTO v_assignment
  FROM public.student_mentor_assignments
  WHERE id = p_assignment_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Active individual assignment not found.');
  END IF;

  -- 2. Mark ended
  UPDATE public.student_mentor_assignments
  SET is_active = false,
      ended_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now()),
      notes = CASE WHEN p_notes IS NOT NULL THEN COALESCE(notes || E'\n' || p_notes, p_notes) ELSE notes END
  WHERE id = p_assignment_id;

  -- 3. Deactivate previous individual pairing in mentor_students
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE mentor_id = v_assignment.mentor_id AND student_id = v_assignment.student_id;

  -- 4. Re-activate cohort default mentor if one exists for the student's cohort
  IF v_assignment.cohort_id IS NOT NULL THEN
    SELECT mentor_id INTO v_cohort_mentor_id
    FROM public.cohort_mentors
    WHERE cohort_id = v_assignment.cohort_id AND is_active = true;

    IF FOUND THEN
      INSERT INTO public.mentor_students (mentor_id, student_id, status, created_at)
      VALUES (v_cohort_mentor_id, v_assignment.student_id, 'active', timezone('utc'::text, now()))
      ON CONFLICT (mentor_id, student_id)
      DO UPDATE SET status = 'active';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Individual override ended. Student reverted to cohort default mentor.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_end_individual_mentor(UUID, TEXT) TO authenticated;
