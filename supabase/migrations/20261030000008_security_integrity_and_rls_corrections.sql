-- ==============================================================================
-- PoraPlan — Milestone 5.2.1: Security Integrity & RLS Corrections
-- Migration: 20261030000008_security_integrity_and_rls_corrections.sql
--
-- Closes all confirmed defects and defense-in-depth gaps from Milestone 5.2 audit:
--
-- 1. F-001: Purge legacy permissive RLS policies on assignments and resources
--    - Drops "Mentors can update assignments for assigned students"
--    - Drops "Mentors can delete assignments for assigned students"
--    - Drops "Mentors can update resources for assigned students"
--    - Drops "Mentors can delete resources for assigned students"
--    - Eliminates residual former mentor access via auth.uid() = mentor_id
--
-- 2. F-002: Submission Status & Review Integrity Hardening
--    - Hardens public.protect_submission_review_fields()
--    - Prevents students from modifying content after a submission is reviewed
--    - Prevents status downgrade from 'reviewed' back to 'submitted'
--    - Protects 'under_review' submissions against content tampering
--    - Permits legitimate resubmission only from 'needs_revision' state
--    - Enforces reviewer identity, feedback, and score protection
--    - Explicitly rejects unauthorized non-student/non-mentor callers
--    - Preserves admin override and legitimate mentor review workflows
--
-- 3. F-003: Search Path Hardening on Legacy SECURITY DEFINER Functions
--    - Fixes public.handle_doubt_response_added() with SET search_path = public
--    - Fixes public.protect_evaluation_grading_fields() with SET search_path = public
--
-- 4. F-005: Legacy NULL-Program Duplicate Prevention on mentor_students
--    - Adds partial unique index for WHERE (program_id IS NULL)
--    - Guarantees complete unique tuple coverage across both NULL and non-NULL records
--
-- 5. F-006: Announcement Scope & Author Authorization Hardening
--    - Replaces '!=' with IS DISTINCT FROM for NULL-safe comparisons
--    - Validates mentor program and cohort authorization on assigned_students scope
--
-- 6. F-007: Function Privilege Hardening (Revocation from PUBLIC/anon)
--    - Revokes execute on admin_review_application from PUBLIC and anon
--    - Revokes execute on admin_register_member from PUBLIC and anon
--    - Revokes execute on provision_poraplan_account from PUBLIC and anon
-- ==============================================================================

-- ==============================================================================
-- 1. PURGE RESIDUAL PERMISSIVE RLS POLICIES (F-001)
-- ==============================================================================

-- Drop residual M5 policies on assignments that survived the M5.1 purge due to naming difference
DROP POLICY IF EXISTS "Mentors can update assignments for assigned students" ON public.assignments;
DROP POLICY IF EXISTS "Mentors can delete assignments for assigned students" ON public.assignments;

-- Drop residual M5 policies on resources that survived the M5.1 purge due to naming difference
DROP POLICY IF EXISTS "Mentors can update resources for assigned students" ON public.resources;
DROP POLICY IF EXISTS "Mentors can delete resources for assigned students" ON public.resources;


-- ==============================================================================
-- 2. SUBMISSION STATUS & REVIEW INTEGRITY TRIGGER (F-002)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_submission_review_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_is_authorized_mentor BOOLEAN := FALSE;
  v_program_id UUID;
