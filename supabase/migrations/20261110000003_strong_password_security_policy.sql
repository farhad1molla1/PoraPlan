-- ==============================================================================
-- Migration: 20261110000003_strong_password_security_policy.sql
-- Description: Enforce consistent server-side strong password security policy
-- Author: PoraPlan Security Team
--
-- Security Objectives:
-- 1. Create public.validate_password_policy(p_password TEXT):
--    - Enforces minimum 8 Unicode characters (12-16+ recommended in UI).
--    - Enforces maximum 72 characters.
--    - Enforces maximum 72 UTF-8 bytes to strictly prevent bcrypt silent truncation.
--    - Ensures Unicode passwords (e.g. Bengali) and passphrases with spaces are
--      fully supported without character corruption or truncation.
--    - Rejects whitespace-only passwords.
--    - Rejects all-identical character repetitions (e.g. 'aaaaaaaa', '11111111').
--    - Rejects known common, predictable, and weak passwords.
--
-- 2. Upgrade public.admin_register_member():
--    - Replaces outdated 6-character length check with validate_password_policy().
--    - Prevents direct RPC bypass of password security rules.
--    - Preserves administrator/service_role authorization, role validation,
--      identity metadata, and profile triggering.
--
-- 3. Upgrade public.admin_reset_member_password():
--    - Replaces outdated 6-character length check with validate_password_policy().
--    - Prevents direct RPC bypass of password security rules.
--    - Preserves status reset to 'not_activated' and administrator authorization.
--
-- Note on Hosted Leaked-Password Protection:
-- Real-time protection against compromised passwords across billions of breached
-- records is powered by Supabase Auth (GoTrue HIBP integration).
-- Operators can verify or enable this in the Supabase Dashboard under:
-- Authentication > Attack Protection > Prevent use of leaked passwords.
-- ==============================================================================

-- 1. SERVER-SIDE PASSWORD POLICY VALIDATOR
CREATE OR REPLACE FUNCTION public.validate_password_policy(p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_char_len INT;
  v_byte_len INT;
  v_lower TEXT;
BEGIN
  IF p_password IS NULL OR length(p_password) = 0 THEN
    RAISE EXCEPTION 'Password cannot be empty.';
  END IF;

  IF TRIM(p_password) = '' THEN
    RAISE EXCEPTION 'Password cannot consist entirely of whitespace.';
  END IF;

  v_char_len := length(p_password);
  v_byte_len := octet_length(p_password);

  IF v_char_len < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters in length.';
  END IF;

  IF v_char_len > 72 THEN
    RAISE EXCEPTION 'Password must not exceed 72 characters.';
  END IF;

  -- Bcrypt silent truncation boundary enforcement
  IF v_byte_len > 72 THEN
    RAISE EXCEPTION 'Password must not exceed 72 bytes in UTF-8 encoding.';
  END IF;

  -- Rejection of trivial repeated characters (e.g. 'aaaaaaaa', '11111111')
  IF p_password ~ '^(.)\1+$' THEN
    RAISE EXCEPTION 'Password is too simple. Please choose a more varied password.';
  END IF;

  -- Rejection of common, predictable, and guessable passwords
  v_lower := lower(trim(p_password));
  IF v_lower = ANY(ARRAY[
    'password',
    'password123',
    'password1234',
    '12345678',
    '123456789',
    '1234567890',
    'admin123',
    'admin1234',
    'administrator',
    'qwerty123',
    'qwertyuiop',
    'passphrase',
    'letmein123',
    'changeme',
    'changeme123',
    'welcome123',
    'welcome1',
    'poraplan123',
    'poraplan2026',
    'poraplan',
    'student123',
    'mentor123',
    'iloveyou',
    'sunshine',
    'master123',
    'secret123'
  ]) THEN
    RAISE EXCEPTION 'This password is too common or easily guessable. Please choose a more secure password.';
  END IF;
END;
$$;

ALTER FUNCTION public.validate_password_policy(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_password_policy(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_password_policy(TEXT) TO authenticated, service_role;

COMMENT ON FUNCTION public.validate_password_policy(TEXT) IS
'Enforces server-side password security: minimum 8 characters, maximum 72 bytes (bcrypt compatibility), whitespace check, and common weak password rejection.';


-- 2. UPGRADE ADMIN REGISTER MEMBER RPC WITH PASSWORD POLICY
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

  -- 4. Validate initial password using consistent server-side policy
  PERFORM public.validate_password_policy(p_initial_password);
  v_clean_password := p_initial_password;

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


-- 3. UPGRADE ADMIN RESET MEMBER PASSWORD RPC WITH PASSWORD POLICY
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

  -- Validate new password using consistent server-side policy
  PERFORM public.validate_password_policy(p_new_password);
  v_clean_password := p_new_password;

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
