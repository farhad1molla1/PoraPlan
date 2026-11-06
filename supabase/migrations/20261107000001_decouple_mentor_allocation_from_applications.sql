-- ==============================================================================
-- PoraPlan Migration: 20261107000001_decouple_mentor_allocation_from_applications.sql
-- Description:
-- Decouple mentor allocation and manual enrollment from program_applications.
--
-- Replaces:
-- 1. admin_assign_cohort_mentor (Cohort Default Allocation)
-- 2. admin_assign_individual_mentor (Individual Student Override)
-- 3. admin_manual_enroll_student (Direct Manual Enrollment with Optional Mentor)
--
-- Mentor Eligibility Model:
-- - Mentor profile must exist.
-- - Mentor role must be 'mentor'.
-- - Mentor status must NOT be 'suspended'.
-- - Explicitly removes the requirement for an approved program_applications record.
-- ==============================================================================

-- ==============================================================================
-- 1. RPC: admin_assign_cohort_mentor
-- ==============================================================================
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

  -- 3. Validate mentor eligibility (Decoupled from applications)
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
  WHERE ms.program_id = v_cohort.program_id
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

  -- Upsert new cohort mentor pairing scoped by (mentor_id, student_id, program_id)
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
  ON CONFLICT (mentor_id, student_id, program_id)
  DO UPDATE SET status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'message', 'Cohort mentor assigned successfully.'
  );
END;
$$;

-- Security hardening & permissions
REVOKE ALL ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 2. RPC: admin_assign_individual_mentor
-- ==============================================================================
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

  -- 2. Validate student active enrollment in target program
  SELECT pe.student_id, pe.cohort_id INTO v_student
  FROM public.program_enrollments pe
  WHERE pe.student_id = p_student_id
    AND pe.program_id = p_program_id
    AND pe.status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not actively enrolled in the specified program.';
  END IF;

  -- Strict Cohort Validation:
  IF p_cohort_id IS NOT NULL THEN
    -- Verify cohort exists and belongs to the specified program
    IF NOT EXISTS (
      SELECT 1 FROM public.cohorts c
      WHERE c.id = p_cohort_id AND c.program_id = p_program_id
    ) THEN
      RAISE EXCEPTION 'Specified cohort does not belong to the selected program.';
    END IF;

    -- If student is enrolled without a cohort, do NOT accept arbitrary cohort ID
    IF v_student.cohort_id IS NULL THEN
      RAISE EXCEPTION 'Student is enrolled without a cohort; cannot assign a cohort-specific mentor.';
    END IF;

    -- If student is enrolled in a cohort, supplied cohort must match it exactly
    IF v_student.cohort_id != p_cohort_id THEN
      RAISE EXCEPTION 'Specified cohort does not match student active enrollment cohort.';
    END IF;

    v_cohort_id := p_cohort_id;
  ELSE
    -- Auto-resolve from enrollment (preserves NULL if student has no cohort)
    v_cohort_id := v_student.cohort_id;
  END IF;

  -- 3. Validate mentor eligibility (Decoupled from applications)
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
  UPDATE public.mentor_students
  SET status = 'inactive'
  WHERE student_id = p_student_id
    AND mentor_id != p_mentor_id
    AND program_id = p_program_id;

  -- Activate new pairing scoped by (mentor_id, student_id, program_id)
  INSERT INTO public.mentor_students (mentor_id, student_id, program_id, status, created_at)
  VALUES (p_mentor_id, p_student_id, p_program_id, 'active', timezone('utc'::text, now()))
  ON CONFLICT (mentor_id, student_id, program_id)
  DO UPDATE SET status = 'active';

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_id,
    'message', 'Individual mentor override assigned successfully.'
  );
END;
$$;

-- Security hardening & permissions
REVOKE ALL ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

