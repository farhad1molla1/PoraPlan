-- ==============================================================================
-- PoraPlan Milestone 5: Database-Level Role Protection & Security Hardening
-- Enforces:
-- 1. Students and Mentors CANNOT change their own role or promote themselves.
-- 2. PoraPlan ID is immutable once assigned (only admins can modify).
-- 3. Strict trigger-based enforcement running with SECURITY DEFINER.
-- 4. RLS policies preventing unauthorized profile updates.
-- ==============================================================================

-- 1. BEFORE UPDATE TRIGGER TO PREVENT UNAUTHORIZED ROLE OR ID ALTERATION
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

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();

-- 2. STRICT RLS UPDATE POLICY ON PROFILES
-- Ensures users can only update their own row and cannot tamper with role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- If user is not admin, role must remain identical to existing role
    AND (
      role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
      OR (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'admin'
    )
  );

-- 3. ADMIN-ONLY RPC TO PRE-REGISTER NEW MEMBERS SAFELY
CREATE OR REPLACE FUNCTION public.admin_register_member(
  p_poraplan_id TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role user_role DEFAULT 'student',
  p_status TEXT DEFAULT 'not_activated'
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  caller_role user_role;
  clean_id TEXT;
BEGIN
  -- Check caller is admin
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can pre-register members.';
  END IF;

  clean_id := UPPER(TRIM(p_poraplan_id));

  -- Check if poraplan_id already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE UPPER(poraplan_id) = clean_id) THEN
    RETURN QUERY SELECT FALSE, 'PoraPlan ID ' || clean_id || ' already exists.';
    RETURN;
  END IF;

  -- Insert profile placeholder
  INSERT INTO public.profiles (
    id,
    poraplan_id,
    full_name,
    email,
    role,
    status,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    clean_id,
    TRIM(p_full_name),
    LOWER(TRIM(p_email)),
    p_role,
    p_status,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  RETURN QUERY SELECT TRUE, 'Member ' || clean_id || ' successfully pre-registered.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT) TO authenticated;
