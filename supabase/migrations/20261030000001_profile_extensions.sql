-- ==============================================================================
-- PoraPlan Milestone 1: Profile & Identity System Extensions
-- 
-- Adds:
-- 1. Academic & contact details to public.profiles:
--    - whatsapp_number
--    - university, department, batch, current_semester (student)
--    - academic_background, expertise, mentoring_subjects (mentor)
--    - bio (general/shared)
-- 2. Avatar storage bucket & storage RLS policies.
-- 3. Hardened profile fields protection trigger (role, poraplan_id, status).
-- ==============================================================================

-- 1. ADD NULLABLE EXTENSION COLUMNS TO PROFILES
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
  ADD COLUMN IF NOT EXISTS university TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS batch TEXT,
  ADD COLUMN IF NOT EXISTS current_semester TEXT,
  ADD COLUMN IF NOT EXISTS academic_background TEXT,
  ADD COLUMN IF NOT EXISTS expertise TEXT,
  ADD COLUMN IF NOT EXISTS mentoring_subjects TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT;

-- Comments explaining usage
COMMENT ON COLUMN public.profiles.whatsapp_number IS 'Primary WhatsApp contact number for operational and academic communication';
COMMENT ON COLUMN public.profiles.university IS 'Student enrolled university or institution';
COMMENT ON COLUMN public.profiles.department IS 'Academic department / major';
COMMENT ON COLUMN public.profiles.batch IS 'Academic batch / graduation year';
COMMENT ON COLUMN public.profiles.current_semester IS 'Current study semester or academic term';
COMMENT ON COLUMN public.profiles.academic_background IS 'Mentor educational background and credentials';
COMMENT ON COLUMN public.profiles.expertise IS 'Mentor primary subject matter domains';
COMMENT ON COLUMN public.profiles.mentoring_subjects IS 'Subjects or areas the mentor guides';
COMMENT ON COLUMN public.profiles.bio IS 'Short academic biography or study goals';

-- 2. HARDEN FIELD PROTECTION TRIGGER
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Determine the calling user's current role
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- If role is changing, only an existing admin may perform this change
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF caller_role IS NULL OR caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Account role cannot be modified.';
    END IF;
  END IF;

  -- If poraplan_id is changing, only an existing admin may perform this change
  IF NEW.poraplan_id IS DISTINCT FROM OLD.poraplan_id THEN
    IF caller_role IS NULL OR caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: PoraPlan ID is permanent and cannot be modified.';
    END IF;
  END IF;

  -- If status is changing, only an existing admin may perform this change
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF caller_role IS NULL OR caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Account status cannot be modified.';
    END IF;
  END IF;

  -- Automatically update updated_at timestamp
  NEW.updated_at := timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- 3. ENSURE AVATARS STORAGE BUCKET EXISTS WITH RLS
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access for avatars
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
CREATE POLICY "Public avatars are viewable by everyone"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated upload access scoped to user ID folder
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated update access scoped to user ID folder
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Authenticated delete access scoped to user ID folder
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
