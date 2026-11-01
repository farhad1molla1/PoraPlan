-- ==============================================================================
-- PoraPlan Milestone 6.1: Doubts Desk Attachment Integration
--
-- 1. Schema Extensions:
--    - public.doubts: attachment_path, attachment_name, attachment_size
--    - public.doubt_responses: attachment_path, attachment_name, attachment_size
-- 2. Performance Indexes on attachment_path columns
-- 3. Storage Row Level Security (RLS) Policies on storage.objects for Doubts:
--    - Path convention:
--        doubts/<doubt_id>/<message_id>/<timestamp>_<sanitized_filename>
--    - Strict isolation:
--        * Students may upload, read, and delete only attachments belonging to their own doubts.
--        * Mentors must be currently authorized for the student's program via
--          public.is_authorized_mentor_for_student (with active status).
--          Former or unauthorized mentors are denied access.
--        * Platform administrators retain platform-wide oversight.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS
-- ------------------------------------------------------------------------------

-- Add attachment metadata to public.doubts
ALTER TABLE public.doubts
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Add attachment metadata to public.doubt_responses
ALTER TABLE public.doubt_responses
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_doubts_attachment_path
  ON public.doubts(attachment_path)
  WHERE attachment_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doubt_responses_attachment_path
  ON public.doubt_responses(attachment_path)
  WHERE attachment_path IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. STORAGE ROW LEVEL SECURITY (RLS) POLICIES FOR DOUBTS
-- ------------------------------------------------------------------------------

-- 2.1. Doubts INSERT (Upload):
-- Student owner of the doubt, currently authorized mentor for the student & program, or admin.
DROP POLICY IF EXISTS "Authorized users can upload doubt attachment files" ON storage.objects;
CREATE POLICY "Authorized users can upload doubt attachment files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'doubts'
    AND (
      -- Student owner of the parent doubt
      EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id::text = split_part(name, '/', 2)
          AND d.student_id = auth.uid()
      )
      -- Currently authorized mentor for the doubt's student and program
      OR EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(d.student_id, d.program_id)
            OR (
              d.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = d.student_id
                  AND ms.status = 'active'
              )
            )
          )
      )
      -- Platform administrator
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- 2.2. Doubts SELECT (Read / View / Download / Signed URL generation):
-- Student owner of the doubt, currently authorized mentor for the student & program, or admin.
DROP POLICY IF EXISTS "Authorized users can view doubt attachment files" ON storage.objects;
CREATE POLICY "Authorized users can view doubt attachment files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'doubts'
    AND (
      -- Student owner of the parent doubt
      EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id::text = split_part(name, '/', 2)
          AND d.student_id = auth.uid()
      )
      -- Currently authorized mentor for the doubt's student and program
      OR EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(d.student_id, d.program_id)
            OR (
              d.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = d.student_id
                  AND ms.status = 'active'
              )
            )
          )
      )
      -- Platform administrator
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- 2.3. Doubts DELETE (Remove / Compensation Cleanup):
-- Student owner of the doubt, currently authorized mentor for the student & program, or admin.
DROP POLICY IF EXISTS "Authorized users can delete doubt attachment files" ON storage.objects;
CREATE POLICY "Authorized users can delete doubt attachment files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'doubts'
    AND (
      -- Student owner of the parent doubt
      EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id::text = split_part(name, '/', 2)
          AND d.student_id = auth.uid()
      )
      -- Currently authorized mentor for the doubt's student and program
      OR EXISTS (
        SELECT 1 FROM public.doubts d
        WHERE d.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(d.student_id, d.program_id)
            OR (
              d.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = d.student_id
                  AND ms.status = 'active'
              )
            )
          )
      )
      -- Platform administrator
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

