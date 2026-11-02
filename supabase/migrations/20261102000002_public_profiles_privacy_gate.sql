-- ==============================================================================
-- PoraPlan Milestone 10.1: Public Profiles Security Hardening & Privacy Gate
-- Schema Updates:
-- 1. Create public_profiles VIEW projecting only explicitly approved public fields,
--    filtering strictly for active accounts and excluding sensitive academic_background notes.
-- 2. Create get_public_profile(UUID) SECURITY DEFINER RPC function with fixed search_path,
--    active status verification, and restricted execution to authenticated members.
-- 3. Eliminate legacy unverified mentor policies and enforce strict active assignment checks
--    on student_mentor_assignments and cohort_mentors.
-- 4. Restrict discovery privileges strictly to authenticated platform members (revoking anon).
-- ==============================================================================

-- 1. SECURE PUBLIC PROFILES VIEW
-- Strips all private contact (whatsapp_number, email, linked_email, contact_email),
-- sensitive academic_background notes, and internal administrative/account status columns.
-- Filters strictly to active accounts to avoid exposing suspended or not-activated members.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  id,
  poraplan_id,
  full_name,
  role,
  avatar_url,
  university,
  department,
  batch,
  current_semester,
  expertise,
  mentoring_subjects,
  bio,
  created_at
FROM public.profiles
WHERE status = 'active';

COMMENT ON VIEW public.public_profiles IS
  'Public academic identity lens for active PoraPlan scholars and faculty. Excludes private communication channels, credentials, and sensitive notes.';

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.public_profiles TO authenticated;

-- 2. SECURE PUBLIC PROFILE RESOLVER RPC
-- Parameterized lookup ensuring clean return of public identity attributes without internal table leakage.
-- Excludes sensitive academic_background notes and enforces active account status check.
CREATE OR REPLACE FUNCTION public.get_public_profile(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  poraplan_id TEXT,
  full_name TEXT,
  role user_role,
  avatar_url TEXT,
  university TEXT,
  department TEXT,
  batch TEXT,
  current_semester TEXT,
  expertise TEXT,
  mentoring_subjects TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.poraplan_id,
    p.full_name,
    p.role,
    p.avatar_url,
    p.university,
    p.department,
    p.batch,
    p.current_semester,
    p.expertise,
    p.mentoring_subjects,
    p.bio,
    p.created_at
  FROM public.profiles p
  WHERE p.id = p_user_id
    AND p.status = 'active'
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_public_profile(UUID) IS
  'Securely returns sanitized public profile fields for active registered members by UUID.';

REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO authenticated;

-- 3. ENFORCE MENTOR ASSIGNMENT PRIVACY BOUNDARY ON PROFILES TABLE
-- Purge legacy unverified mentor policies and authorize active mentors to read their active mentees full profiles,
-- while unassigned mentors and third-party students remain strictly blocked from private columns.
DROP POLICY IF EXISTS "Mentors can view assigned students profiles" ON public.profiles;
DROP POLICY IF EXISTS "Active mentors can view assigned students profiles" ON public.profiles;

CREATE POLICY "Active mentors can view assigned students profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_mentor_assignments sma
      WHERE sma.mentor_id = auth.uid()
        AND sma.student_id = public.profiles.id
        AND sma.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM public.cohort_mentors cm
      JOIN public.program_enrollments pe ON pe.cohort_id = cm.cohort_id
      WHERE cm.mentor_id = auth.uid()
        AND pe.student_id = public.profiles.id
        AND cm.is_active = true
        AND pe.status = 'active'
    )
  );
