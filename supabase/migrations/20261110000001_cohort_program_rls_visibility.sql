-- ==============================================================================
-- PoraPlan: Cohort and Program RLS Visibility Remediation
--
-- Migration: 20261110000001_cohort_program_rls_visibility.sql
-- Description:
--   1. Adds supplemental SELECT RLS policy to public.cohorts allowing enrolled
--      students and actively assigned mentors to access their assigned cohorts
--      regardless of publication status (e.g. draft, archived).
--   2. Adds supplemental SELECT RLS policy to public.programs allowing enrolled
--      students and actively assigned mentors to access their associated programs
--      regardless of publication status.
--   3. Preserves existing public SELECT policies for published offerings.
--   4. Preserves existing Admin full access policies.
--   5. Creates index on student_mentor_assignments(cohort_id) for RLS evaluation performance.
-- ==============================================================================

-- 1. Ensure RLS is enabled on public.cohorts and public.programs
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- 2. Performance index for individual mentor assignments cohort lookup
CREATE INDEX IF NOT EXISTS idx_student_mentor_cohort_id
  ON public.student_mentor_assignments (cohort_id);

-- 3. Supplemental SELECT policy on public.cohorts for enrolled students and assigned mentors
DROP POLICY IF EXISTS "Enrolled students and assigned mentors can view own cohorts" ON public.cohorts;

CREATE POLICY "Enrolled students and assigned mentors can view own cohorts"
  ON public.cohorts FOR SELECT
  TO authenticated
  USING (
    -- Case A: Enrolled student in this cohort with active, on_hold, or completed status
    EXISTS (
      SELECT 1 FROM public.program_enrollments pe
      WHERE pe.cohort_id = cohorts.id
        AND pe.program_id = cohorts.program_id
        AND pe.student_id = auth.uid()
        AND pe.status IN ('active', 'on_hold', 'completed')
    )
    OR
    -- Case B: Cohort default mentor assignment (active and not ended)
    EXISTS (
      SELECT 1 FROM public.cohort_mentors cm
      WHERE cm.cohort_id = cohorts.id
        AND cm.mentor_id = auth.uid()
        AND cm.is_active = true
        AND cm.ended_at IS NULL
    )
    OR
    -- Case C: Individual student mentor assignment override (active and not ended)
    EXISTS (
      SELECT 1 FROM public.student_mentor_assignments sma
      WHERE sma.cohort_id = cohorts.id
        AND sma.mentor_id = auth.uid()
        AND sma.is_active = true
        AND sma.ended_at IS NULL
    )
  );

COMMENT ON POLICY "Enrolled students and assigned mentors can view own cohorts" ON public.cohorts IS
'Permits authenticated enrolled students and assigned mentors to view their cohorts, including non-published academic records.';

-- 4. Supplemental SELECT policy on public.programs for enrolled students and assigned mentors
DROP POLICY IF EXISTS "Enrolled students and assigned mentors can view own programs" ON public.programs;

CREATE POLICY "Enrolled students and assigned mentors can view own programs"
  ON public.programs FOR SELECT
  TO authenticated
  USING (
    -- Case A: Enrolled student in this program with active, on_hold, or completed status
    EXISTS (
      SELECT 1 FROM public.program_enrollments pe
      WHERE pe.program_id = programs.id
        AND pe.student_id = auth.uid()
        AND pe.status IN ('active', 'on_hold', 'completed')
    )
    OR
    -- Case B: Cohort default mentor assignment in this program (active and not ended)
    EXISTS (
      SELECT 1 FROM public.cohort_mentors cm
      WHERE cm.program_id = programs.id
        AND cm.mentor_id = auth.uid()
        AND cm.is_active = true
        AND cm.ended_at IS NULL
    )
    OR
    -- Case C: Individual student mentor assignment override in this program (active and not ended)
    EXISTS (
      SELECT 1 FROM public.student_mentor_assignments sma
      WHERE sma.program_id = programs.id
        AND sma.mentor_id = auth.uid()
        AND sma.is_active = true
        AND sma.ended_at IS NULL
    )
  );

COMMENT ON POLICY "Enrolled students and assigned mentors can view own programs" ON public.programs IS
'Permits authenticated enrolled students and assigned mentors to view their programs, including non-published academic records.';
