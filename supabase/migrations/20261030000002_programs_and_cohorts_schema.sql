-- ==============================================================================
-- PoraPlan Milestone 2: Program & Cohort Management System
--
-- Tables:
-- 1. public.programs
-- 2. public.cohorts
-- 3. public.program_curriculum_sections
-- 4. public.program_curriculum_topics
--
-- Features:
-- - Shared management for Academic Mentorship and SkillSprint
-- - Independent publication_status ('draft', 'published', 'archived')
-- - Independent enrollment_status ('open', 'closed')
-- - Cohort lifecycle ('planned', 'active', 'completed', 'archived')
-- - Structured ordering for curriculum modules & topics
-- - Strict RLS: public read on published programs, admin full access
-- - Initial seed: PoraPlan Academic Program 0.1 (Beta) + UU CSE Batch 67 cohort
-- ==============================================================================

-- 1. CREATE PROGRAMS TABLE
CREATE TABLE IF NOT EXISTS public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('academic_mentorship', 'skillsprint')),
  short_description TEXT NOT NULL,
  description TEXT,
  learning_objectives TEXT[] DEFAULT '{}',
  target_audience TEXT,
  prerequisites TEXT,
  duration TEXT,
  delivery_mode TEXT,
  cover_image_url TEXT,
  publication_status TEXT NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published', 'archived')),
  enrollment_status TEXT NOT NULL DEFAULT 'closed' CHECK (enrollment_status IN ('open', 'closed')),
  display_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. CREATE COHORTS TABLE
CREATE TABLE IF NOT EXISTS public.cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  start_date DATE,
  end_date DATE,
  capacity INT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. CREATE CURRICULUM SECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.program_curriculum_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. CREATE CURRICULUM TOPICS TABLE
CREATE TABLE IF NOT EXISTS public.program_curriculum_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES public.program_curriculum_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_programs_publication_status ON public.programs(publication_status);
CREATE INDEX IF NOT EXISTS idx_programs_category ON public.programs(category);
CREATE INDEX IF NOT EXISTS idx_programs_slug ON public.programs(slug);
CREATE INDEX IF NOT EXISTS idx_cohorts_program_id ON public.cohorts(program_id);
CREATE INDEX IF NOT EXISTS idx_cohorts_status ON public.cohorts(status);
CREATE INDEX IF NOT EXISTS idx_curriculum_sections_program_id ON public.program_curriculum_sections(program_id, display_order);
CREATE INDEX IF NOT EXISTS idx_curriculum_topics_section_id ON public.program_curriculum_topics(section_id, display_order);

-- 6. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_curriculum_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_curriculum_topics ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES FOR PROGRAMS
DROP POLICY IF EXISTS "Public can view published programs" ON public.programs;
CREATE POLICY "Public can view published programs"
  ON public.programs FOR SELECT
  USING (publication_status = 'published');

DROP POLICY IF EXISTS "Admins have full access to programs" ON public.programs;
CREATE POLICY "Admins have full access to programs"
  ON public.programs FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

-- 8. RLS POLICIES FOR COHORTS
DROP POLICY IF EXISTS "Public can view cohorts of published programs" ON public.cohorts;
CREATE POLICY "Public can view cohorts of published programs"
  ON public.cohorts FOR SELECT
  USING (
    status != 'archived'
    AND EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = cohorts.program_id
      AND p.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "Admins have full access to cohorts" ON public.cohorts;
CREATE POLICY "Admins have full access to cohorts"
  ON public.cohorts FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

-- 9. RLS POLICIES FOR CURRICULUM SECTIONS
DROP POLICY IF EXISTS "Public can view curriculum sections of published programs" ON public.program_curriculum_sections;
CREATE POLICY "Public can view curriculum sections of published programs"
  ON public.program_curriculum_sections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.programs p
      WHERE p.id = program_curriculum_sections.program_id
      AND p.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "Admins have full access to curriculum sections" ON public.program_curriculum_sections;
CREATE POLICY "Admins have full access to curriculum sections"
  ON public.program_curriculum_sections FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

-- 10. RLS POLICIES FOR CURRICULUM TOPICS
DROP POLICY IF EXISTS "Public can view curriculum topics of published programs" ON public.program_curriculum_topics;
CREATE POLICY "Public can view curriculum topics of published programs"
  ON public.program_curriculum_topics FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.program_curriculum_sections s
      JOIN public.programs p ON p.id = s.program_id
      WHERE s.id = program_curriculum_topics.section_id
      AND p.publication_status = 'published'
    )
  );

DROP POLICY IF EXISTS "Admins have full access to curriculum topics" ON public.program_curriculum_topics;
CREATE POLICY "Admins have full access to curriculum topics"
  ON public.program_curriculum_topics FOR ALL
  USING ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = 'admin');

-- 11. IDEMPOTENT INITIAL SEED
DO $$
DECLARE
  v_program_id UUID;
  v_section_1 UUID;
  v_section_2 UUID;
  v_section_3 UUID;
