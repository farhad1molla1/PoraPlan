-- ==============================================================================
-- PoraPlan Milestone 4: Controlled PoraPlan Account Model & ID-Based Authentication
-- Schema Updates:
-- 1. Add poraplan_id, status, linked_email to public.profiles
-- 2. Secure RPC for PoraPlan ID login lookup
-- 3. Secure RPC for Google account linkage verification
-- 4. Controlled handle_new_user trigger preventing arbitrary self-registration
-- ==============================================================================

-- 1. ADD CONTROLLED ACCOUNT COLUMNS TO PROFILES
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS poraplan_id TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('not_activated', 'active', 'suspended')),
  ADD COLUMN IF NOT EXISTS linked_email TEXT;

-- 2. CREATE UNIQUE & PERFORMANCE INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_poraplan_id_unique
  ON public.profiles (LOWER(TRIM(poraplan_id)))
  WHERE poraplan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_linked_email
  ON public.profiles (LOWER(TRIM(linked_email)))
  WHERE linked_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_status
  ON public.profiles (status);

-- 3. SECURE RESOLVER FOR PORAPLAN ID LOGIN
-- Allows anon users on the login page to securely resolve the auth email and status
-- corresponding to a pre-registered PoraPlan ID (e.g. PP001, PPM001)
CREATE OR REPLACE FUNCTION public.resolve_poraplan_id_login(p_poraplan_id TEXT)
RETURNS TABLE (
  auth_email TEXT,
  account_status TEXT,
  account_role user_role,
  resolved_poraplan_id TEXT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.email AS auth_email,
    p.status AS account_status,
    p.role AS account_role,
    p.poraplan_id AS resolved_poraplan_id
  FROM public.profiles p
  WHERE LOWER(TRIM(p.poraplan_id)) = LOWER(TRIM(p_poraplan_id))
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) TO anon, authenticated;

-- 4. SECURE VERIFIER FOR LINKED GOOGLE ACCOUNTS
-- Checks whether a Google email is linked to an existing pre-registered PoraPlan member
CREATE OR REPLACE FUNCTION public.check_google_account_linked(p_email TEXT)
RETURNS TABLE (
  is_linked BOOLEAN,
  resolved_poraplan_id TEXT,
  account_role user_role,
  account_status TEXT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TRUE AS is_linked,
    p.poraplan_id AS resolved_poraplan_id,
    p.role AS account_role,
    p.status AS account_status
  FROM public.profiles p
  WHERE (
    LOWER(TRIM(p.linked_email)) = LOWER(TRIM(p_email))
    OR LOWER(TRIM(p.email)) = LOWER(TRIM(p_email))
  )
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_google_account_linked(TEXT) TO anon, authenticated;

-- 5. FUNCTION TO CONNECT / LINK PERSONAL EMAIL AFTER FIRST ACTIVATION
CREATE OR REPLACE FUNCTION public.connect_personal_email(p_user_id UUID, p_email TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify calling user matches target user or is admin
  IF auth.uid() != p_user_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE public.profiles
  SET linked_email = LOWER(TRIM(p_email)),
      status = 'active',
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.connect_personal_email(UUID, TEXT) TO authenticated;

-- 6. CONTROLLED TRIGGER PREVENTING ARBITRARY PUBLIC SELF-REGISTRATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  existing_profile RECORD;
BEGIN
  -- Check if this email was already registered or pre-registered in profiles
  SELECT * INTO existing_profile
  FROM public.profiles
  WHERE LOWER(TRIM(linked_email)) = LOWER(TRIM(NEW.email))
     OR LOWER(TRIM(email)) = LOWER(TRIM(NEW.email))
  LIMIT 1;

  IF existing_profile.id IS NOT NULL THEN
    -- Link existing profile to auth user ID
    UPDATE public.profiles
    SET id = NEW.id,
        updated_at = timezone('utc'::text, now())
    WHERE poraplan_id = existing_profile.poraplan_id;
    RETURN NEW;
  END IF;

  -- If no pre-registered profile exists for this identity,
  -- do NOT create an active profile. Unlinked sessions will be rejected by the frontend.
  RETURN NEW;
END;
$$;
