-- ==============================================================================
-- PoraPlan Milestone 6: Provision Controlled Test Accounts & Account Provisioning
-- Provides:
-- 1. Standard test accounts for end-to-end authentication readiness:
--    - Student: PP001 / password (student.pp001@poraplan.internal)
--    - Mentor:  PPM001 / password (mentor.ppm001@poraplan.internal)
--    - Admin:   PPA001 / password (admin.ppa001@poraplan.internal)
-- 2. Paired relationship in public.mentor_students for PPM001 -> PP001
-- 3. Secure administrative procedure: public.provision_poraplan_account
-- ==============================================================================

-- 1. ENSURE CRYPTO EXTENSION IS AVAILABLE
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. SECURE FUNCTION TO PROVISION ACCOUNTS INTO AUTH.USERS AND PUBLIC.PROFILES
CREATE OR REPLACE FUNCTION public.provision_poraplan_account(
  p_poraplan_id TEXT,
  p_full_name TEXT,
  p_email TEXT,
  p_role user_role,
  p_password TEXT DEFAULT 'password'
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth, extensions
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_clean_id TEXT;
  v_clean_email TEXT;
  v_encrypted_pw TEXT;
BEGIN
  v_clean_id := UPPER(TRIM(p_poraplan_id));
  v_clean_email := LOWER(TRIM(p_email));
  v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));

  -- Check if user already exists in auth.users by email
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_clean_email;

  IF v_user_id IS NULL THEN
    -- Generate new user id
    v_user_id := gen_random_uuid();

    -- Insert into auth.users with confirmed email and encrypted password
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
      v_user_id,
      'authenticated',
      'authenticated',
      v_clean_email,
      v_encrypted_pw,
      timezone('utc'::text, now()),
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object(
        'full_name', p_full_name,
        'poraplan_id', v_clean_id,
        'role', p_role
      )::jsonb,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    );
  ELSE
    -- Update existing user credentials
    UPDATE auth.users
    SET encrypted_password = v_encrypted_pw,
        email_confirmed_at = COALESCE(email_confirmed_at, timezone('utc'::text, now())),
        raw_user_meta_data = json_build_object(
          'full_name', p_full_name,
          'poraplan_id', v_clean_id,
          'role', p_role
        )::jsonb,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_user_id;
  END IF;

  -- Upsert profile record in public.profiles
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
    v_user_id,
    v_clean_id,
    p_full_name,
    v_clean_email,
    p_role,
    'active',
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE SET
    poraplan_id = v_clean_id,
    full_name = p_full_name,
    email = v_clean_email,
    role = p_role,
    status = 'active',
    updated_at = timezone('utc'::text, now());

  RETURN v_user_id;
END;
$$;

-- 3. PROVISION STANDARD TEST ACCOUNTS (Student PP001, Mentor PPM001, Admin PPA001)
DO $$
DECLARE
  v_student_id UUID;
  v_mentor_id UUID;
  v_admin_id UUID;
BEGIN
  -- Provision Student PP001
  v_student_id := public.provision_poraplan_account(
    'PP001',
    'Fahim Rahman',
    'student.pp001@poraplan.internal',
    'student',
    'password'
  );

  -- Provision Mentor PPM001
  v_mentor_id := public.provision_poraplan_account(
    'PPM001',
    'Dr. Rafiqul Islam',
    'mentor.ppm001@poraplan.internal',
    'mentor',
    'password'
  );

  -- Provision Admin PPA001
  v_admin_id := public.provision_poraplan_account(
    'PPA001',
    'PoraPlan System Admin',
    'admin.ppa001@poraplan.internal',
    'admin',
    'password'
  );

  -- Pair Mentor PPM001 with Student PP001
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mentor_students') THEN
    INSERT INTO public.mentor_students (
      mentor_id,
      student_id,
      status
    ) VALUES (
      v_mentor_id,
      v_student_id,
      'active'
    )
    ON CONFLICT (mentor_id, student_id) DO NOTHING;
  END IF;
END;
$$;
