-- ==============================================================================
-- PoraPlan Milestone 5.1: Security Verification, RLS Hardening & Program Data Integrity
-- Migration: 20261030000006_security_hardening_and_program_integrity.sql
-- Description:
-- 1. Secure authorization functions:
--    - Enforce caller validation in is_authorized_mentor_for_student (prevent arbitrary probing)
--    - Protect get_effective_mentor_for_student against arbitrary caller data exposure
-- 2. Scoped synchronization in mentor-assignment RPCs:
--    - admin_assign_cohort_mentor, admin_end_cohort_mentor, admin_assign_individual_mentor, admin_end_individual_mentor
--    - Ensure sync operations are strictly scoped by program_id to prevent cross-program deactivation
-- 3. Enforce cohort-program alignment in individual mentor assignments
-- 4. Exhaustive RLS policy purge:
--    - Explicitly drop all legacy permissive policies across all academic and operational tables
-- 5. Hardened RLS policies with strict WITH CHECK constraints on child entities and notifications
-- ==============================================================================

-- ==============================================================================
-- 1. SECURE AUTHORIZATION HELPER FUNCTIONS
-- ==============================================================================

-- 3-Argument Core Function: Evaluates authorization for a given mentor and student in a program
-- Security Hardening: Caller MUST be the mentor themselves, the student themselves (e.g. for announcements),
-- or a platform administrator. Arbitrary third-party callers immediately receive FALSE.
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
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_has_override BOOLEAN;
  v_is_override_mentor BOOLEAN;
BEGIN
  -- 1. Caller authentication check
  IF v_caller_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 2. Determine admin oversight
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller_id;

  -- 3. Caller validation: Caller must be the mentor, the student, or an admin
  IF v_caller_id != p_mentor_id AND v_caller_id != p_student_id AND NOT COALESCE(v_is_admin, false) THEN
    RETURN FALSE;
  END IF;

  -- 4. Admins have platform-wide oversight when acting as mentor
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_mentor_id AND role = 'admin') THEN
    RETURN TRUE;
  END IF;

  -- 5. Verify target mentor account status (suspended or non-mentors are denied)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_mentor_id AND role = 'mentor' AND status != 'suspended'
  ) THEN
    RETURN FALSE;
  END IF;

  -- 6. Fail Closed on NULL program_id for mentors to prevent cross-program data leakage
  IF p_program_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 7. Verify student has an active enrollment in the specified program
  IF NOT EXISTS (
    SELECT 1 FROM public.program_enrollments
    WHERE student_id = p_student_id
      AND program_id = p_program_id
      AND status = 'active'
  ) THEN
    RETURN FALSE;
  END IF;

  -- 8. Check active individual override first (Precedence: Override > Default)
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

  IF v_has_override THEN
    RETURN v_is_override_mentor;
  END IF;

  -- 9. Check active cohort-level default assignment
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

  RETURN FALSE;
END;
$$;

-- 2-Argument Helper: Derives mentor ID internally from auth.uid()
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

REVOKE ALL ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID) TO authenticated;

-- Effective Mentor Resolution Helper Function (Hardened)
-- Protects mentor phone/whatsapp, email, and academic background from unauthorized discovery
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
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
  v_override_record RECORD;
  v_cohort_record RECORD;
