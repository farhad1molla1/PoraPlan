-- ==============================================================================
-- PoraPlan Milestone 5.3.2: Migration 009
-- Security Remediation & Auth Integrity
--
-- File: supabase/migrations/20261030000009_security_remediation_and_auth_integrity.sql
-- Sequential target: Applies after 20261030000008_security_integrity_and_rls_corrections.sql
--
-- Remediations implemented:
-- 1. Profile Integrity: Add contact_email to public.profiles; ensure no PK mutation.
-- 2. Trusted handle_new_user(): Model 1 trigger-driven profile creation.
--    - Reads strictly from raw_app_meta_data for poraplan_id, role, status.
--    - Ignores client-supplied authorization in raw_user_meta_data.
--    - Rejects unauthorized public self-registration without trusted metadata.
--    - Rejects duplicate PoraPlan IDs (aborting auth.users insert).
-- 3. Corrected admin_register_member():
--    - Requires explicit initial password (length >= 6).
--    - Generates synthetic auth email: <normalized_id>@auth.poraplan.internal.
--    - Inserts into auth.users with encrypted password & trusted app_metadata.
--    - Lets handle_new_user() create the single profile row.
-- 4. Added admin_reset_member_password():
--    - Admin-only credential reset utility.
--    - Resets target status to 'not_activated'.
-- 5. Hardened resolve_poraplan_id_login():
--    - Removes account_role from return signature to prevent role enumeration.
--    - Resolves stored profile email dynamically (preserving existing accounts).
-- 6. Hardened connect_personal_email() & check_google_account_linked().
-- 7. linked_email Integrity: Precheck for collisions + partial unique index.
-- 8. Hardened protect_profile_fields():
--    - Allows legitimate first-time user activation (not_activated -> active).
--    - Blocks all other unauthorized status, role, or ID modifications.
-- 9. Complete SECURITY DEFINER hardening with safe search_path and explicit grants.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILE INTEGRITY & EXTENSION
-- ------------------------------------------------------------------------------

-- Ensure pgcrypto is available in extensions schema for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Add contact_email column to public.profiles if not present
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

COMMENT ON COLUMN public.profiles.contact_email IS
  'Personal contact and recovery email address. Unverified until confirmed by member.';


-- ------------------------------------------------------------------------------
-- 2. LINKED_EMAIL INTEGRITY & PARTIAL UNIQUE INDEX
-- ------------------------------------------------------------------------------

-- Validate existing data cleanliness before creating unique index
DO $$
DECLARE
  v_dup_email TEXT;
  v_dup_count INT;
BEGIN
  -- Check for duplicate non-empty linked_email values
  SELECT LOWER(TRIM(linked_email)), COUNT(*)
  INTO v_dup_email, v_dup_count
  FROM public.profiles
  WHERE linked_email IS NOT NULL AND TRIM(linked_email) <> ''
  GROUP BY LOWER(TRIM(linked_email))
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_dup_email IS NOT NULL THEN
    RAISE EXCEPTION 'Pre-migration check failed: duplicate linked_email "%" found in % rows.', v_dup_email, v_dup_count;
  END IF;

  -- Check for collision between linked_email and another user''s primary auth email
  SELECT p1.linked_email
  INTO v_dup_email
  FROM public.profiles p1
  JOIN public.profiles p2 ON LOWER(TRIM(p1.linked_email)) = LOWER(TRIM(p2.email)) AND p1.id <> p2.id
  WHERE p1.linked_email IS NOT NULL AND TRIM(p1.linked_email) <> ''
  LIMIT 1;

  IF v_dup_email IS NOT NULL THEN
    RAISE EXCEPTION 'Pre-migration check failed: collision between linked_email "%" and existing profiles.email.', v_dup_email;
  END IF;
END $$;

-- Drop legacy non-unique index if it exists
DROP INDEX IF EXISTS public.idx_profiles_linked_email;

-- Create case-insensitive partial unique index on non-empty linked_email
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_linked_email_unique
  ON public.profiles (LOWER(TRIM(linked_email)))
  WHERE linked_email IS NOT NULL AND TRIM(linked_email) <> '';


-- ------------------------------------------------------------------------------
-- 3. TRUSTED TRIGGER FUNCTION: handle_new_user()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_poraplan_id TEXT;
  v_raw_role TEXT;
  v_assigned_role user_role;
  v_raw_status TEXT;
  v_assigned_status TEXT;
  v_full_name TEXT;
  v_contact_email TEXT;
