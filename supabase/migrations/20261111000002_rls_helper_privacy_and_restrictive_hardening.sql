-- ==============================================================================
-- Migration: 20261111000002_rls_helper_privacy_and_restrictive_hardening.sql
-- Phase: 2.3B.4.5.1 RLS Helper Privacy, Account Status Semantics & Restrictive Policy Verification
-- 
-- Description:
-- 1. Helper Function Privacy & Anti-Probing:
--    - Replaces public.is_active_student_profile(UUID) with strict caller identity enforcement
--      (p_user_id must equal auth.uid() unless called by service_role).
--    - Revokes execute from anon and PUBLIC; grants strictly to authenticated and service_role.
--    - Introduces parameterless public.is_active_student() and public.is_active_student_or_non_student().
-- 2. Exact Account Status Semantics:
--    - Enforces exact status = 'active' for student data access.
--    - Fails safely (DENIED) on 'suspended', 'not_activated', NULL, or any unknown status.
-- 3. Restrictive Policy Reliability & Command Coverage:
--    - Replaces direct public.profiles queries with SECURITY DEFINER helper public.is_active_student_or_non_student().
--    - Eliminates RLS recursion and dependency on caller profiles visibility.
--    - Enforces AS RESTRICTIVE policies with both USING and WITH CHECK across all 12 student tables
--      covering SELECT, INSERT, UPDATE, and DELETE.
-- ==============================================================================

-- ==============================================================================
-- 1. HELPER FUNCTIONS: PRIVACY, CALLER IDENTITY & EXACT STATUS SEMANTICS
-- ==============================================================================

-- A. Parameterless helper verifying current authenticated user is an active student
CREATE OR REPLACE FUNCTION public.is_active_student()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
      AND role = 'student'
      AND status = 'active'
  );
END;
$$;

ALTER FUNCTION public.is_active_student() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_active_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_student() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_student() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_active_student() IS
'RLS security helper verifying current caller (auth.uid()) is an active student (role = student, status = active). Zero parameters to eliminate arbitrary-user probing.';


-- B. Backward-compatible helper with caller-identity enforcement against arbitrary probing
CREATE OR REPLACE FUNCTION public.is_active_student_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Anti-probing: authenticated callers cannot probe arbitrary user IDs
  IF auth.role() IS DISTINCT FROM 'service_role' AND (v_uid IS NULL OR p_user_id != v_uid) THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND role = 'student'
      AND status = 'active'
  );
END;
$$;

