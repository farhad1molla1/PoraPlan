-- ==============================================================================
-- PoraPlan Milestone 16: Announcements Desk Foundation
-- Schema Updates:
-- 1. Create public.announcements table (targeted notices, author, audience scope)
-- 2. Create public.announcement_acknowledgments table (student read/ack tracking)
-- 3. Indexes, triggers (updated_at)
-- 4. Row Level Security policies for Students, Mentors, and Admins
-- ==============================================================================

-- 1. CREATE ANNOUNCEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  target_scope TEXT NOT NULL DEFAULT 'assigned_students' CHECK (target_scope IN ('individual', 'assigned_students', 'platform')),
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'archived')),
  published_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  -- Validate individual target requires student_id
  CONSTRAINT check_individual_student_id CHECK (
    (target_scope = 'individual' AND student_id IS NOT NULL) OR
    (target_scope != 'individual')
  )
);

-- Performance Indexes for Announcements
CREATE INDEX IF NOT EXISTS idx_announcements_author_id ON public.announcements(author_id);
CREATE INDEX IF NOT EXISTS idx_announcements_student_id ON public.announcements(student_id);
CREATE INDEX IF NOT EXISTS idx_announcements_subject_id ON public.announcements(subject_id);
CREATE INDEX IF NOT EXISTS idx_announcements_target_scope ON public.announcements(target_scope);
CREATE INDEX IF NOT EXISTS idx_announcements_status ON public.announcements(status);
CREATE INDEX IF NOT EXISTS idx_announcements_published_at ON public.announcements(published_at);

-- 2. CREATE ANNOUNCEMENT ACKNOWLEDGMENTS TABLE
CREATE TABLE IF NOT EXISTS public.announcement_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES public.announcements(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_announcement_student_ack UNIQUE (announcement_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_announcement_acks_announcement_id ON public.announcement_acknowledgments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_acks_student_id ON public.announcement_acknowledgments(student_id);

-- Updated_at Trigger for Announcements
DROP TRIGGER IF EXISTS on_announcements_updated ON public.announcements;
CREATE TRIGGER on_announcements_updated
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 3. ROW LEVEL SECURITY (RLS) FOR ANNOUNCEMENTS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Visibility Policy for Announcements:
-- Students view only announcements targeted to them, to their mentor's assigned group, or platform-wide.
-- Mentors view their authored announcements. Admins view all.
DROP POLICY IF EXISTS "Users can view authorized announcements" ON public.announcements;
CREATE POLICY "Users can view authorized announcements"
  ON public.announcements
  FOR SELECT
  USING (
    -- Author view
    auth.uid() = author_id
    -- Admin view
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    -- Student view: individual target
    OR (
      target_scope = 'individual' AND student_id = auth.uid() AND status = 'published'
    )
    -- Student view: mentor assigned students target
    OR (
      target_scope = 'assigned_students'
      AND status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.mentor_students ms
        WHERE ms.mentor_id = public.announcements.author_id
          AND ms.student_id = auth.uid()
      )
    )
    -- Student/user view: platform-wide announcements
    OR (
      target_scope = 'platform' AND status = 'published'
    )
  );

-- Insert Policy for Announcements:
-- Mentors can publish to assigned students or specific assigned scholar (NOT platform-wide).
-- Admins can publish to any scope including platform-wide.
DROP POLICY IF EXISTS "Authorized users can create announcements" ON public.announcements;
CREATE POLICY "Authorized users can create announcements"
  ON public.announcements
  FOR INSERT
  WITH CHECK (
    -- Admin can create any announcement
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    -- Mentor creation: author must be auth.uid() and role mentor
    OR (
      auth.uid() = author_id
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role = 'mentor'
      )
      -- Disallow platform scope for ordinary mentors
      AND target_scope != 'platform'
      -- If individual scope, student must be assigned to this mentor
      AND (
        target_scope != 'individual'
        OR EXISTS (
          SELECT 1 FROM public.mentor_students ms
          WHERE ms.mentor_id = auth.uid()
            AND ms.student_id = public.announcements.student_id
        )
      )
    )
  );

-- Update Policy for Announcements:
-- Author or admin can update announcement
DROP POLICY IF EXISTS "Authors can update own announcements" ON public.announcements;
CREATE POLICY "Authors can update own announcements"
  ON public.announcements
  FOR UPDATE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Delete Policy for Announcements:
-- Author or admin can delete announcement
DROP POLICY IF EXISTS "Authors can delete own announcements" ON public.announcements;
CREATE POLICY "Authors can delete own announcements"
  ON public.announcements
  FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- 4. ROW LEVEL SECURITY (RLS) FOR ACKNOWLEDGMENTS
-- View Policy: Students see their own acknowledgments; Authors see acknowledgments for their announcements; Admins see all
DROP POLICY IF EXISTS "Users can view relevant acknowledgments" ON public.announcement_acknowledgments;
CREATE POLICY "Users can view relevant acknowledgments"
  ON public.announcement_acknowledgments
  FOR SELECT
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id AND a.author_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Insert Policy: Students can record acknowledgments for themselves on announcements visible to them
DROP POLICY IF EXISTS "Students can acknowledge authorized announcements" ON public.announcement_acknowledgments;
CREATE POLICY "Students can acknowledge authorized announcements"
  ON public.announcement_acknowledgments
  FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = announcement_id
        AND a.status = 'published'
        AND (
          (a.target_scope = 'individual' AND a.student_id = auth.uid())
          OR (a.target_scope = 'platform')
          OR (
            a.target_scope = 'assigned_students'
            AND EXISTS (
              SELECT 1 FROM public.mentor_students ms
              WHERE ms.mentor_id = a.author_id AND ms.student_id = auth.uid()
            )
          )
        )
    )
  );