-- ==============================================================================
-- 3. RPC: admin_manual_enroll_student
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_manual_enroll_student(
  p_student_id UUID,
  p_program_id UUID,
  p_cohort_id UUID,
  p_mentor_id UUID DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_caller_role user_role;
  v_student RECORD;
  v_program RECORD;
  v_cohort RECORD;
  v_mentor RECORD;
  v_active_count INT;
  v_enrollment_id UUID;
  v_mentor_assignment_id UUID := NULL;
BEGIN
  -- 1. Authorization: Only platform administrators can manually enroll students
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can manually enroll students.';
  END IF;

  -- 2. Validate Student
  SELECT * INTO v_student FROM public.profiles WHERE id = p_student_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found.';
  END IF;
  IF v_student.role != 'student' THEN
    RAISE EXCEPTION 'Selected user is not a student.';
  END IF;

  -- 3. Validate Program
  SELECT * INTO v_program FROM public.programs WHERE id = p_program_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Program not found.';
  END IF;

  -- 4. Validate Cohort and lock row for update to prevent concurrent capacity races
  SELECT * INTO v_cohort
  FROM public.cohorts
  WHERE id = p_cohort_id AND program_id = p_program_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cohort not found or does not belong to the selected program.';
  END IF;

  IF v_cohort.status IN ('completed', 'archived') THEN
    RAISE EXCEPTION 'Cannot enroll student: Cohort status is %.', v_cohort.status;
  END IF;

  -- 5. Cohort Capacity Check
  IF v_cohort.capacity IS NOT NULL THEN
    SELECT COUNT(*) INTO v_active_count
    FROM public.program_enrollments
    WHERE cohort_id = p_cohort_id AND status = 'active';

    IF v_active_count >= v_cohort.capacity THEN
      RAISE EXCEPTION 'Cannot enroll student: Cohort capacity (% scholars) has been reached.', v_cohort.capacity;
    END IF;
  END IF;

  -- 6. Duplicate Active Enrollment Check
  IF EXISTS (
    SELECT 1 FROM public.program_enrollments
    WHERE student_id = p_student_id
      AND program_id = p_program_id
      AND COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(p_cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status IN ('active', 'on_hold')
  ) THEN
    RAISE EXCEPTION 'Student is already actively enrolled in this program/cohort.';
  END IF;

  -- 7. Validate Mentor (if assigned, Decoupled from applications)
  IF p_mentor_id IS NOT NULL THEN
    IF p_mentor_id = p_student_id THEN
      RAISE EXCEPTION 'Student and Mentor cannot be the same account.';
    END IF;

    SELECT * INTO v_mentor FROM public.profiles WHERE id = p_mentor_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Selected mentor not found.';
    END IF;
    IF v_mentor.role != 'mentor' THEN
      RAISE EXCEPTION 'Selected user is not a mentor.';
    END IF;
    IF v_mentor.status = 'suspended' THEN
      RAISE EXCEPTION 'Cannot assign a suspended mentor.';
    END IF;
  END IF;

  -- 8. Create Enrollment Record
  INSERT INTO public.program_enrollments (
    student_id,
    program_id,
    cohort_id,
    application_id,
    status,
    enrolled_at,
    created_at,
    updated_at
  ) VALUES (
    p_student_id,
    p_program_id,
    p_cohort_id,
    NULL,
    'active',
    timezone('utc'::text, now()),
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  ) RETURNING id INTO v_enrollment_id;

  -- 9. Create Individual Mentor Assignment (if mentor selected)
  IF p_mentor_id IS NOT NULL THEN
    -- Deactivate any previous active individual mentor assignment for this student/program
    UPDATE public.student_mentor_assignments
    SET is_active = false,
        ended_at = timezone('utc'::text, now()),
        updated_at = timezone('utc'::text, now())
    WHERE student_id = p_student_id
      AND program_id = p_program_id
      AND is_active = true;

    INSERT INTO public.student_mentor_assignments (
      student_id,
      mentor_id,
      program_id,
      cohort_id,
      assignment_type,
      assigned_by,
      assigned_at,
      is_active,
      notes,
      created_at,
      updated_at
    ) VALUES (
      p_student_id,
      p_mentor_id,
      p_program_id,
      p_cohort_id,
      'individual',
      auth.uid(),
      timezone('utc'::text, now()),
      true,
      p_notes,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    ) RETURNING id INTO v_mentor_assignment_id;
  END IF;

  -- 10. Return result JSON
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Student successfully enrolled.',
    'enrollment_id', v_enrollment_id,
    'mentor_assignment_id', v_mentor_assignment_id
  );
END;
$$;

-- Security hardening: revoke from public/anon, grant to authenticated only
REVOKE ALL ON FUNCTION public.admin_manual_enroll_student(UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_manual_enroll_student(UUID, UUID, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_manual_enroll_student(UUID, UUID, UUID, UUID, TEXT) TO authenticated;