ALTER FUNCTION public.is_active_student_profile(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_active_student_profile(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_student_profile(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_student_profile(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_active_student_profile(UUID) IS
'RLS security helper verifying target user is an active student. Enforces caller identity (p_user_id = auth.uid()) to prevent arbitrary-user status probing.';


-- C. Restrictive policy evaluator: enforces active status for students, permits mentors and admins
CREATE OR REPLACE FUNCTION public.is_active_student_or_non_student()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role user_role;
  v_status TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role, status INTO v_role, v_status
  FROM public.profiles
  WHERE id = v_uid;

  -- If caller has no profile row, deny access
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- If caller is a student, enforce exact 'active' status
  IF v_role = 'student' THEN
    RETURN (v_status = 'active');
  END IF;

  -- Mentors and administrators are not restricted by student account status
  RETURN TRUE;
END;
$$;

ALTER FUNCTION public.is_active_student_or_non_student() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_active_student_or_non_student() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_active_student_or_non_student() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_active_student_or_non_student() TO authenticated, service_role;

COMMENT ON FUNCTION public.is_active_student_or_non_student() IS
'RLS restrictive helper. Evaluates caller role and status directly with SECURITY DEFINER to avoid RLS recursion and caller profile visibility dependency. Returns TRUE for active students and non-students; FALSE for non-active students.';


-- ==============================================================================
-- 2. HARDENED RESTRICTIVE & PERMISSIVE RLS POLICIES ACROSS 12 TABLES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. SUBJECTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Subjects suspended student restrictive" ON public.subjects;
DROP POLICY IF EXISTS "Subjects student access restrictive" ON public.subjects;
CREATE POLICY "Subjects student access restrictive"
  ON public.subjects
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Subjects select policy" ON public.subjects;
CREATE POLICY "Subjects select policy"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Subjects update policy" ON public.subjects;
CREATE POLICY "Subjects update policy"
  ON public.subjects
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- B. STUDY PLANS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Study plans suspended student restrictive" ON public.study_plans;
DROP POLICY IF EXISTS "Study plans student access restrictive" ON public.study_plans;
CREATE POLICY "Study plans student access restrictive"
  ON public.study_plans
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Study plans select policy" ON public.study_plans;
CREATE POLICY "Study plans select policy"
  ON public.study_plans
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Study plans update policy" ON public.study_plans;
CREATE POLICY "Study plans update policy"
  ON public.study_plans
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- C. STUDY PLAN ITEMS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Study plan items suspended student restrictive" ON public.study_plan_items;
DROP POLICY IF EXISTS "Study plan items student access restrictive" ON public.study_plan_items;
CREATE POLICY "Study plan items student access restrictive"
  ON public.study_plan_items
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Study plan items select policy" ON public.study_plan_items;
CREATE POLICY "Study plan items select policy"
  ON public.study_plan_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          (sp.student_id = auth.uid() AND public.is_active_student())
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

DROP POLICY IF EXISTS "Study plan items update policy" ON public.study_plan_items;
CREATE POLICY "Study plan items update policy"
  ON public.study_plan_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          (sp.student_id = auth.uid() AND public.is_active_student())
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          (sp.student_id = auth.uid() AND public.is_active_student())
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

-- ------------------------------------------------------------------------------
-- D. TASKS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Tasks suspended student restrictive" ON public.tasks;
DROP POLICY IF EXISTS "Tasks student access restrictive" ON public.tasks;
CREATE POLICY "Tasks student access restrictive"
  ON public.tasks
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
CREATE POLICY "Tasks update policy"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- E. ASSIGNMENTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Assignments suspended student restrictive" ON public.assignments;
DROP POLICY IF EXISTS "Assignments student access restrictive" ON public.assignments;
CREATE POLICY "Assignments student access restrictive"
  ON public.assignments
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Assignments select policy" ON public.assignments;
CREATE POLICY "Assignments select policy"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- F. SUBMISSIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Submissions suspended student restrictive" ON public.submissions;
DROP POLICY IF EXISTS "Submissions student access restrictive" ON public.submissions;
CREATE POLICY "Submissions student access restrictive"
  ON public.submissions
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Submissions select policy" ON public.submissions;
CREATE POLICY "Submissions select policy"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student())
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  );

DROP POLICY IF EXISTS "Submissions insert policy" ON public.submissions;
CREATE POLICY "Submissions insert policy"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_active_student()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND a.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Submissions update policy" ON public.submissions;
CREATE POLICY "Submissions update policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student())
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  )
  WITH CHECK (
    (student_id = auth.uid() AND public.is_active_student())
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  );

-- ------------------------------------------------------------------------------
-- G. EVALUATIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Evaluations suspended student restrictive" ON public.evaluations;
DROP POLICY IF EXISTS "Evaluations student access restrictive" ON public.evaluations;
CREATE POLICY "Evaluations student access restrictive"
  ON public.evaluations
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Evaluations select policy" ON public.evaluations;
CREATE POLICY "Evaluations select policy"
  ON public.evaluations
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- H. RESOURCES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Resources suspended student restrictive" ON public.resources;
DROP POLICY IF EXISTS "Resources student access restrictive" ON public.resources;
CREATE POLICY "Resources student access restrictive"
  ON public.resources
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Resources select policy" ON public.resources;
CREATE POLICY "Resources select policy"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

-- ------------------------------------------------------------------------------
-- I. DOUBTS & DOUBT RESPONSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Doubts suspended student restrictive" ON public.doubts;
DROP POLICY IF EXISTS "Doubts student access restrictive" ON public.doubts;
CREATE POLICY "Doubts student access restrictive"
  ON public.doubts
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Doubts select policy" ON public.doubts;
CREATE POLICY "Doubts select policy"
  ON public.doubts
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Doubts insert policy" ON public.doubts;
CREATE POLICY "Doubts insert policy"
  ON public.doubts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.is_active_student()
  );