BEGIN
  -- 1. Read privileged identity metadata STRICTLY from raw_app_meta_data.
  -- raw_user_meta_data is client-writable in GoTrue and MUST NOT be trusted.
  v_poraplan_id := NULLIF(UPPER(TRIM(COALESCE(NEW.raw_app_meta_data->>'poraplan_id', ''))), '');

  -- 2. Reject unprovisioned self-registrations and unsolicited OAuth creations.
  -- PoraPlan uses a closed institutional pre-registration model.
  IF v_poraplan_id IS NULL THEN
    RAISE EXCEPTION 'Registration rejected: direct public self-registration is disabled. All PoraPlan accounts must be pre-registered by a platform administrator.';
  END IF;

  -- 3. Validate PoraPlan ID uniqueness against public.profiles.
  -- Trigger abort rolls back the entire auth.users insert transaction.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(TRIM(poraplan_id)) = LOWER(v_poraplan_id)
  ) THEN
    RAISE EXCEPTION 'Registration rejected: PoraPlan ID "%" is already assigned to an existing profile.', v_poraplan_id;
  END IF;

  -- 4. Parse and validate role from trusted raw_app_meta_data.
  v_raw_role := LOWER(TRIM(COALESCE(NEW.raw_app_meta_data->>'role', 'student')));
  IF v_raw_role = 'mentor' THEN
    v_assigned_role := 'mentor'::user_role;
  ELSIF v_raw_role = 'admin' THEN
    v_assigned_role := 'admin'::user_role;
  ELSIF v_raw_role = 'student' THEN
    v_assigned_role := 'student'::user_role;
  ELSE
    RAISE EXCEPTION 'Registration rejected: invalid account role "%" in trusted app metadata.', v_raw_role;
  END IF;

  -- 5. Parse and validate status from trusted raw_app_meta_data.
  v_raw_status := LOWER(TRIM(COALESCE(NEW.raw_app_meta_data->>'status', 'not_activated')));
  IF v_raw_status NOT IN ('not_activated', 'active', 'suspended') THEN
    RAISE EXCEPTION 'Registration rejected: invalid account status "%" in trusted app metadata.', v_raw_status;
  END IF;
  v_assigned_status := v_raw_status;

  -- 6. Read non-authoritative profile details from raw_user_meta_data.
  v_full_name := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), 'Student User');
  v_contact_email := NULLIF(LOWER(TRIM(NEW.raw_user_meta_data->>'contact_email')), '');

  -- 7. Insert the single authoritative profile record linked to NEW.id.
  -- Never mutate existing profile primary keys.
  INSERT INTO public.profiles (
    id,
    poraplan_id,
    full_name,
    email,
    role,
    status,
    contact_email,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    v_poraplan_id,
    v_full_name,
    NEW.email,
    v_assigned_role,
    v_assigned_status,
    v_contact_email,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------------------------------------------
-- 4. HARDENED PROFILE FIELD PROTECTION TRIGGER
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  caller_role user_role;
BEGIN
  -- Determine the calling user's current role
  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Role alteration: only platform administrators or service_role
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT (
      caller_role = 'admin'
      OR (auth.jwt()->>'role') = 'service_role'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Account role cannot be modified.';
    END IF;
  END IF;

  -- PoraPlan ID alteration: permanent and immutable unless admin or service_role
  IF NEW.poraplan_id IS DISTINCT FROM OLD.poraplan_id THEN
    IF NOT (
      caller_role = 'admin'
      OR (auth.jwt()->>'role') = 'service_role'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: PoraPlan ID is permanent and cannot be modified.';
    END IF;
  END IF;

  -- Status alteration:
  -- Allowed for:
  -- 1. Administrators or service_role
  -- 2. First-time account activation: member transitioning own account from 'not_activated' to 'active'
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      caller_role = 'admin'
      OR (auth.jwt()->>'role') = 'service_role'
      OR (OLD.status = 'not_activated' AND NEW.status = 'active' AND auth.uid() = NEW.id)
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Account status cannot be modified.';
    END IF;
  END IF;

  -- Automatically update updated_at timestamp
  NEW.updated_at := timezone('utc'::text, now());

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.protect_profile_fields() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.protect_profile_fields() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.protect_profile_fields() TO authenticated, service_role;

DROP TRIGGER IF EXISTS tr_protect_profile_fields ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_fields();


-- ------------------------------------------------------------------------------
-- 5. ADMIN MEMBER PRE-REGISTRATION RPC: admin_register_member()
-- ------------------------------------------------------------------------------

-- Drop previous overloaded signatures to avoid confusion
DROP FUNCTION IF EXISTS public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT);
DROP FUNCTION IF EXISTS public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.admin_register_member(
  p_poraplan_id TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role user_role DEFAULT 'student',
  p_status TEXT DEFAULT 'not_activated',
  p_initial_password TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  user_id UUID,
  poraplan_id TEXT
)
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  caller_role user_role;
  v_clean_id TEXT;
  v_norm_id TEXT;
  v_auth_email TEXT;
  v_clean_contact_email TEXT;
  v_clean_password TEXT;
  v_encrypted_pw TEXT;
  v_new_user_id UUID;
BEGIN
  -- 1. Authorization check: caller must be admin or service_role
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role IS NULL OR caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can pre-register members.';
    END IF;
  END IF;

  -- 2. Validate and normalize PoraPlan ID
  v_clean_id := UPPER(TRIM(p_poraplan_id));
  IF v_clean_id IS NULL OR v_clean_id = '' THEN
    RAISE EXCEPTION 'PoraPlan ID cannot be empty.';
  END IF;

  IF v_clean_id !~ '^[A-Z0-9_-]{3,20}$' THEN
    RAISE EXCEPTION 'Invalid PoraPlan ID format. Must be 3 to 20 alphanumeric characters (e.g. PP002, PPM002, PPA002).';
  END IF;

  -- 3. Validate full name
  IF p_full_name IS NULL OR TRIM(p_full_name) = '' THEN
    RAISE EXCEPTION 'Full name cannot be empty.';
  END IF;

  -- 4. Validate initial password (explicit credential requirement)
  v_clean_password := TRIM(COALESCE(p_initial_password, ''));
  IF v_clean_password = '' OR length(v_clean_password) < 6 THEN
    RAISE EXCEPTION 'An initial password of at least 6 characters must be provided.';
  END IF;

  -- 5. Validate contact email format if provided
  v_clean_contact_email := NULLIF(LOWER(TRIM(p_email)), '');
  IF v_clean_contact_email IS NOT NULL THEN
    IF v_clean_contact_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid contact email format: %', p_email;
    END IF;
  END IF;

  -- 6. Construct canonical synthetic authentication email
  v_norm_id := LOWER(v_clean_id);
  v_auth_email := v_norm_id || '@auth.poraplan.internal';

  -- 7. Conflict detection
  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(TRIM(poraplan_id)) = v_norm_id) THEN
    RAISE EXCEPTION 'PoraPlan ID "%" is already registered.', v_clean_id;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(TRIM(email)) = v_auth_email) THEN
    RAISE EXCEPTION 'Synthetic authentication email "%" already exists in auth.users.', v_auth_email;
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(TRIM(email)) = v_auth_email) THEN
    RAISE EXCEPTION 'Synthetic authentication email "%" already exists in profiles.', v_auth_email;
  END IF;

  -- 8. Generate credentials and UUID
  v_new_user_id := gen_random_uuid();
  v_encrypted_pw := extensions.crypt(v_clean_password, extensions.gen_salt('bf'));

  -- 9. Insert directly into auth.users.
  -- Trusted app metadata triggers handle_new_user() which creates public.profiles.
  -- Note on auth.identities: GoTrue v2.122.0 handles email identities natively;
  -- manual SQL insertion into auth.identities is omitted to avoid generated column conflicts.
  -- Local runtime verification in Milestone 5.3.2 will validate sign-in behavior.
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_new_user_id,
    'authenticated',
    'authenticated',
    v_auth_email,
    v_encrypted_pw,
    timezone('utc'::text, now()),
    jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email'),
      'poraplan_id', v_clean_id,
      'role', p_role,
      'status', 'not_activated'
    ),
    jsonb_build_object(
      'full_name', TRIM(p_full_name),
      'contact_email', v_clean_contact_email
    ),
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  );

  -- Return success confirmation without echoing plaintext password
  RETURN QUERY SELECT
    TRUE AS success,
    'Member ' || v_clean_id || ' successfully pre-registered.' AS message,
    v_new_user_id AS user_id,
    v_clean_id AS poraplan_id;
