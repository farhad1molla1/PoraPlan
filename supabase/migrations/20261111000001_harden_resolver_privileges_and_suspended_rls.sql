-- ==============================================================================
-- Migration: 20261111000001_harden_resolver_privileges_and_suspended_rls.sql
-- Description:
-- 1. SEC-02: Complete revocation of execute on resolve_poraplan_id_login from
--    authenticated, anon, and PUBLIC (restricted exclusively to service_role).
-- 2. SEC-03: Enforce account status check in student RLS policies across all
--    student-owned tables (subjects, study_plans, study_plan_items, tasks,
--    assignments, submissions, evaluations, resources, doubts, doubt_responses,
--    announcements, announcement_acknowledgments) to prevent suspended students
--    from accessing data using unexpired JWTs.
-- 3. Dual-layer defense: Permissive policies require is_active_student_profile(auth.uid())
--    AND an AS RESTRICTIVE policy blocks any suspended student unconditionally.
-- Phase: 2.3B.4.5
-- ==============================================================================

-- ==============================================================================
-- 1. SEC-02: RESOLVER RPC PRIVILEGE CORRECTION
-- ==============================================================================

REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.resolve_poraplan_id_login(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_poraplan_id_login(TEXT) TO service_role;

COMMENT ON FUNCTION public.resolve_poraplan_id_login(TEXT) IS
'Privileged login resolver. Restricted strictly to service_role (Edge Functions). Revoked from anon, authenticated, and PUBLIC to defeat account enumeration.';


-- ==============================================================================
-- 2. SEC-03: ACTIVE STUDENT PROFILE HELPER FUNCTION
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.is_active_student_profile(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id
      AND role = 'student'
      AND status != 'suspended'
      AND status IS NOT NULL
  );
END;
$$;

ALTER FUNCTION public.is_active_student_profile(UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_active_student_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_student_profile(UUID) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.is_active_student_profile(UUID) IS
'RLS security helper verifying caller is an active (unsuspended) student. Fails closed on NULL or suspended status.';


-- ==============================================================================
-- 3. SEC-03: PERMISSIVE & RESTRICTIVE RLS POLICY HARDENING
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- A. SUBJECTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Students can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Subjects select policy" ON public.subjects;
CREATE POLICY "Subjects select policy"
  ON public.subjects
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Subjects update policy" ON public.subjects;
CREATE POLICY "Subjects update policy"
  ON public.subjects
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Subjects suspended student restrictive" ON public.subjects;
CREATE POLICY "Subjects suspended student restrictive"
  ON public.subjects
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- B. STUDY PLANS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own study plans" ON public.study_plans;
DROP POLICY IF EXISTS "Study plans select policy" ON public.study_plans;
CREATE POLICY "Study plans select policy"
  ON public.study_plans
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Study plans update policy" ON public.study_plans;
CREATE POLICY "Study plans update policy"
  ON public.study_plans
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Study plans suspended student restrictive" ON public.study_plans;
CREATE POLICY "Study plans suspended student restrictive"
  ON public.study_plans
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- C. STUDY PLAN ITEMS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own study plan items" ON public.study_plan_items;
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
          (sp.student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
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
          (sp.student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.study_plans sp
      WHERE sp.id = public.study_plan_items.plan_id
        AND (
          (sp.student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
          OR public.is_authorized_mentor_for_student(sp.student_id, sp.program_id)
        )
    )
  );

DROP POLICY IF EXISTS "Study plan items suspended student restrictive" ON public.study_plan_items;
CREATE POLICY "Study plan items suspended student restrictive"
  ON public.study_plan_items
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- D. TASKS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Students can update own task status" ON public.tasks;
DROP POLICY IF EXISTS "Tasks select policy" ON public.tasks;
CREATE POLICY "Tasks select policy"
  ON public.tasks
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Tasks update policy" ON public.tasks;
CREATE POLICY "Tasks update policy"
  ON public.tasks
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Tasks suspended student restrictive" ON public.tasks;
CREATE POLICY "Tasks suspended student restrictive"
  ON public.tasks
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- E. ASSIGNMENTS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own assignments" ON public.assignments;
DROP POLICY IF EXISTS "Assignments select policy" ON public.assignments;
CREATE POLICY "Assignments select policy"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Assignments suspended student restrictive" ON public.assignments;
CREATE POLICY "Assignments suspended student restrictive"
  ON public.assignments
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- F. SUBMISSIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Submissions select policy" ON public.submissions;
CREATE POLICY "Submissions select policy"
  ON public.submissions
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  );

DROP POLICY IF EXISTS "Students can insert own submissions for valid assignments" ON public.submissions;
DROP POLICY IF EXISTS "Submissions insert policy" ON public.submissions;
CREATE POLICY "Submissions insert policy"
  ON public.submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND public.is_active_student_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND a.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Submissions update policy" ON public.submissions;
CREATE POLICY "Submissions update policy"
  ON public.submissions
  FOR UPDATE
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  )
  WITH CHECK (
    (student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.submissions.assignment_id
        AND public.is_authorized_mentor_for_student(public.submissions.student_id, a.program_id)
    )
  );

DROP POLICY IF EXISTS "Submissions suspended student restrictive" ON public.submissions;
CREATE POLICY "Submissions suspended student restrictive"
  ON public.submissions
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- G. EVALUATIONS
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Students can view own evaluations" ON public.evaluations;
DROP POLICY IF EXISTS "Evaluations select policy" ON public.evaluations;
CREATE POLICY "Evaluations select policy"
  ON public.evaluations
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Evaluations suspended student restrictive" ON public.evaluations;
CREATE POLICY "Evaluations suspended student restrictive"
  ON public.evaluations
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- H. RESOURCES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Resources select policy" ON public.resources;
CREATE POLICY "Resources select policy"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Resources suspended student restrictive" ON public.resources;
CREATE POLICY "Resources suspended student restrictive"
  ON public.resources
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- I. DOUBTS & DOUBT RESPONSES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Doubts select policy" ON public.doubts;
CREATE POLICY "Doubts select policy"
  ON public.doubts
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  );

