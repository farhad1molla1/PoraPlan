-- ==============================================================================
-- PoraPlan Milestone 5.2: Final Security Corrections & Regression Verification
-- Migration: 20261030000007_final_security_and_integrity_corrections.sql
-- Description:
-- 1. Program-Aware Mentor Synchronization in mentor_students:
--    - Drop legacy (mentor_id, student_id) primary key constraint
--    - Establish (mentor_id, student_id, program_id) uniqueness for non-NULL programs
--    - Scope legacy sync strictly to exact program_id without touching NULL historical records
--    - Upsert with ON CONFLICT (mentor_id, student_id, program_id) to prevent cross-program overwrites
-- 2. Former Mentor Access Elimination:
--    - Remove permissive auth.uid() = created_by / mentor_id = auth.uid() from private academic records
--    - Restrict mentor access strictly to active assignments via is_authorized_mentor_for_student
-- 3. Announcement Update Authorization:
--    - Restrict mentor updates: forbid target_scope = 'platform', enforce current student assignment
-- 4. Submission Ownership & Grading Integrity:
--    - Secure trigger to prevent student tampering with score, feedback, reviewer, assignment_id, student_id
--    - Separate and enforce mentor review privileges strictly for active assigned mentees
-- 5. Effective Mentor Program Isolation:
--    - Require specific program_id for mentor callers in get_effective_mentor_for_student
--    - Prevent cross-program mentor discovery via NULL program_id
-- 6. Strict Cohort Validation in individual mentor assignment:
--    - Disallow arbitrary cohort IDs when student enrollment cohort is NULL
--    - Enforce cohort-program alignment and enrollment match
-- 7. Revoke execution grants from PUBLIC and anon across all security-sensitive functions
-- ==============================================================================

-- ==============================================================================
-- 1. MENTOR_STUDENTS PROGRAM-AWARE CONSTRAINT & IDENTITY
-- ==============================================================================

-- Drop the old primary key on (mentor_id, student_id) which blocked multi-program mentorship
ALTER TABLE public.mentor_students DROP CONSTRAINT IF EXISTS mentor_students_pkey;

-- Create unique index scoped by (mentor_id, student_id, program_id) for program-isolated pairings
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_students_mentor_student_program_unique
  ON public.mentor_students (mentor_id, student_id, program_id);


-- ==============================================================================
-- 2. SECURE AUTHORIZATION & EFFECTIVE MENTOR FUNCTIONS
-- ==============================================================================

-- Core 3-argument authorization helper
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

-- 2-argument authorization helper
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

-- Effective Mentor Resolution Helper Function (Strict Program Isolation)
-- Requires specific program_id for mentor callers to prevent cross-program mentor discovery
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

  -- 3. Authorization check
  -- If caller is NOT the student and NOT an admin:
  IF v_caller_id != p_student_id AND NOT COALESCE(v_is_admin, false) THEN
    -- MENTOR CALLER RULES:
    -- A specific program_id is REQUIRED. NULL program queries are forbidden for mentors!
    IF p_program_id IS NULL THEN
      RETURN; -- Fail closed: mentors cannot query without program_id
    END IF;

    -- Caller MUST be an active assigned mentor in this exact program!
    IF NOT public.is_authorized_mentor_for_student(v_caller_id, p_student_id, p_program_id) THEN
      RETURN; -- Unauthorized: return empty set
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


-- ==============================================================================
-- 3. PROGRAM-AWARE ASSIGNMENT RPCS (EXACT SCOPING & STRICT VALIDATION)
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
    AND program_id = v_program_id
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

-- C. Assign Individual Student Mentor Override (Strict Cohort Validation & Program Sync)
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

-- D. End Individual Student Mentor Override (Strict Program Scope)
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

  -- 2. Mark assignment ended
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
    AND program_id = v_assignment.program_id;

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
      ON CONFLICT (mentor_id, student_id, program_id)
      DO UPDATE SET status = 'active';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Individual override ended. Student reverted to cohort default mentor.'
  );