BEGIN
  -- 1. Caller authentication check
  IF v_caller_id IS NULL THEN
    RETURN;
  END IF;

  -- 2. Check if caller is admin
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller_id;

  -- 3. Restrict callers: Only student themselves, platform admin, or assigned mentor
  IF v_caller_id != p_student_id AND NOT COALESCE(v_is_admin, false) THEN
    IF p_program_id IS NOT NULL THEN
      IF NOT public.is_authorized_mentor_for_student(v_caller_id, p_student_id, p_program_id) THEN
        RETURN;
      END IF;
    ELSE
      IF NOT EXISTS (
        SELECT 1 FROM public.student_mentor_assignments sma
        WHERE sma.student_id = p_student_id AND sma.mentor_id = v_caller_id AND sma.is_active = true
      ) AND NOT EXISTS (
        SELECT 1 FROM public.cohort_mentors cm
        JOIN public.program_enrollments pe ON pe.cohort_id = cm.cohort_id
        WHERE cm.mentor_id = v_caller_id AND cm.is_active = true
          AND pe.student_id = p_student_id AND pe.status = 'active'
      ) THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  -- 4. Check for active individual override
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

  -- 5. Fall back to active cohort-level default mentor
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

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_effective_mentor_for_student(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_effective_mentor_for_student(UUID, UUID) TO authenticated;


-- ==============================================================================
-- 2. HARDENED MENTOR ASSIGNMENT RPCS WITH PROGRAM-AWARE SYNCHRONIZATION
-- ==============================================================================

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

  IF NOT EXISTS (
    SELECT 1 FROM public.program_applications
    WHERE applicant_id = p_mentor_id
      AND program_id = v_cohort.program_id
      AND application_type = 'mentor'
      AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'Mentor does not have an approved application for this program.';
  END IF;

  -- 4. End existing active assignment for this cohort
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

  -- 6. Synchronize legacy mentor_students table STRICTLY SCOPED to this program
  -- Deactivate previous cohort mentor pairings for this cohort only if no individual override exists in this program
  UPDATE public.mentor_students ms
  SET status = 'inactive'
  WHERE (ms.program_id = v_cohort.program_id OR ms.program_id IS NULL)
    AND ms.mentor_id != p_mentor_id
    AND ms.student_id IN (
      SELECT pe.student_id FROM public.program_enrollments pe
      WHERE pe.cohort_id = p_cohort_id
        AND pe.program_id = v_cohort.program_id
        AND pe.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.student_mentor_assignments sma
          WHERE sma.student_id = pe.student_id
            AND sma.program_id = v_cohort.program_id
            AND sma.is_active = true
        )
    );

  -- Upsert new cohort mentor pairing with program_id
  INSERT INTO public.mentor_students (mentor_id, student_id, program_id, status, created_at)
  SELECT p_mentor_id, pe.student_id, v_cohort.program_id, 'active', timezone('utc'::text, now())
  FROM public.program_enrollments pe
  WHERE pe.cohort_id = p_cohort_id
    AND pe.program_id = v_cohort.program_id
    AND pe.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.student_mentor_assignments sma
      WHERE sma.student_id = pe.student_id
        AND sma.program_id = v_cohort.program_id
        AND sma.is_active = true
    )
  ON CONFLICT (mentor_id, student_id)
  DO UPDATE SET status = 'active', program_id = EXCLUDED.program_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'message', 'Cohort mentor assigned successfully.'
  );
END;
$$;

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
  v_program_id UUID;
BEGIN
  -- 1. Authorization check
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify assignments.';
  END IF;

  SELECT mentor_id, program_id INTO v_mentor_id, v_program_id
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

  -- 3. Synchronize legacy mentor_students table STRICTLY SCOPED to this program
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE mentor_id = v_mentor_id
    AND (program_id = v_program_id OR program_id IS NULL)
    AND student_id IN (
      SELECT pe.student_id FROM public.program_enrollments pe
      WHERE pe.cohort_id = p_cohort_id
        AND pe.program_id = v_program_id
        AND pe.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM public.student_mentor_assignments sma
          WHERE sma.student_id = pe.student_id
            AND sma.program_id = v_program_id
            AND sma.is_active = true
        )
    );

  RETURN jsonb_build_object('success', true, 'message', 'Cohort mentor assignment ended.');
END;
$$;

-- C. Assign Individual Student Mentor Override (With Cohort Validation & Scoped Sync)
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

  -- 2. Validate student enrollment in target program
  SELECT pe.student_id, pe.cohort_id INTO v_student
  FROM public.program_enrollments pe
  WHERE pe.student_id = p_student_id
    AND pe.program_id = p_program_id
    AND pe.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not actively enrolled in the specified program.';
  END IF;

  -- Enforce cohort-program alignment
  IF p_cohort_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.id = p_cohort_id AND c.program_id = p_program_id
    ) THEN
      RAISE EXCEPTION 'Specified cohort does not belong to the selected program.';
    END IF;

    IF v_student.cohort_id IS NOT NULL AND v_student.cohort_id != p_cohort_id THEN
      RAISE EXCEPTION 'Specified cohort does not match student active enrollment cohort.';
    END IF;

    v_cohort_id := p_cohort_id;
  ELSE
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

  -- 6. Synchronize legacy mentor_students table STRICTLY SCOPED to this program
  -- Deactivate any prior pairing for this student strictly in this program
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE student_id = p_student_id
    AND mentor_id != p_mentor_id
    AND (program_id = p_program_id OR program_id IS NULL);

  -- Activate new pairing with program_id
  INSERT INTO public.mentor_students (mentor_id, student_id, program_id, status, created_at)
  VALUES (p_mentor_id, p_student_id, p_program_id, 'active', timezone('utc'::text, now()))
  ON CONFLICT (mentor_id, student_id)
  DO UPDATE SET status = 'active', program_id = EXCLUDED.program_id;

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'message', 'Individual mentor override assigned successfully.'
  );