DROP POLICY IF EXISTS "Doubts insert policy" ON public.doubts;
CREATE POLICY "Doubts insert policy"
  ON public.doubts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND public.is_active_student_profile(auth.uid())
  );

DROP POLICY IF EXISTS "Doubts update policy" ON public.doubts;
CREATE POLICY "Doubts update policy"
  ON public.doubts
  FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = student_id AND public.is_active_student_profile(auth.uid()))
    OR public.is_authorized_mentor_for_student(student_id, program_id)
  )
  WITH CHECK (
    auth.uid() = student_id
    AND public.is_active_student_profile(auth.uid())
  );

DROP POLICY IF EXISTS "Doubts suspended student restrictive" ON public.doubts;
CREATE POLICY "Doubts suspended student restrictive"
  ON public.doubts
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

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
          (d.student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
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
      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student') AND public.is_active_student_profile(auth.uid()))
      OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'mentor' AND status != 'suspended'))
      OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    )
    AND EXISTS (
      SELECT 1 FROM public.doubts d
      WHERE d.id = public.doubt_responses.doubt_id
        AND (
          (d.student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
          OR public.is_authorized_mentor_for_student(d.student_id, d.program_id)
        )
    )
  );

DROP POLICY IF EXISTS "Doubt responses suspended student restrictive" ON public.doubt_responses;
CREATE POLICY "Doubt responses suspended student restrictive"
  ON public.doubt_responses
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

-- ------------------------------------------------------------------------------
-- J. ANNOUNCEMENTS & ACKNOWLEDGMENTS
-- ------------------------------------------------------------------------------
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
        (target_scope = 'platform' AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
        OR (target_scope = 'individual' AND student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
        OR (
          target_scope = 'assigned_students'
          AND public.is_active_student_profile(auth.uid())
          AND public.is_authorized_mentor_for_student(author_id, auth.uid(), program_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Announcements suspended student restrictive" ON public.announcements;
CREATE POLICY "Announcements suspended student restrictive"
  ON public.announcements
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );

DROP POLICY IF EXISTS "Students can acknowledge authorized announcements" ON public.announcement_acknowledgments;
DROP POLICY IF EXISTS "Announcement acknowledgments select policy" ON public.announcement_acknowledgments;
CREATE POLICY "Announcement acknowledgments select policy"
  ON public.announcement_acknowledgments
  FOR SELECT
  TO authenticated
  USING (
    (student_id = auth.uid() AND public.is_active_student_profile(auth.uid()))
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
    AND public.is_active_student_profile(auth.uid())
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

DROP POLICY IF EXISTS "Announcement acks suspended student restrictive" ON public.announcement_acknowledgments;
CREATE POLICY "Announcement acks suspended student restrictive"
  ON public.announcement_acknowledgments
  AS RESTRICTIVE
  TO authenticated
  USING (
    NOT (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'student' AND status = 'suspended'))
  );