BEGIN
  -- Insert Initial Academic Program
  INSERT INTO public.programs (
    id,
    name,
    slug,
    category,
    short_description,
    description,
    learning_objectives,
    target_audience,
    prerequisites,
    duration,
    delivery_mode,
    publication_status,
    enrollment_status,
    display_order
  ) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'PoraPlan Academic Program 0.1 (Beta)',
    'academic-program-0-1-beta',
    'academic_mentorship',
    'Comprehensive semester academic assistance, structured syllabus organization, daily target planning, and dedicated mentor supervision.',
    'PoraPlan Academic Program provides students with personal 1-on-1 and small-cohort academic mentorship. We review your syllabus, organize learning resources, structure daily tasks, and conduct weekly evaluations to keep you consistent and ahead of semester exams.',
    ARRAY[
      'Build consistent, disciplined daily study habits without burnout',
      'Systematic breakdown of semester syllabus and complex course outlines',
      'Weekly mentor review, doubt clearing, and continuous exam preparation'
    ],
    'Undergraduate university students seeking structured study routines and personalized academic guidance.',
    'Currently enrolled in university semester coursework. Commitment of 2-3 hours of focused daily study.',
    'Full Academic Semester (4 Months)',
    'Hybrid (Personal Online Mentorship & Asynchronous Tracking)',
    'published',
    'open',
    1
  )
  ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    short_description = EXCLUDED.short_description,
    publication_status = EXCLUDED.publication_status,
    enrollment_status = EXCLUDED.enrollment_status
  RETURNING id INTO v_program_id;

  -- Insert Initial Cohort
  INSERT INTO public.cohorts (
    id,
    program_id,
    name,
    code,
    description,
    start_date,
    end_date,
    capacity,
    status
  ) VALUES (
    'b0000000-0000-0000-0000-000000000001',
    v_program_id,
    'UU CSE Batch 67 — Fall 2026',
    'UU-CSE-B67-F26',
    'Specialized academic mentorship cohort for Uttara University CSE Batch 67 students covering core Fall 2026 courses.',
    '2026-10-01',
    '2027-02-15',
    30,
    'active'
  )
  ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    status = EXCLUDED.status;

  -- Insert Curriculum Sections
  INSERT INTO public.program_curriculum_sections (
    id,
    program_id,
    title,
    description,
    display_order
  ) VALUES (
    'c0000000-0000-0000-0000-000000000001',
    v_program_id,
    'Phase 1: Academic Onboarding & Diagnostic Routine',
    'Initial assessment of syllabus materials, study habits, and establishment of weekly study timeblocks.',
    1
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_section_1;

  INSERT INTO public.program_curriculum_sections (
    id,
    program_id,
    title,
    description,
    display_order
  ) VALUES (
    'c0000000-0000-0000-0000-000000000002',
    v_program_id,
    'Phase 2: Core Course Syllabus Roadmap & Daily Targets',
    'Deep dive into core course topics, breaking chapters into micro-tasks with assigned practice problems.',
    2
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_section_2;

  INSERT INTO public.program_curriculum_sections (
    id,
    program_id,
    title,
    description,
    display_order
  ) VALUES (
    'c0000000-0000-0000-0000-000000000003',
    v_program_id,
    'Phase 3: Midterm & Final Exam Preparation Sprints',
    'Intensive mock tests, doubt-clearing sessions, and structured revision plans.',
    3
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO v_section_3;

  -- Insert Curriculum Topics (if section was created)
  IF v_section_1 IS NOT NULL THEN
    INSERT INTO public.program_curriculum_topics (section_id, title, description, display_order)
    VALUES
      (v_section_1, '1-on-1 Academic Diagnostic Session', 'Review current academic standing, past results, and semester targets.', 1),
      (v_section_1, 'Syllabus & Lecture Note Archival', 'Collecting and cataloging course outlines, slides, and recommended textbooks.', 2),
      (v_section_1, 'Daily Study Routine Formulation', 'Setting up realistic daily study hours and notification reminders.', 3);
  END IF;

  IF v_section_2 IS NOT NULL THEN
    INSERT INTO public.program_curriculum_topics (section_id, title, description, display_order)
    VALUES
      (v_section_2, 'Weekly Target Planning', 'Mentor organizes Monday-through-Saturday tasks with specific learning outcomes.', 1),
      (v_section_2, 'Continuous Doubt Tracking', 'Posting study queries with screenshot attachments for prompt mentor resolution.', 2),
      (v_section_2, 'Weekly Evaluation & Knowledge Checks', 'Short quizzes and concept check-ins to monitor retention.', 3);
  END IF;

  IF v_section_3 IS NOT NULL THEN
    INSERT INTO public.program_curriculum_topics (section_id, title, description, display_order)
    VALUES
      (v_section_3, 'Past Exam Paper Analysis', 'Identifying high-frequency topics and question patterns.', 1),
      (v_section_3, 'Mock Exam Simulation', 'Timed practice sessions under examination conditions with mentor evaluation.', 2),
      (v_section_3, 'Final Grade Strategy & Feedback', 'Personalized post-semester academic performance debrief.', 3);
  END IF;
END $$;
