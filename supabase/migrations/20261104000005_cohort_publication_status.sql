-- ==============================================================================
-- PoraPlan: Cohort Publication Lifecycle Separation
--
-- Migration: 20261104000005_cohort_publication_status.sql
-- Description:
--   1. Adds publication_status column ('draft', 'published', 'archived') to public.cohorts
--   2. Backfills publication_status carefully based on existing cohort records
--   3. Updates public RLS policy on public.cohorts to filter on publication_status = 'published'
--      while preserving Admin full access
-- ==============================================================================

-- 1. Add publication_status column with default 'draft'
ALTER TABLE public.cohorts
ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft'
CHECK (publication_status IN ('draft', 'published', 'archived'));

COMMENT ON COLUMN public.cohorts.publication_status IS
'Public visibility lifecycle status: draft (unlisted/preparation), published (publicly visible), archived (hidden from public)';

-- 2. Backfill existing cohorts carefully
-- Active cohorts become published so existing live public offerings remain available
UPDATE public.cohorts
SET publication_status = 'published'
WHERE status = 'active' AND publication_status = 'draft';

-- Planned cohorts remain draft
UPDATE public.cohorts
SET publication_status = 'draft'
WHERE status = 'planned';

-- Archived cohorts become archived publication status
UPDATE public.cohorts
SET publication_status = 'archived'
WHERE status = 'archived';

-- Completed cohorts become archived publication status (public admissions closed)
UPDATE public.cohorts
SET publication_status = 'archived'
WHERE status = 'completed';

-- 3. Update public RLS SELECT policy to decouple public visibility from academic status
DROP POLICY IF EXISTS "Public can view cohorts of published programs" ON public.cohorts;
CREATE POLICY "Public can view cohorts of published programs"
  ON public.cohorts FOR SELECT
  USING (
    publication_status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = cohorts.program_id
      AND p.publication_status = 'published'
    )
  );

-- 4. Reaffirm Admin full access policy
DROP POLICY IF EXISTS "Admins have full access to cohorts" ON public.cohorts;
CREATE POLICY "Admins have full access to cohorts"
  ON public.cohorts FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