END;
$$;

-- D. End Individual Student Mentor Override (Reverts to Cohort Default within Program)
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

  -- 3. Deactivate previous individual pairing in mentor_students STRICTLY for this program
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE mentor_id = v_assignment.mentor_id
    AND student_id = v_assignment.student_id
    AND (program_id = v_assignment.program_id OR program_id IS NULL);

  -- 4. Re-activate cohort default mentor if one exists for the student's cohort in this program
  IF v_assignment.cohort_id IS NOT NULL THEN
    SELECT mentor_id INTO v_cohort_mentor_id
    FROM public.cohort_mentors
    WHERE cohort_id = v_assignment.cohort_id
      AND program_id = v_assignment.program_id
      AND is_active = true;

    IF FOUND THEN
      INSERT INTO public.mentor_students (mentor_id, student_id, program_id, status, created_at)
      VALUES (v_cohort_mentor_id, v_assignment.student_id, v_assignment.program_id, 'active', timezone('utc'::text, now()))
      ON CONFLICT (mentor_id, student_id)
      DO UPDATE SET status = 'active', program_id = EXCLUDED.program_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Individual override ended. Student reverted to cohort default mentor.'
  );
END;
$$;


-- ==============================================================================
-- 3. EXHAUSTIVE PURGE OF ALL OBSOLETE AND PERMISSIVE POLICIES
-- ==============================================================================

-- A. Subjects
DROP POLICY IF EXISTS "Students can view own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can view assigned student subjects" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can view student subjects" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can create subjects for assigned students" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can update assigned student subjects" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can update student subjects" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can delete assigned student subjects" ON public.subjects;
DROP POLICY IF EXISTS "Mentors can delete student subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins can view all subjects" ON public.subjects;
DROP POLICY IF EXISTS "Admins have full access to subjects" ON public.subjects;

-- B. Study Plans
DROP POLICY IF EXISTS "Students can view own study plans" ON public.study_plans;
DROP POLICY IF EXISTS "Mentors can view assigned student study plans" ON public.study_plans;
DROP POLICY IF EXISTS "Mentors can create study plans for assigned students" ON public.study_plans;
DROP POLICY IF EXISTS "Mentors can update assigned student study plans" ON public.study_plans;
DROP POLICY IF EXISTS "Mentors can delete assigned student study plans" ON public.study_plans;
DROP POLICY IF EXISTS "Admins can view all study plans" ON public.study_plans;
DROP POLICY IF EXISTS "Admins have full access to study plans" ON public.study_plans;

-- C. Study Plan Items
DROP POLICY IF EXISTS "Students can view own study plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can view assigned student plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can view items for assigned student plans" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can insert assigned student plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can insert items for assigned student plans" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can update assigned student plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can update items for assigned student plans" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can delete assigned student plan items" ON public.study_plan_items;
DROP POLICY IF EXISTS "Mentors can delete items for assigned student plans" ON public.study_plan_items;
DROP POLICY IF EXISTS "Admins have full access to study plan items" ON public.study_plan_items;

-- D. Tasks
DROP POLICY IF EXISTS "Students can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Students can update own task status" ON public.tasks;
DROP POLICY IF EXISTS "Mentors can view assigned student tasks" ON public.tasks;
DROP POLICY IF EXISTS "Mentors can create tasks for assigned students" ON public.tasks;
DROP POLICY IF EXISTS "Mentors can update assigned student tasks" ON public.tasks;
DROP POLICY IF EXISTS "Mentors can delete assigned student tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can manage all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins have full access to tasks" ON public.tasks;

-- E. Assignments
DROP POLICY IF EXISTS "Students can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Mentors can view assigned student assignments" ON public.assignments;
DROP POLICY IF EXISTS "Mentors can create assignments for assigned students" ON public.assignments;
DROP POLICY IF EXISTS "Mentors can update assigned student assignments" ON public.assignments;
DROP POLICY IF EXISTS "Mentors can delete assigned student assignments" ON public.assignments;
DROP POLICY IF EXISTS "Admins have full access to assignments" ON public.assignments;

-- F. Submissions
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Students can insert own submissions for valid assignments" ON public.submissions;
DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Mentors can view assigned student submissions" ON public.submissions;
DROP POLICY IF EXISTS "Mentors can update assigned student submissions" ON public.submissions;
DROP POLICY IF EXISTS "Mentors can review assigned student submissions" ON public.submissions;
DROP POLICY IF EXISTS "Mentors can review submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins have full access to submissions" ON public.submissions;