END;
$$;


-- ==============================================================================
-- 4. FORMER MENTOR ACCESS REMOVAL (PURGE CREATED_BY / MENTOR_ID BYPASSES)
-- ==============================================================================

-- A. Subjects: Access requires current student ownership or active mentor assignment
DROP POLICY IF EXISTS "Subjects select policy" ON public.subjects;
CREATE POLICY "Subjects select policy"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Subjects update policy" ON public.subjects;
CREATE POLICY "Subjects update policy"
  ON public.subjects
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

DROP POLICY IF EXISTS "Subjects delete policy" ON public.subjects;
CREATE POLICY "Subjects delete policy"
  ON public.subjects
  FOR DELETE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- B. Study Plans & Items
DROP POLICY IF EXISTS "Study plans select policy" ON public.study_plans;
CREATE POLICY "Study plans select policy"
  ON public.study_plans
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Study plans update policy" ON public.study_plans;
CREATE POLICY "Study plans update policy"
  ON public.study_plans
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

DROP POLICY IF EXISTS "Study plans delete policy" ON public.study_plans;
CREATE POLICY "Study plans delete policy"
  ON public.study_plans
  FOR DELETE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Study plan items select policy" ON public.study_plan_items;
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
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

DROP POLICY IF EXISTS "Study plan items update policy" ON public.study_plan_items;
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
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

DROP POLICY IF EXISTS "Study plan items delete policy" ON public.study_plan_items;
CREATE POLICY "Study plan items delete policy"
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

-- C. Tasks
DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
CREATE POLICY "Tasks update policy"
  ON public.tasks
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

DROP POLICY IF EXISTS "Tasks delete policy" ON public.tasks;
CREATE POLICY "Tasks delete policy"
  ON public.tasks
  FOR DELETE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- D. Assignments
DROP POLICY IF EXISTS "Assignments select policy" ON public.assignments;
CREATE POLICY "Assignments select policy"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Assignments update policy" ON public.assignments;
CREATE POLICY "Assignments update policy"
  ON public.assignments
  FOR UPDATE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Assignments delete policy" ON public.assignments;
CREATE POLICY "Assignments delete policy"
  ON public.assignments
  FOR DELETE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- E. Evaluations
