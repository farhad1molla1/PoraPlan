-- ==============================================================================
-- PoraPlan Milestone 3: Applications & Enrollment System
--
-- Tables:
-- 1. public.program_applications
-- 2. public.program_enrollments
--
-- Features:
-- - Student applications (program + optional cohort)
-- - Mentor applications (program + optional cohort)
-- - Strict status lifecycle: pending, under_review, approved, rejected
-- - Atomic server-side approval RPC: public.admin_review_application
-- - Capacity enforcement and duplicate prevention
-- - Student enrollment creation upon approval (zero enrollment for mentors)
-- - Strict RLS: applicants read own, students read own enrollments, admin full access
-- ==============================================================================

-- 1. CREATE PROGRAM APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.program_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  application_type TEXT NOT NULL CHECK (application_type IN ('student', 'mentor')),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),
  application_message TEXT,
  experience TEXT,
  additional_information TEXT,
  admin_review_note TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique index to prevent duplicate pending/under_review/approved applications
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_application 
  ON public.program_applications (applicant_id, program_id, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('pending', 'under_review', 'approved');

-- 2. CREATE PROGRAM ENROLLMENTS TABLE (Students Only)
CREATE TABLE IF NOT EXISTS public.program_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES public.cohorts(id) ON DELETE SET NULL,
  application_id UUID REFERENCES public.program_applications(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'completed', 'withdrawn')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Unique index: a student cannot have multiple active enrollments in the same program/cohort
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_enrollment
  ON public.program_enrollments (student_id, program_id, COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE status IN ('active', 'on_hold');

-- 3. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_program_applications_applicant ON public.program_applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_program ON public.program_applications(program_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_cohort ON public.program_applications(cohort_id);
CREATE INDEX IF NOT EXISTS idx_program_applications_status ON public.program_applications(status);
CREATE INDEX IF NOT EXISTS idx_program_applications_type ON public.program_applications(application_type);

CREATE INDEX IF NOT EXISTS idx_program_enrollments_student ON public.program_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_program ON public.program_enrollments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_cohort ON public.program_enrollments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_program_enrollments_status ON public.program_enrollments(status);

-- 4. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.program_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_enrollments ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES FOR APPLICATIONS
DROP POLICY IF EXISTS "Applicants can view own applications" ON public.program_applications;
CREATE POLICY "Applicants can view own applications"
  ON public.program_applications FOR SELECT
  USING (applicant_id = auth.uid());

DROP POLICY IF EXISTS "Applicants can submit applications" ON public.program_applications;
CREATE POLICY "Applicants can submit applications"
  ON public.program_applications FOR INSERT
  WITH CHECK (
    applicant_id = auth.uid()
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_review_note IS NULL
  );

DROP POLICY IF EXISTS "Admins have full access to applications" ON public.program_applications;
CREATE POLICY "Admins have full access to applications"
  ON public.program_applications FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

-- 6. RLS POLICIES FOR ENROLLMENTS
DROP POLICY IF EXISTS "Students can view own enrollments" ON public.program_enrollments;
CREATE POLICY "Students can view own enrollments"
  ON public.program_enrollments FOR SELECT
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Admins have full access to enrollments" ON public.program_enrollments;
CREATE POLICY "Admins have full access to enrollments"
  ON public.program_enrollments FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

-- 7. ATOMIC ADMIN REVIEW APPLICATION RPC
CREATE OR REPLACE FUNCTION public.admin_review_application(
  p_application_id UUID,
  p_decision TEXT,
  p_review_note TEXT DEFAULT NULL
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_caller_role user_role;
  v_app RECORD;
  v_cohort RECORD;
  v_active_count INT;
  v_enrollment_id UUID;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS NULL OR v_caller_role != 'admin' THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can review applications.';
  END IF;

  -- Validate decision input
  IF p_decision NOT IN ('under_review', 'approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be under_review, approved, or rejected.';
  END IF;

  -- Lock and fetch application row
  SELECT * INTO v_app
  FROM public.program_applications
  WHERE id = p_application_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found.';
  END IF;

  IF v_app.status = 'approved' AND p_decision = 'approved' THEN
    RAISE EXCEPTION 'This application has already been approved.';
  END IF;

  -- IF APPROVING:
  IF p_decision = 'approved' THEN
    -- Student approval creates an enrollment
    IF v_app.application_type = 'student' THEN
      -- Check cohort capacity and status if cohort_id is defined
      IF v_app.cohort_id IS NOT NULL THEN
        SELECT * INTO v_cohort FROM public.cohorts WHERE id = v_app.cohort_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'Selected cohort no longer exists.';
        END IF;

        IF v_cohort.status IN ('completed', 'archived') THEN
          RAISE EXCEPTION 'Cannot approve application: Cohort is %.', v_cohort.status;
        END IF;

        IF v_cohort.capacity IS NOT NULL THEN
          SELECT COUNT(*) INTO v_active_count
          FROM public.program_enrollments
          WHERE cohort_id = v_app.cohort_id AND status = 'active';

          IF v_active_count >= v_cohort.capacity THEN
            RAISE EXCEPTION 'Cannot approve application: Cohort capacity (% scholars) is full.', v_cohort.capacity;
          END IF;
        END IF;
      END IF;

      -- Check duplicate active enrollment
      IF EXISTS (
        SELECT 1 FROM public.program_enrollments
        WHERE student_id = v_app.applicant_id
          AND program_id = v_app.program_id
          AND COALESCE(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid) = COALESCE(v_app.cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)
          AND status IN ('active', 'on_hold')
      ) THEN
        RAISE EXCEPTION 'Student is already actively enrolled in this program/cohort.';
      END IF;

      -- Create enrollment record
      INSERT INTO public.program_enrollments (
        student_id,
        program_id,
        cohort_id,
        application_id,
        status,
        enrolled_at
      ) VALUES (
        v_app.applicant_id,
        v_app.program_id,
        v_app.cohort_id,
        v_app.id,
        'active',
        timezone('utc'::text, now())
      ) RETURNING id INTO v_enrollment_id;
    END IF;

    -- Update application status
    UPDATE public.program_applications
    SET status = 'approved',
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc'::text, now()),
        admin_review_note = COALESCE(p_review_note, admin_review_note),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', CASE 
        WHEN v_app.application_type = 'student' THEN 'Application approved and student enrollment created.'
        ELSE 'Mentor application approved.'
      END,
      'status', 'approved',
      'enrollment_id', v_enrollment_id
    );

  ELSIF p_decision = 'rejected' THEN
    UPDATE public.program_applications
    SET status = 'rejected',
        reviewed_by = auth.uid(),
        reviewed_at = timezone('utc'::text, now()),
        admin_review_note = COALESCE(p_review_note, admin_review_note),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Application declined.',
      'status', 'rejected'
    );

  ELSE -- 'under_review'
    UPDATE public.program_applications
    SET status = 'under_review',
        admin_review_note = COALESCE(p_review_note, admin_review_note),
        updated_at = timezone('utc'::text, now())
    WHERE id = p_application_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Application status moved to Under Review.',
      'status', 'under_review'
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_application(UUID, TEXT, TEXT) TO authenticated;