-- G. Evaluations
DROP POLICY IF EXISTS "Students can view own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can view evaluations for assigned students" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can view assigned student evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can create evaluations for assigned students" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can update evaluations for assigned students" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can update assigned student evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can delete evaluations for assigned students" ON public.evaluations;
DROP POLICY IF EXISTS "Mentors can delete assigned student evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Admins have full access to evaluations" ON public.evaluations;

-- H. Resources
DROP POLICY IF EXISTS "Students can view own resources" ON public.resources;
DROP POLICY IF EXISTS "Mentors can view assigned student resources" ON public.resources;
DROP POLICY IF EXISTS "Mentors can create resources for assigned students" ON public.resources;
DROP POLICY IF EXISTS "Mentors can update assigned student resources" ON public.resources;
DROP POLICY IF EXISTS "Mentors can delete assigned student resources" ON public.resources;
DROP POLICY IF EXISTS "Admins have full access to resources" ON public.resources;

-- I. Doubts
DROP POLICY IF EXISTS "Students can view own doubts" ON public.doubts;
DROP POLICY IF EXISTS "Mentors can view assigned student doubts" ON public.doubts;
DROP POLICY IF EXISTS "Students can create own doubts" ON public.doubts;
DROP POLICY IF EXISTS "Students can update own doubts" ON public.doubts;
DROP POLICY IF EXISTS "Mentors can update assigned student doubts" ON public.doubts;
DROP POLICY IF EXISTS "Students can delete own doubts" ON public.doubts;
DROP POLICY IF EXISTS "Admins have full access to doubts" ON public.doubts;

-- J. Doubt Responses
DROP POLICY IF EXISTS "Users can view authorized doubt responses" ON public.doubt_responses;
DROP POLICY IF EXISTS "Authorized users can post doubt responses" ON public.doubt_responses;
DROP POLICY IF EXISTS "Users can view doubt responses for accessible doubts" ON public.doubt_responses;
DROP POLICY IF EXISTS "Mentors and students can add responses to active doubts" ON public.doubt_responses;
DROP POLICY IF EXISTS "Admins have full access to doubt responses" ON public.doubt_responses;

-- K. Announcements
DROP POLICY IF EXISTS "Users can view authorized announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authorized users can create announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authors can update own announcements" ON public.announcements;
DROP POLICY IF EXISTS "Authors can delete own announcements" ON public.announcements;
DROP POLICY IF EXISTS "Students can view published assigned announcements" ON public.announcements;
DROP POLICY IF EXISTS "Mentors can manage own announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins have full access to announcements" ON public.announcements;

-- L. Announcement Acknowledgments
DROP POLICY IF EXISTS "Users can view relevant acknowledgments" ON public.announcement_acknowledgments;
DROP POLICY IF EXISTS "Students can acknowledge authorized announcements" ON public.announcement_acknowledgments;

-- M. Notifications
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authorized mentors and admins can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins have full access to notifications" ON public.notifications;


-- ==============================================================================
-- 4. HARDENED ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. SUBJECTS RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Subjects select policy"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Subjects insert policy"
  ON public.subjects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Subjects update policy"
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

CREATE POLICY "Subjects delete policy"
  ON public.subjects
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- B. STUDY PLANS & ITEMS RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Study plans select policy"
  ON public.study_plans
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Study plans insert policy"
  ON public.study_plans
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Study plans update policy"
  ON public.study_plans
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

CREATE POLICY "Study plans delete policy"
  ON public.study_plans
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- Study Plan Items: Strictly bound to parent study plan authorization
CREATE POLICY "Study plan items select policy"
  ON public.study_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          sp.student_id = auth.uid()
          OR sp.created_by = auth.uid()
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

CREATE POLICY "Study plan items insert policy"
  ON public.study_plan_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          sp.student_id = auth.uid()
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

CREATE POLICY "Study plan items update policy"
  ON public.study_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          sp.student_id = auth.uid()
          OR sp.created_by = auth.uid()
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          sp.student_id = auth.uid()
          OR sp.created_by = auth.uid()
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

CREATE POLICY "Study plan items delete policy"
  ON public.study_plan_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          sp.created_by = auth.uid()
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

-- ------------------------------------------------------------------------------
-- C. TASKS RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Tasks select policy"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Tasks insert policy"
  ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Tasks update policy"
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

CREATE POLICY "Tasks delete policy"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- D. ASSIGNMENTS RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Assignments select policy"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Assignments insert policy"
  ON public.assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Assignments update policy"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Assignments delete policy"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- E. SUBMISSIONS RLS