END;
$$;

ALTER FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 6. ADMIN PASSWORD RESET RPC: admin_reset_member_password()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_reset_member_password(
  p_poraplan_id TEXT,
  p_new_password TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT
)
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  caller_role user_role;
  v_clean_id TEXT;
  v_clean_password TEXT;
  target_user_id UUID;
  auth_user_id UUID;
  v_encrypted_pw TEXT;
BEGIN
  -- 1. Authorization check: caller must be admin or service_role
  IF (auth.jwt()->>'role') IS DISTINCT FROM 'service_role' THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role IS NULL OR caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Only platform administrators can reset member passwords.';
    END IF;
  END IF;

  -- 2. Validate inputs
  v_clean_id := UPPER(TRIM(p_poraplan_id));
  IF v_clean_id IS NULL OR v_clean_id = '' THEN
    RAISE EXCEPTION 'PoraPlan ID cannot be empty.';
  END IF;

  v_clean_password := TRIM(COALESCE(p_new_password, ''));
  IF v_clean_password = '' OR length(v_clean_password) < 6 THEN
    RAISE EXCEPTION 'New password must be at least 6 characters long.';
  END IF;

  -- 3. Confirm target profile exists
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE LOWER(TRIM(poraplan_id)) = LOWER(v_clean_id);

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Member with PoraPlan ID "%" not found.', v_clean_id;
  END IF;

  -- 4. Confirm corresponding auth.users record exists
  SELECT id INTO auth_user_id
  FROM auth.users
  WHERE id = target_user_id;

  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication record for member "%" (UUID %) does not exist.', v_clean_id, target_user_id;
  END IF;

  -- 5. Encrypt new password using bcrypt
  v_encrypted_pw := extensions.crypt(v_clean_password, extensions.gen_salt('bf'));

  -- 6. Update auth.users password
  UPDATE auth.users
  SET encrypted_password = v_encrypted_pw,
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  -- 7. Reset profile status to not_activated
  UPDATE public.profiles
  SET status = 'not_activated',
      updated_at = timezone('utc'::text, now())
  WHERE id = target_user_id;

  -- Return success without exposing cleartext credentials
  RETURN QUERY SELECT
    TRUE AS success,
    'Password for member ' || v_clean_id || ' successfully reset. Status set to not_activated.' AS message;