DROP POLICY IF EXISTS "Evaluations select policy" ON public.evaluations;
CREATE POLICY "Evaluations select policy"
  ON public.evaluations
  FOR SELECT
  TO authenticated
  USING (
    student_id = auth.uid()
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Evaluations update policy" ON public.evaluations;
CREATE POLICY "Evaluations update policy"
  ON public.evaluations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Evaluations delete policy" ON public.evaluations;
CREATE POLICY "Evaluations delete policy"
  ON public.evaluations
  FOR DELETE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- F. Resources
DROP POLICY IF EXISTS "Resources select policy" ON public.resources;
CREATE POLICY "Resources select policy"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Resources update policy" ON public.resources;
CREATE POLICY "Resources update policy"
  ON public.resources
  FOR UPDATE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Resources delete policy" ON public.resources;
CREATE POLICY "Resources delete policy"
  ON public.resources
  FOR DELETE
  TO authenticated
  USING (
    public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- G. Doubts & Responses
DROP POLICY IF EXISTS "Doubts select policy" ON public.doubts;
CREATE POLICY "Doubts select policy"
  ON public.doubts
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = student_id
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Doubts update policy" ON public.doubts;
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


-- ==============================================================================
-- 5. ANNOUNCEMENT TARGETING & UPDATE INTEGRITY
-- ==============================================================================

DROP POLICY IF EXISTS "Announcements update policy" ON public.announcements;
CREATE POLICY "Announcements update policy"
  ON public.announcements
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      author_id = auth.uid()
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor' AND status != 'suspended')
    )
  )
  WITH CHECK (
    -- Admin can update announcements across scopes
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      -- Mentor cannot change author_id, cannot promote to platform scope, and must be authorized for target
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

-- Database Trigger to enforce announcement targeting integrity
CREATE OR REPLACE FUNCTION public.protect_announcement_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If updated by non-admin:
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    IF NEW.author_id != OLD.author_id THEN
      RAISE EXCEPTION 'Cannot reassign announcement author.';
    END IF;

    IF NEW.target_scope = 'platform' AND OLD.target_scope != 'platform' THEN
      RAISE EXCEPTION 'Mentors cannot change announcement scope to platform-wide.';
    END IF;

    IF NEW.target_scope = 'individual' AND (
      NEW.student_id IS NULL OR NOT public.is_authorized_mentor_for_student(auth.uid(), NEW.student_id, NEW.program_id)
    ) THEN
      RAISE EXCEPTION 'Cannot direct announcement to unauthorized student.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_protect_announcement_fields ON public.announcements;
CREATE TRIGGER on_protect_announcement_fields
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_announcement_fields();


-- ==============================================================================
-- 6. SUBMISSION INTEGRITY & GRADING PROTECTION TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_submission_review_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_is_authorized_mentor BOOLEAN := FALSE;
  v_program_id UUID;
BEGIN
  -- 1. Identify platform administrator
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Prevent tampering with ownership and assignment links
  IF NOT COALESCE(v_is_admin, false) THEN
    IF NEW.student_id != OLD.student_id THEN
      RAISE EXCEPTION 'Cannot transfer submission ownership to another student.';
    END IF;

    IF NEW.assignment_id != OLD.assignment_id THEN
      RAISE EXCEPTION 'Cannot reassign submission to another assignment.';
    END IF;
  END IF;

  -- 3. Resolve parent assignment program
  SELECT program_id INTO v_program_id
  FROM public.assignments
  WHERE id = OLD.assignment_id;

  -- 4. Check whether caller is an active authorized mentor for this mentee
  v_is_authorized_mentor := public.is_authorized_mentor_for_student(auth.uid(), OLD.student_id, v_program_id);

  -- 5. Student updating submission:
  IF auth.uid() = OLD.student_id AND NOT COALESCE(v_is_admin, false) THEN
    -- Student CANNOT modify review fields: feedback, score, reviewed_by, reviewed_at
    NEW.feedback := OLD.feedback;
    NEW.score := OLD.score;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;

    -- If status was already reviewed, student cannot arbitrarily mark it reviewed/under_review
    IF NEW.status IN ('under_review', 'reviewed') AND OLD.status NOT IN ('under_review', 'reviewed') THEN
      NEW.status := 'submitted';
    END IF;
  END IF;

  -- 6. Mentor reviewing submission:
  IF v_is_authorized_mentor AND auth.uid() != OLD.student_id AND NOT COALESCE(v_is_admin, false) THEN
    -- Mentor cannot tamper with student's original submission content
    NEW.content := OLD.content;
    NEW.link_url := OLD.link_url;
    NEW.file_name := OLD.file_name;
    NEW.file_size := OLD.file_size;
    NEW.submission_type := OLD.submission_type;
    NEW.submitted_at := OLD.submitted_at;

    -- Set reviewer identity and timestamp automatically
    NEW.reviewed_by := auth.uid();
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := timezone('utc'::text, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_protect_submission_review_fields ON public.submissions;
CREATE TRIGGER on_protect_submission_review_fields
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_submission_review_fields();


-- ==============================================================================
-- 7. FUNCTION GRANTS AUDIT & REVOCATION FROM PUBLIC / ANON
-- ==============================================================================

REVOKE ALL ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_authorized_mentor_for_student(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_effective_mentor_for_student(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_effective_mentor_for_student(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_effective_mentor_for_student(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_cohort_mentor(UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_end_cohort_mentor(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_end_cohort_mentor(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_end_cohort_mentor(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_assign_individual_mentor(UUID, UUID, UUID, UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_end_individual_mentor(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_end_individual_mentor(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_end_individual_mentor(UUID, TEXT) TO authenticated;
