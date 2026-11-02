-- ==============================================================================
-- PoraPlan Milestone 9: Admin Manual Direct Enrollment Function & Policies
-- Schema Updates:
-- 1. Atomic RPC: admin_manual_enroll_student
--    - Enforces admin authorization.
--    - Validates student account and role.
--    - Validates program and cohort ownership.
--    - Locks cohort row for update to serialize concurrent capacity limits.
--    - Enforces cohort capacity limit.
--    - Prevents duplicate active enrollments in the same program/cohort.
--    - Validates mentor eligibility if individual mentor is assigned.
--    - Atomically creates program_enrollments and student_mentor_assignments.
-- 2. Revoke public/anon execute and grant to authenticated.
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

  -- 7. Validate Mentor (if assigned)
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

    -- Validate mentor eligibility for this program
    IF NOT EXISTS (
      SELECT 1 FROM public.program_applications
      WHERE applicant_id = p_mentor_id
        AND program_id = p_program_id
        AND application_type = 'mentor'
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Mentor is not eligible for this program.';
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