END;
$$;

ALTER FUNCTION public.admin_reset_member_password(TEXT, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.admin_reset_member_password(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_member_password(TEXT, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 7. HARDENED LOGIN RESOLVER: resolve_poraplan_id_login()
-- ------------------------------------------------------------------------------

-- Drop previous signature returning account_role
DROP FUNCTION IF EXISTS public.resolve_poraplan_id_login(TEXT);

CREATE OR REPLACE FUNCTION public.resolve_poraplan_id_login(p_poraplan_id TEXT)
RETURNS TABLE (
  auth_email TEXT,
  account_status TEXT,
  resolved_poraplan_id TEXT
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.email AS auth_email,
    p.status AS account_status,
    p.poraplan_id AS resolved_poraplan_id
  FROM public.profiles p
  WHERE LOWER(TRIM(p.poraplan_id)) = LOWER(TRIM(p_poraplan_id))
  LIMIT 1;
END;
$$;

ALTER FUNCTION public.resolve_poraplan_id_login(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 8. HARDENED CONNECT PERSONAL EMAIL: connect_personal_email()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.connect_personal_email(p_user_id UUID, p_email TEXT)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public, auth, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_clean_email TEXT;
  caller_role user_role;
BEGIN
  -- Verify calling user matches target user or is admin
  IF auth.uid() != p_user_id THEN
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    IF caller_role IS NULL OR caller_role != 'admin' THEN
      RAISE EXCEPTION 'Unauthorized: Cannot link personal email for another user.';
    END IF;
  END IF;

  v_clean_email := LOWER(TRIM(p_email));
  IF v_clean_email IS NULL OR v_clean_email = '' THEN
    RAISE EXCEPTION 'Email cannot be empty.';
  END IF;

  -- Validate format
  IF v_clean_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email address format: %', p_email;
  END IF;

  -- Collision checks
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(TRIM(linked_email)) = v_clean_email AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'This email is already connected to another PoraPlan account.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE LOWER(TRIM(email)) = v_clean_email AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'This email is already in use by another PoraPlan account.';
  END IF;

  -- Update linked_email without altering account status
  UPDATE public.profiles
  SET linked_email = v_clean_email,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.connect_personal_email(UUID, TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.connect_personal_email(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.connect_personal_email(UUID, TEXT) TO authenticated, service_role;


-- ------------------------------------------------------------------------------
-- 9. HARDENED GOOGLE LINKAGE VERIFIER: check_google_account_linked()
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_google_account_linked(p_email TEXT)
RETURNS TABLE (
  is_linked BOOLEAN,
  resolved_poraplan_id TEXT,
  account_role user_role,
  account_status TEXT
)
SECURITY DEFINER
SET search_path = public, auth, pg_temp
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
  AND (p.linked_email IS NOT NULL AND TRIM(p.linked_email) <> '')
  LIMIT 1;
END;
$$;

ALTER FUNCTION public.check_google_account_linked(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.check_google_account_linked(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_google_account_linked(TEXT) TO authenticated, service_role;

