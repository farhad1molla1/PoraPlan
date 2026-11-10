-- ==============================================================================
-- PoraPlan: Retire Legacy Test Account Provisioning & Suspend Default Accounts
--
-- Migration: 20261110000002_retire_test_account_provisioning.sql
-- Description:
--   1. Retires and drops the legacy public.provision_poraplan_account function.
--   2. Suspends public.profiles records for the three legacy test accounts
--      (PP001, PPM001, PPA001) while preserving their historical roles,
--      metadata, and foreign-key integrity.
--   3. Deactivates active mentor assignments in public.cohort_mentors and
--      public.student_mentor_assignments for PPM001.
--   4. Deactivates active mentor pairings in public.mentor_students for PPM001.
--   5. Ensures future migration chains never recreate predictable default accounts.
--   6. Does NOT mutate managed auth.* tables directly, adhering to Supabase
--      Auth Admin API separation standards.
-- ==============================================================================

-- 1. Retire and drop legacy provisioning function
DROP FUNCTION IF EXISTS public.provision_poraplan_account(TEXT, TEXT, TEXT, user_role, TEXT);

-- 2. Idempotently suspend public.profiles for the exact test accounts
-- Preserves existing profile roles (including PPA001's admin role for historical audit integrity)
UPDATE public.profiles
SET status = 'suspended',
    updated_at = timezone('utc'::text, now())
WHERE poraplan_id IN ('PP001', 'PPM001', 'PPA001')
  AND email IN (
    'student.pp001@poraplan.internal',
    'mentor.ppm001@poraplan.internal',
    'admin.ppa001@poraplan.internal'
  );

-- 3. Deactivate any active default cohort mentor assignments for PPM001
UPDATE public.cohort_mentors
SET is_active = false,
    ended_at = COALESCE(ended_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
WHERE mentor_id IN (
  SELECT id FROM public.profiles
  WHERE poraplan_id = 'PPM001'
    AND email = 'mentor.ppm001@poraplan.internal'
)
AND (is_active = true OR ended_at IS NULL);

-- 4. Deactivate any active individual student mentor override assignments for PPM001
UPDATE public.student_mentor_assignments
SET is_active = false,
    ended_at = COALESCE(ended_at, timezone('utc'::text, now())),
    updated_at = timezone('utc'::text, now())
WHERE mentor_id IN (
  SELECT id FROM public.profiles
  WHERE poraplan_id = 'PPM001'
    AND email = 'mentor.ppm001@poraplan.internal'
)
AND (is_active = true OR ended_at IS NULL);

-- 5. Deactivate any active pairings in legacy mentor_students table for PPM001
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mentor_students'
  ) THEN
    UPDATE public.mentor_students
    SET status = 'suspended'
    WHERE mentor_id IN (
      SELECT id FROM public.profiles
      WHERE poraplan_id = 'PPM001'
        AND email = 'mentor.ppm001@poraplan.internal'
    )
    AND status = 'active';
  END IF;
END $$;

COMMENT ON TABLE public.profiles IS
'User profiles with strict role-based access. Legacy test accounts (PP001, PPM001, PPA001) are permanently suspended.';
