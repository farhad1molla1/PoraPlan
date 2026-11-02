-- ==============================================================================
-- PoraPlan Milestone 10: Public Profiles Lens & Backend Privacy Gate
-- Schema Updates:
-- 1. Create public_profiles VIEW projecting only explicitly approved public fields.
-- 2. Create get_public_profile(UUID) SECURITY DEFINER RPC function with fixed search_path.
-- 3. Extend profiles SELECT policy for active assigned mentors in student_mentor_assignments
--    and cohort_mentors while keeping private fields sealed from arbitrary students and unassigned mentors.
-- 4. Grant access to authenticated and anon roles for public profile discovery.
-- ==============================================================================

-- 1. SECURE PUBLIC PROFILES VIEW
-- Strips all private contact (whatsapp_number, email, linked_email, contact_email)
-- and internal administrative/account status columns.
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
  academic_background,
  expertise,
  mentoring_subjects,
  bio,
  created_at
FROM public.profiles;

COMMENT ON VIEW public.public_profiles IS
  'Public academic identity lens for PoraPlan scholars and faculty. Excludes private communication channels and account credentials.';

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 2. SECURE PUBLIC PROFILE RESOLVER RPC
-- Parameterized lookup ensuring clean return of public identity attributes without internal table leakage.
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
  academic_background TEXT,
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
    p.academic_background,
    p.expertise,
    p.mentoring_subjects,
    p.bio,
    p.created_at
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_public_profile(UUID) IS
  'Securely returns sanitized public profile fields for any registered member by UUID.';

REVOKE ALL ON FUNCTION public.get_public_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(UUID) TO authenticated, anon;

-- 3. ENFORCE MENTOR ASSIGNMENT PRIVACY BOUNDARY ON PROFILES TABLE
-- Authorizes active mentors to read their active mentees full profiles,
-- while unassigned mentors and third-party students remain strictly blocked from private columns.
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