-- ------------------------------------------------------------------------------
-- SELECT: Student can view their own; Authorized mentor or Admin can view assigned
CREATE POLICY "Submissions select policy"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  );

-- INSERT: Student can insert their own submissions for accessible assignments
CREATE POLICY "Submissions insert policy"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND a.student_id = auth.uid()
    )
  );

-- UPDATE:
-- 1. Student can update their own unreviewed submission
-- 2. Authorized mentor can review/grade the submission
CREATE POLICY "Submissions update policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  );

-- ------------------------------------------------------------------------------
-- F. EVALUATIONS RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Evaluations select policy"
  ON public.evaluations
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR mentor_id = auth.uid()
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Evaluations insert policy"
  ON public.evaluations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    mentor_id = auth.uid()
    AND public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Evaluations update policy"
  ON public.evaluations
  FOR UPDATE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    mentor_id = auth.uid()
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Evaluations delete policy"
  ON public.evaluations
  FOR DELETE
  TO authenticated
  USING (
    mentor_id = auth.uid()
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- G. RESOURCES RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Resources select policy"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Resources insert policy"
  ON public.resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Resources update policy"
  ON public.resources
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

CREATE POLICY "Resources delete policy"
  ON public.resources
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = created_by
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- H. DOUBTS & DOUBT RESPONSES RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Doubts select policy"
  ON public.doubts
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Doubts insert policy"
  ON public.doubts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
  );

CREATE POLICY "Doubts update policy"
  ON public.doubts
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

CREATE POLICY "Doubts delete policy"
  ON public.doubts
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Doubt Responses: Bound to accessible parent doubt
CREATE POLICY "Doubt responses select policy"
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

CREATE POLICY "Doubt responses insert policy"
  ON public.doubt_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = public.doubt_responses.doubt_id
        AND (d.student_id = auth.uid() OR public.is_authorized_mentor_for_student(d.student_id, d.program_id))
    )
  );

-- ------------------------------------------------------------------------------
-- I. ANNOUNCEMENTS & ACKNOWLEDGMENTS RLS
-- ------------------------------------------------------------------------------
CREATE POLICY "Announcements select policy"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      status = 'published'
      AND (
        target_scope = 'platform'
        OR (target_scope = 'individual' AND student_id = auth.uid())
        OR (
          target_scope = 'assigned_students'
          AND public.is_authorized_mentor_for_student(author_id, auth.uid(), program_id)
        )
      )
    )
  );

CREATE POLICY "Announcements insert policy"
  ON public.announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can create any announcement
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
    OR (
      author_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor' AND status != 'suspended')
      AND target_scope != 'platform'
      AND (
        target_scope != 'individual'
        OR (
          student_id IS NOT NULL
          AND public.is_authorized_mentor_for_student(auth.uid(), student_id, program_id)
        )
      )
    )
  );

CREATE POLICY "Announcements update policy"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Announcements delete policy"
  ON public.announcements
  FOR DELETE
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Announcement Acknowledgments
CREATE POLICY "Announcement acknowledgments select policy"
  ON public.announcement_acknowledgments
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Announcement acknowledgments insert policy"
  ON public.announcement_acknowledgments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id
        AND a.status = 'published'
        AND (
          a.target_scope = 'platform'
          OR (a.target_scope = 'individual' AND a.student_id = auth.uid())
          OR (
            a.target_scope = 'assigned_students'
            AND public.is_authorized_mentor_for_student(a.author_id, auth.uid(), a.program_id)
          )
        )
    )
  );

-- ------------------------------------------------------------------------------
-- J. NOTIFICATIONS RLS (Hardened Recipient Isolation)
-- ------------------------------------------------------------------------------
CREATE POLICY "Notifications select policy"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Notifications update policy"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    recipient_id = auth.uid()
  )
  WITH CHECK (
    recipient_id = auth.uid()
  );

CREATE POLICY "Notifications insert policy"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
    OR (
      actor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor' AND status != 'suspended'
      )
      AND (
        EXISTS (
          SELECT 1 FROM public.student_mentor_assignments sma
          WHERE sma.mentor_id = auth.uid()
            AND sma.student_id = public.notifications.recipient_id
            AND sma.is_active = true
        )
        OR EXISTS (
          SELECT 1 FROM public.cohort_mentors cm
          JOIN public.program_enrollments pe ON pe.cohort_id = cm.cohort_id
          WHERE cm.mentor_id = auth.uid()
            AND cm.is_active = true
            AND pe.student_id = public.notifications.recipient_id
            AND pe.status = 'active'
        )
      )
    )
  );

CREATE POLICY "Notifications delete policy"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    recipient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