BEGIN
  -- 1. Identify platform administrator
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  -- 2. Prevent tampering with ownership and assignment links (non-admin)
  IF NOT COALESCE(v_is_admin, false) THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Cannot transfer submission ownership to another student.';
    END IF;

    IF NEW.assignment_id IS DISTINCT FROM OLD.assignment_id THEN
      RAISE EXCEPTION 'Cannot reassign submission to another assignment.';
    END IF;
  END IF;

  -- 3. Resolve parent assignment program
  SELECT program_id INTO v_program_id
  FROM public.assignments
  WHERE id = OLD.assignment_id;

  -- 4. Check whether caller is an active authorized mentor for this mentee
  v_is_authorized_mentor := public.is_authorized_mentor_for_student(auth.uid(), OLD.student_id, v_program_id);

  -- 5. Student updating submission:
  IF auth.uid() = OLD.student_id AND NOT COALESCE(v_is_admin, false) THEN
    -- Student CANNOT modify review fields under any circumstances
    NEW.feedback := OLD.feedback;
    NEW.score := OLD.score;
    NEW.reviewed_by := OLD.reviewed_by;
    NEW.reviewed_at := OLD.reviewed_at;

    -- State machine enforcement for students:
    IF OLD.status = 'reviewed' THEN
      -- Post-review content is immutable; cannot downgrade to submitted or modify content
      NEW.content := OLD.content;
      NEW.link_url := OLD.link_url;
      NEW.file_name := OLD.file_name;
      NEW.file_size := OLD.file_size;
      NEW.submission_type := OLD.submission_type;
      NEW.submitted_at := OLD.submitted_at;
      NEW.status := 'reviewed';
    ELSIF OLD.status = 'under_review' THEN
      -- Submission is being evaluated by mentor; lock content and preserve status
      NEW.content := OLD.content;
      NEW.link_url := OLD.link_url;
      NEW.file_name := OLD.file_name;
      NEW.file_size := OLD.file_size;
      NEW.submission_type := OLD.submission_type;
      NEW.submitted_at := OLD.submitted_at;
      NEW.status := 'under_review';
    ELSIF OLD.status = 'needs_revision' THEN
      -- Legitimate resubmission: student may edit content and move status to 'submitted'
      IF NEW.status NOT IN ('submitted', 'needs_revision') THEN
        NEW.status := 'submitted';
      END IF;
      -- Refresh submitted_at timestamp when resubmitting
      IF NEW.status = 'submitted' AND OLD.status = 'needs_revision' THEN
        NEW.submitted_at := timezone('utc'::text, now());
      END IF;
    ELSIF OLD.status = 'submitted' THEN
      -- Pending initial review: student can refine content, but cannot self-review
      IF NEW.status IN ('under_review', 'reviewed', 'needs_revision') THEN
        NEW.status := 'submitted';
      END IF;
    END IF;
  END IF;

  -- 6. Mentor reviewing submission:
  IF v_is_authorized_mentor AND auth.uid() != OLD.student_id AND NOT COALESCE(v_is_admin, false) THEN
    -- Mentor cannot tamper with student's original submission content
    NEW.content := OLD.content;
    NEW.link_url := OLD.link_url;
    NEW.file_name := OLD.file_name;
    NEW.file_size := OLD.file_size;
    NEW.submission_type := OLD.submission_type;
    NEW.submitted_at := OLD.submitted_at;

    -- Set reviewer identity and timestamp automatically
    NEW.reviewed_by := auth.uid();
    IF NEW.reviewed_at IS NULL THEN
      NEW.reviewed_at := timezone('utc'::text, now());
    END IF;

    -- Mentors cannot revert a submission back to unreviewed 'submitted'
    IF NEW.status = 'submitted' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;

  -- 7. Reject unauthorized callers who are neither student, authorized mentor, nor admin
  IF NOT COALESCE(v_is_admin, false)
     AND auth.uid() != OLD.student_id
     AND NOT v_is_authorized_mentor THEN
    RAISE EXCEPTION 'Unauthorized: Caller cannot modify this submission.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_protect_submission_review_fields ON public.submissions;
CREATE TRIGGER on_protect_submission_review_fields
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_submission_review_fields();


-- ==============================================================================
-- 3. SEARCH_PATH HARDENING ON LEGACY SECURITY DEFINER FUNCTIONS (F-003)
-- ==============================================================================

-- Hardened doubt response status progression trigger
CREATE OR REPLACE FUNCTION public.handle_doubt_response_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When someone other than the student responds, move open doubts to answered
  UPDATE public.doubts
  SET status = 'answered',
      updated_at = timezone('utc'::text, now())
  WHERE id = NEW.doubt_id
    AND student_id != NEW.author_id
    AND status = 'open';
  RETURN NEW;
END;
$$;

-- Hardened evaluation grading protection trigger
CREATE OR REPLACE FUNCTION public.protect_evaluation_grading_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If update is initiated by a student, disallow modifying scores, feedback, or status
  IF auth.uid() = OLD.student_id AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('mentor', 'admin')
  ) THEN
    NEW.score := OLD.score;
    NEW.feedback := OLD.feedback;
    NEW.recommendation := OLD.recommendation;
    NEW.evaluated_at := OLD.evaluated_at;
    NEW.status := OLD.status;
    NEW.total_points := OLD.total_points;
    NEW.title := OLD.title;
    NEW.scheduled_date := OLD.scheduled_date;
  END IF;
  RETURN NEW;
