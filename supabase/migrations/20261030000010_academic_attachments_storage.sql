-- ==============================================================================
-- PoraPlan Milestone 6.0.2 & 6.0.2.1: Private Academic Storage Foundation
--
-- 1. Schema Additions:
--    - public.submissions: file_path (Storage object path for attached submission)
--    - public.tasks: attachment_path, attachment_name, attachment_size
-- 2. Storage Bucket Provisioning:
--    - Private bucket 'academic-attachments' with 10MB size limit and allowed MIME types
-- 3. Row Level Security Policies on storage.objects:
--    - Path convention:
--        submissions/<assignment_id>/<student_id>/<unique_file_name>
--        tasks/<task_id>/<unique_file_name>
--    - Strict isolation:
--        * Students access only their own files.
--        * Mentors must be currently authorized for the specific assignment/task program
--          via public.is_authorized_mentor_for_student (with active status).
--        * Submissions under review or reviewed cannot have their attachments deleted by students.
--        * Administrators retain platform-wide oversight.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCHEMA EXTENSIONS
-- ------------------------------------------------------------------------------

-- Add file_path to public.submissions
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS file_path TEXT;

-- Add attachment metadata to public.tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS attachment_path TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_size INTEGER;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_submissions_file_path
  ON public.submissions(file_path)
  WHERE file_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_attachment_path
  ON public.tasks(attachment_path)
  WHERE attachment_path IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. STORAGE BUCKET PROVISIONING
-- ------------------------------------------------------------------------------

-- Ensure the academic-attachments bucket exists with private access and strict limits
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'academic-attachments',
  'academic-attachments',
  false,
  10485760, -- 10MB in bytes
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

-- ------------------------------------------------------------------------------
-- 3. STORAGE ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------

-- Ensure RLS is enabled on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3.1. SUBMISSIONS STORAGE POLICIES
-- Path format: submissions/<assignment_id>/<student_id>/<filename>

-- Submissions INSERT (Upload):
-- Students may upload only to their own subpath for assignments assigned to them; Admins have full upload access.
DROP POLICY IF EXISTS "Authorized users can upload submission files" ON storage.objects;
CREATE POLICY "Authorized users can upload submission files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'submissions'
    AND (
      (
        auth.uid() IS NOT NULL
        AND split_part(name, '/', 3) = auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.assignments a
          WHERE a.id::text = split_part(name, '/', 2)
            AND a.student_id = auth.uid()
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- Submissions SELECT (Read / Download / Signed URL generation):
-- Student owner, currently authorized mentor for the student's assignment/program, or admin.
DROP POLICY IF EXISTS "Authorized users can view submission files" ON storage.objects;
CREATE POLICY "Authorized users can view submission files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'submissions'
    AND (
      -- Student owner
      split_part(name, '/', 3) = auth.uid()::text
      -- Currently authorized mentor for this student's assignment program
      OR EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(a.student_id, a.program_id)
            OR (
              a.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = a.student_id
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

-- Submissions DELETE:
-- Student owner (only while submission is unreviewed / not under review) or platform administrator.
DROP POLICY IF EXISTS "Authorized users can delete submission files" ON storage.objects;
CREATE POLICY "Authorized users can delete submission files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'submissions'
    AND (
      -- Student owner can delete ONLY if the submission is NOT currently under review or reviewed
      (
        split_part(name, '/', 3) = auth.uid()::text
        AND NOT EXISTS (
          SELECT 1 FROM public.submissions s
          WHERE (s.file_path = name OR (s.assignment_id::text = split_part(name, '/', 2) AND s.student_id = auth.uid()))
            AND s.status IN ('under_review', 'reviewed')
        )
      )
      -- Platform administrator retains unrestricted deletion privilege
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- 3.2. TASKS STORAGE POLICIES
-- Path format: tasks/<task_id>/<filename>

-- Tasks INSERT (Upload):
-- Currently authorized mentor for the task's student and program, or administrator.
-- NOTE: Requires the task database row to exist prior to attachment upload.
DROP POLICY IF EXISTS "Authorized users can upload task attachment files" ON storage.objects;
CREATE POLICY "Authorized users can upload task attachment files"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'tasks'
    AND (
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(t.student_id, t.program_id)
            OR (
              t.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = t.student_id
                  AND ms.status = 'active'
              )
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- Tasks SELECT (Read / Download / Signed URL generation):
-- Assigned student, currently authorized mentor for the task's program, or administrator.
DROP POLICY IF EXISTS "Authorized users can view task attachment files" ON storage.objects;
CREATE POLICY "Authorized users can view task attachment files"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'tasks'
    AND (
      -- Assigned student
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = split_part(name, '/', 2)
          AND t.student_id = auth.uid()
      )
      -- Currently authorized mentor for the task's student and program
      OR EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(t.student_id, t.program_id)
            OR (
              t.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = t.student_id
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

-- Tasks DELETE:
-- Currently authorized mentor for the task's program, or administrator.
DROP POLICY IF EXISTS "Authorized users can delete task attachment files" ON storage.objects;
CREATE POLICY "Authorized users can delete task attachment files"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'academic-attachments'
    AND split_part(name, '/', 1) = 'tasks'
    AND (
      EXISTS (
        SELECT 1 FROM public.tasks t
        WHERE t.id::text = split_part(name, '/', 2)
          AND (
            public.is_authorized_mentor_for_student(t.student_id, t.program_id)
            OR (
              t.program_id IS NULL
              AND EXISTS (
                SELECT 1 FROM public.mentor_students ms
                WHERE ms.mentor_id = auth.uid()
                  AND ms.student_id = t.student_id
                  AND ms.status = 'active'
              )
            )
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    )
  );
