-- ==============================================================================
-- PoraPlan Milestone 12.5: Reporting Module Production Security Hardening
-- Schema & Authorization Updates:
-- 1. Administrative Academic Intelligence Roster RPC:
--    - get_admin_academic_intelligence_roster()
--    - Enforces strict database-level check: caller must be authenticated and have
--      role = 'admin' with status = 'active' in public.profiles.
--    - Rejects all unauthorized callers with an explicit exception.
--    - Revokes execute from PUBLIC and anon; grants execute to authenticated.
-- 2. Student Report Access Assertion RPC:
--    - assert_student_report_access(p_student_id UUID)
--    - Verifies caller is the student themselves, an assigned active mentor, or an active admin.
-- 3. Mentor Report Access Assertion RPC:
--    - assert_mentor_report_access(p_mentor_id UUID)
--    - Verifies caller is the mentor themselves or an active admin.
-- ==============================================================================

-- 1. ADMIN ACADEMIC INTELLIGENCE ROSTER RPC
CREATE OR REPLACE FUNCTION public.get_admin_academic_intelligence_roster()
RETURNS TABLE (
  student_id UUID,
  student_name TEXT,
  poraplan_id TEXT,
  student_role TEXT,
  university TEXT,
  department TEXT,
  batch TEXT,
  current_semester TEXT,
  account_status TEXT,
  account_created_at TIMESTAMPTZ,
  program_id UUID,
  program_name TEXT,
  cohort_id UUID,
  cohort_name TEXT,
  enrollment_status TEXT,
  enrolled_at TIMESTAMPTZ,
  mentor_id UUID,
  mentor_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Strict caller authentication check
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Valid authentication session is required.';
  END IF;

  -- Verify caller role is active admin
  SELECT (role = 'admin' AND status = 'active') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can access administrative academic intelligence.';
  END IF;

  -- Return platform roster with academic metadata and relationship context
  RETURN QUERY
  SELECT
    p.id AS student_id,
    p.full_name AS student_name,
    p.poraplan_id,
    p.role::TEXT AS student_role,
    p.university,
    p.department,
    p.batch,
    p.current_semester,
    p.status::TEXT AS account_status,
    p.created_at AS account_created_at,
    pe.program_id,
    prog.name AS program_name,
    pe.cohort_id,
    c.name AS cohort_name,
    pe.status::TEXT AS enrollment_status,
    pe.enrolled_at,
    COALESCE(sma.mentor_id, cm.mentor_id) AS mentor_id,
    mp.full_name AS mentor_name
  FROM public.profiles p
  LEFT JOIN public.program_enrollments pe
    ON pe.student_id = p.id AND pe.status = 'active'
  LEFT JOIN public.programs prog
    ON prog.id = pe.program_id
  LEFT JOIN public.cohorts c
    ON c.id = pe.cohort_id
  LEFT JOIN public.student_mentor_assignments sma
    ON sma.student_id = p.id AND sma.program_id = pe.program_id AND sma.is_active = TRUE
  LEFT JOIN public.cohort_mentors cm
    ON cm.cohort_id = pe.cohort_id AND cm.program_id = pe.program_id AND cm.is_active = TRUE
  LEFT JOIN public.profiles mp
    ON mp.id = COALESCE(sma.mentor_id, cm.mentor_id)
  WHERE p.role = 'student'
  ORDER BY p.full_name ASC;
END;
$$;

COMMENT ON FUNCTION public.get_admin_academic_intelligence_roster() IS
  'Secure server-side RPC to compile platform student roster for administrative intelligence. Restricted to active platform administrators.';

-- Revoke permissions and grant strictly to authenticated users
REVOKE ALL ON FUNCTION public.get_admin_academic_intelligence_roster() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_admin_academic_intelligence_roster() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_academic_intelligence_roster() TO authenticated;


-- 2. STUDENT REPORT ACCESS ASSERTION RPC
CREATE OR REPLACE FUNCTION public.assert_student_report_access(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_status TEXT;
  v_is_assigned BOOLEAN := FALSE;
BEGIN
  IF v_caller_id IS NULL OR p_student_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Student self-access
  IF v_caller_id = p_student_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Resolve caller profile
  SELECT role::TEXT, status::TEXT INTO v_caller_role, v_caller_status
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- 3. Admin platform-wide access
  IF v_caller_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- 4. Mentor access check
  IF v_caller_role = 'mentor' THEN
    -- Check individual assignment or cohort mentor relationship
    SELECT EXISTS (
      SELECT 1 FROM public.student_mentor_assignments sma
      WHERE sma.mentor_id = v_caller_id AND sma.student_id = p_student_id AND sma.is_active = TRUE
    ) OR EXISTS (
      SELECT 1 FROM public.cohort_mentors cm
      JOIN public.program_enrollments pe ON pe.cohort_id = cm.cohort_id AND pe.student_id = p_student_id
      WHERE cm.mentor_id = v_caller_id AND cm.is_active = TRUE AND pe.status = 'active'
    ) INTO v_is_assigned;

    RETURN v_is_assigned;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.assert_student_report_access(UUID) IS
  'Validates whether the authenticated caller has authorization to view the target student progress report.';

REVOKE ALL ON FUNCTION public.assert_student_report_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_student_report_access(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_student_report_access(UUID) TO authenticated;


-- 3. MENTOR REPORT ACCESS ASSERTION RPC
CREATE OR REPLACE FUNCTION public.assert_mentor_report_access(p_mentor_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_caller_role TEXT;
  v_caller_status TEXT;
BEGIN
  IF v_caller_id IS NULL OR p_mentor_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1. Mentor self-access
  IF v_caller_id = p_mentor_id THEN
    RETURN TRUE;
  END IF;

  -- 2. Resolve caller profile
  SELECT role::TEXT, status::TEXT INTO v_caller_role, v_caller_status
  FROM public.profiles
  WHERE id = v_caller_id;

  IF v_caller_status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- 3. Admin platform-wide access
  IF v_caller_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.assert_mentor_report_access(UUID) IS
  'Validates whether the authenticated caller has authorization to view the target mentor workload report.';

REVOKE ALL ON FUNCTION public.assert_mentor_report_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assert_mentor_report_access(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.assert_mentor_report_access(UUID) TO authenticated;