END;
$$;


-- ==============================================================================
-- 4. LEGACY NULL-PROGRAM DUPLICATE PREVENTION ON MENTOR_STUDENTS (F-005)
-- ==============================================================================

-- Ensure uniqueness for legacy NULL-program mentor-student pairings
CREATE UNIQUE INDEX IF NOT EXISTS idx_mentor_students_null_program_unique
  ON public.mentor_students (mentor_id, student_id)
  WHERE (program_id IS NULL);


-- ==============================================================================
-- 5. ANNOUNCEMENT SCOPE & AUTHOR INTEGRITY HARDENING (F-006)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.protect_announcement_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_has_program_role BOOLEAN := FALSE;
BEGIN
  -- 1. Check admin status
  SELECT (role = 'admin') INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();

  IF NOT COALESCE(v_is_admin, false) THEN
    -- Author immutability with NULL-safe comparison
    IF NEW.author_id IS DISTINCT FROM OLD.author_id THEN
      RAISE EXCEPTION 'Cannot reassign announcement author.';
    END IF;

    -- Prevent scope escalation to platform-wide
    IF NEW.target_scope = 'platform' AND OLD.target_scope IS DISTINCT FROM 'platform' THEN
      RAISE EXCEPTION 'Mentors cannot change announcement scope to platform-wide.';
    END IF;

    -- Validate individual scope targeting
    IF NEW.target_scope = 'individual' THEN
      IF NEW.student_id IS NULL THEN
        RAISE EXCEPTION 'Individual announcement must target a specific student.';
      END IF;
      IF NOT public.is_authorized_mentor_for_student(auth.uid(), NEW.student_id, NEW.program_id) THEN
        RAISE EXCEPTION 'Cannot direct announcement to unauthorized student.';
      END IF;
    END IF;

    -- Validate assigned_students scope targeting
    IF NEW.target_scope = 'assigned_students' THEN
      -- If program_id is specified, verify mentor has role in that program
      IF NEW.program_id IS NOT NULL THEN
        SELECT (
          EXISTS (
            SELECT 1 FROM public.cohort_mentors
            WHERE mentor_id = auth.uid() AND program_id = NEW.program_id AND is_active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.student_mentor_assignments
            WHERE mentor_id = auth.uid() AND program_id = NEW.program_id AND is_active = true
          )
          OR EXISTS (
            SELECT 1 FROM public.program_applications
            WHERE applicant_id = auth.uid() AND application_type = 'mentor'
              AND program_id = NEW.program_id AND status = 'approved'
          )
        ) INTO v_has_program_role;

        IF NOT COALESCE(v_has_program_role, false) THEN
          RAISE EXCEPTION 'Cannot publish announcement for a program you do not mentor.';
        END IF;
      END IF;

      -- If cohort_id is specified, verify cohort belongs to program
      IF NEW.cohort_id IS NOT NULL AND NEW.program_id IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.cohorts WHERE id = NEW.cohort_id AND program_id = NEW.program_id
        ) THEN
          RAISE EXCEPTION 'Cohort does not belong to the specified program.';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_protect_announcement_fields ON public.announcements;
CREATE TRIGGER on_protect_announcement_fields
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_announcement_fields();


-- ==============================================================================
-- 6. FUNCTION PRIVILEGE HARDENING & REVOCATION FROM PUBLIC / ANON (F-007)
-- ==============================================================================

-- admin_review_application: authenticated only
REVOKE ALL ON FUNCTION public.admin_review_application(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_application(UUID, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_application(UUID, TEXT, TEXT) TO authenticated;

-- admin_register_member: authenticated only
REVOKE ALL ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_register_member(TEXT, TEXT, TEXT, user_role, TEXT) TO authenticated;

-- provision_poraplan_account: administrative/service-role only
REVOKE ALL ON FUNCTION public.provision_poraplan_account(TEXT, TEXT, TEXT, user_role, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_poraplan_account(TEXT, TEXT, TEXT, user_role, TEXT) FROM anon;