DROP POLICY IF EXISTS "Doubts update policy" ON public.doubts;
CREATE POLICY "Doubts update policy"
  ON public.doubts
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student())
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = student_id
    AND public.is_active_student()
  );

DROP POLICY IF EXISTS "Doubt responses suspended student restrictive" ON public.doubt_responses;
DROP POLICY IF EXISTS "Doubt responses student access restrictive" ON public.doubt_responses;
CREATE POLICY "Doubt responses student access restrictive"
  ON public.doubt_responses
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Doubt responses select policy" ON public.doubt_responses;
CREATE POLICY "Doubt responses select policy"
  ON public.doubt_responses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = public.doubt_responses.doubt_id
        AND (
          (d.student_id = auth.uid() AND public.is_active_student())
          OR public.is_authorized_mentor_for_student(d.student_id, d.program_id)
        )
    )
  );

DROP POLICY IF EXISTS "Doubt responses insert policy" ON public.doubt_responses;
CREATE POLICY "Doubt responses insert policy"
  ON public.doubt_responses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_active_student()
      OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor' AND status != 'suspended'))
      OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
    AND EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = public.doubt_responses.doubt_id
        AND (
          (d.student_id = auth.uid() AND public.is_active_student())
          OR public.is_authorized_mentor_for_student(d.student_id, d.program_id)
        )
    )
  );

-- ------------------------------------------------------------------------------
-- J. ANNOUNCEMENTS & ACKNOWLEDGMENTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Announcements suspended student restrictive" ON public.announcements;
DROP POLICY IF EXISTS "Announcements student access restrictive" ON public.announcements;
CREATE POLICY "Announcements student access restrictive"
  ON public.announcements
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Announcements select policy" ON public.announcements;
CREATE POLICY "Announcements select policy"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      status = 'published'
      AND (
        (target_scope = 'platform' AND public.is_active_student_or_non_student())
        OR (target_scope = 'individual' AND student_id = auth.uid() AND public.is_active_student())
        OR (
          target_scope = 'assigned_students'
          AND public.is_active_student()
          AND public.is_authorized_mentor_for_student(author_id, auth.uid(), program_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Announcement acks suspended student restrictive" ON public.announcement_acknowledgments;
DROP POLICY IF EXISTS "Announcement acks student access restrictive" ON public.announcement_acknowledgments;
CREATE POLICY "Announcement acks student access restrictive"
  ON public.announcement_acknowledgments
  AS RESTRICTIVE
  TO authenticated
  USING (public.is_active_student_or_non_student())
  WITH CHECK (public.is_active_student_or_non_student());

DROP POLICY IF EXISTS "Announcement acknowledgments select policy" ON public.announcement_acknowledgments;
CREATE POLICY "Announcement acknowledgments select policy"
  ON public.announcement_acknowledgments
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student())
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Announcement acknowledgments insert policy" ON public.announcement_acknowledgments;
CREATE POLICY "Announcement acknowledgments insert policy"
  ON public.announcement_acknowledgments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_active_student()
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id
        AND a.status = 'published'
        AND (
          (a.target_scope = 'platform')
          OR (a.target_scope = 'individual' AND a.student_id = auth.uid())
          OR (
            a.target_scope = 'assigned_students'
            AND public.is_authorized_mentor_for_student(a.author_id, auth.uid(), a.program_id)
          )
        )
    )
  );
