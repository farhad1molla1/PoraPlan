-- ==============================================================================
-- PoraPlan Milestone 11.9: Payment Events Database Privacy Hardening
-- Resolution for Finding SEC-11.8-001 (High Severity)
--
-- Objective:
-- Ensure Students and Mentors can NEVER read administrative internal notes
-- on payment_events through direct Supabase/PostgREST queries, while preserving:
-- 1. Full Admin access to event notes via verified administrative RPC.
-- 2. Student & Mentor read access to permitted non-sensitive event metadata.
-- 3. Row-level ownership boundaries (RLS).
-- 4. Admin-only mutation privileges.
-- ==============================================================================

-- 1. REVOKE BROAD TABLE-LEVEL SELECT FROM AUTHENTICATED
-- In PostgreSQL, table-level SELECT grants override column-level restrictions.
-- We must revoke table-level SELECT before granting access strictly to safe columns.
REVOKE SELECT ON public.payment_events FROM authenticated;

-- 2. GRANT COLUMN-LEVEL SELECT ON NON-SENSITIVE ATTRIBUTES ONLY
-- The 'note' column is deliberately EXCLUDED from this grant.
-- Any direct query requesting 'note' or '*' will be rejected by PostgreSQL with
-- 'permission denied for column note of relation payment_events'.
GRANT SELECT (
  id,
  record_type,
  student_payment_id,
  mentor_payment_id,
  payment_method,
  transaction_reference,
  payment_date,
  recorded_by,
  created_at
) ON public.payment_events TO authenticated;

-- Ensure PUBLIC and anon roles have zero access (re-assertion)
REVOKE ALL ON public.payment_events FROM PUBLIC, anon;

-- 3. ADMINISTRATIVE RPC FOR EVENT NOTES INSPECTION
-- Because Admins also authenticate via the 'authenticated' PostgreSQL role in Supabase,
-- legitimate administrative access to the sensitive 'note' column is provided via a
-- strictly gated SECURITY DEFINER function with pinned search_path and server-side role check.
CREATE OR REPLACE FUNCTION public.get_admin_payment_events(
  p_record_type TEXT,
  p_record_id UUID
)
RETURNS TABLE (
  id UUID,
  record_type TEXT,
  student_payment_id UUID,
  mentor_payment_id UUID,
  payment_method TEXT,
  transaction_reference TEXT,
  payment_date TIMESTAMPTZ,
  note TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Authentication requirement
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Valid authentication session is required.';
  END IF;

  -- 2. Verify caller is an active platform administrator
  SELECT (role = 'admin' AND status = 'active') INTO v_is_admin
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can inspect internal payment event notes.';
  END IF;

  -- 3. Parameter validation and record retrieval
  IF p_record_type = 'student' THEN
    RETURN QUERY
    SELECT
      pe.id,
      pe.record_type,
      pe.student_payment_id,
      pe.mentor_payment_id,
      pe.payment_method,
      pe.transaction_reference,
      pe.payment_date,
      pe.note,
      pe.recorded_by,
      pe.created_at
    FROM public.payment_events pe
    WHERE pe.record_type = 'student' AND pe.student_payment_id = p_record_id
    ORDER BY pe.payment_date DESC;
  ELSIF p_record_type = 'mentor' THEN
    RETURN QUERY
    SELECT
      pe.id,
      pe.record_type,
      pe.student_payment_id,
      pe.mentor_payment_id,
      pe.payment_method,
      pe.transaction_reference,
      pe.payment_date,
      pe.note,
      pe.recorded_by,
      pe.created_at
    FROM public.payment_events pe
    WHERE pe.record_type = 'mentor' AND pe.mentor_payment_id = p_record_id
    ORDER BY pe.payment_date DESC;
  ELSE
    RAISE EXCEPTION 'Invalid record_type: must be student or mentor.';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_admin_payment_events(TEXT, UUID) IS
  'Securely returns full payment event history including administrative notes strictly for verified active administrators.';

REVOKE ALL ON FUNCTION public.get_admin_payment_events(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_payment_events(TEXT, UUID) TO authenticated;
