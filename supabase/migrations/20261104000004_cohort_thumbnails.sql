-- Migration: 20261104000004_cohort_thumbnails.sql
-- Description: Add cover_image_url column to public.cohorts for independent cohort thumbnail management

ALTER TABLE public.cohorts
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

COMMENT ON COLUMN public.cohorts.cover_image_url IS 'Public storage URL for cohort-specific cover thumbnail';

