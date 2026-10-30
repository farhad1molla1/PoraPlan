import { supabase, isSupabaseConfigured } from './supabase';
import type {
  Program,
  ProgramInsert,
  ProgramUpdate,
  Cohort,
  CohortInsert,
  CohortUpdate,
  ProgramCurriculumSection,
  ProgramCurriculumSectionInsert,
  ProgramCurriculumSectionUpdate,
  ProgramCurriculumTopic,
  ProgramCurriculumTopicInsert,
  ProgramCurriculumTopicUpdate,
  CurriculumSectionWithTopics,
  ProgramWithCurriculumAndCohorts,
  ProgramCategory,
  ProgramPublicationStatus,
  CohortStatus,
} from '../types/database';
import {
  getMockPrograms,
  getMockProgramBySlug,
  getMockProgramById,
  createMockProgram,
  updateMockProgram,
  deleteMockProgram,
  getMockCohorts,
  createMockCohort,
  updateMockCohort,
  deleteMockCohort,
  getMockProgramCurriculum,
  createMockCurriculumSection,
  updateMockCurriculumSection,
  deleteMockCurriculumSection,
  reorderMockCurriculumSections,
  createMockCurriculumTopic,
  updateMockCurriculumTopic,
  deleteMockCurriculumTopic,
  reorderMockCurriculumTopics,
} from './mockAuthStore';

// ==============================================================================
// Helper utilities and labels
// ==============================================================================

export function getProgramCategoryLabel(category: ProgramCategory): string {
  switch (category) {
    case 'academic_mentorship':
      return 'Academic Mentorship';
    case 'skillsprint':
      return 'SkillSprint';
    default:
      return category;
  }
}

export function getProgramPublicationBadgeVariant(
  status: ProgramPublicationStatus
): 'teal' | 'paper' | 'muted' {
  switch (status) {
    case 'published':
      return 'teal';
    case 'draft':
      return 'paper';
    case 'archived':
      return 'muted';
    default:
      return 'paper';
  }
}

export function getCohortStatusBadgeVariant(
  status: CohortStatus
): 'teal' | 'gold' | 'navy' | 'muted' {
  switch (status) {
    case 'active':
      return 'teal';
    case 'planned':
      return 'gold';
    case 'completed':
      return 'navy';
    case 'archived':
      return 'muted';
    default:
      return 'gold';
  }
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ==============================================================================
// Program Service Operations
// ==============================================================================

export async function getPrograms(options?: {
  category?: string;
  status?: string;
  includeUnpublished?: boolean;
}): Promise<{ programs: Program[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { programs: getMockPrograms(options), error: null };
  }

  try {
    let query = supabase.from('programs').select('*');

    if (!options?.includeUnpublished) {
      query = query.eq('publication_status', 'published');
    }

    if (options?.category && options.category !== 'all') {
      query = query.eq('category', options.category as ProgramCategory);
    }

    if (options?.status && options.status !== 'all') {
      query = query.eq('publication_status', options.status as ProgramPublicationStatus);
    }

    query = query.order('display_order', { ascending: true });

    const { data, error } = await query;
    if (error) return { programs: [], error };

    return { programs: (data as Program[]) || [], error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { programs: [], error };
  }
}

export async function getProgramBySlug(
  slug: string
): Promise<{ program: Program | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { program: getMockProgramBySlug(slug), error: null };
  }

  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (error) return { program: null, error };
    return { program: (data as Program) || null, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { program: null, error };
  }
}

export async function getProgramById(
  id: string
): Promise<{ program: Program | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { program: getMockProgramById(id), error: null };
  }

  try {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) return { program: null, error };
    return { program: (data as Program) || null, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { program: null, error };
  }
}

export async function getProgramWithFullDetails(
  slugOrId: string
): Promise<{ program: ProgramWithCurriculumAndCohorts | null; error: Error | null }> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId);
  const { program, error } = isUuid
    ? await getProgramById(slugOrId)
    : await getProgramBySlug(slugOrId);

  if (error || !program) {
    return { program: null, error: error || new Error('Program not found') };
  }

  const [cohortsRes, curriculumRes] = await Promise.all([
    getCohorts(program.id),
    getProgramCurriculum(program.id),
  ]);

  return {
    program: {
      ...program,
      cohorts: cohortsRes.cohorts,
      curriculum: curriculumRes.curriculum,
    },
    error: null,
  };
}

export async function createProgram(
  program: ProgramInsert
): Promise<{ program: Program | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return createMockProgram(program);
  }

  try {
    const { data, error } = await supabase
      .from('programs')
      .insert(program)
      .select()
      .single();

    if (error) return { program: null, error };
    return { program: data as Program, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { program: null, error };
  }
}

export async function updateProgram(
  id: string,
  updates: ProgramUpdate
): Promise<{ program: Program | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return updateMockProgram(id, updates);
  }

  try {
    const { data, error } = await supabase
      .from('programs')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { program: null, error };
    return { program: data as Program, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { program: null, error };
  }
}

export async function deleteProgram(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return deleteMockProgram(id);
  }

  try {
    const { error } = await supabase.from('programs').delete().eq('id', id);
    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

// ==============================================================================
// Cohort Service Operations
// ==============================================================================

export async function getCohorts(
  programId?: string
): Promise<{ cohorts: Cohort[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { cohorts: getMockCohorts(programId), error: null };
  }

  try {
    let query = supabase.from('cohorts').select('*');
    if (programId) {
      query = query.eq('program_id', programId);
    }
    query = query.order('start_date', { ascending: false });

    const { data, error } = await query;
    if (error) return { cohorts: [], error };
    return { cohorts: (data as Cohort[]) || [], error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { cohorts: [], error };
  }
}

export async function createCohort(
  cohort: CohortInsert
): Promise<{ cohort: Cohort | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return createMockCohort(cohort);
  }

  try {
    const { data, error } = await supabase
      .from('cohorts')
      .insert({
        ...cohort,
        code: cohort.code.trim().toUpperCase(),
      })
      .select()
      .single();

    if (error) return { cohort: null, error };
    return { cohort: data as Cohort, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { cohort: null, error };
  }
}

export async function updateCohort(
  id: string,
  updates: CohortUpdate
): Promise<{ cohort: Cohort | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return updateMockCohort(id, updates);
  }

  try {
    const payload = { ...updates, updated_at: new Date().toISOString() };
    if (payload.code) {
      payload.code = payload.code.trim().toUpperCase();
    }

    const { data, error } = await supabase
      .from('cohorts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return { cohort: null, error };
    return { cohort: data as Cohort, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { cohort: null, error };
  }
}

export async function deleteCohort(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return deleteMockCohort(id);
  }

  try {
    const { error } = await supabase.from('cohorts').delete().eq('id', id);
    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

// ==============================================================================
// Curriculum Service Operations
// ==============================================================================

export async function getProgramCurriculum(
  programId: string
): Promise<{ curriculum: CurriculumSectionWithTopics[]; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { curriculum: getMockProgramCurriculum(programId), error: null };
  }

  try {
    const { data: sections, error: secError } = await supabase
      .from('program_curriculum_sections')
      .select('*')
      .eq('program_id', programId)
      .order('display_order', { ascending: true });

    if (secError) return { curriculum: [], error: secError };
    if (!sections || sections.length === 0) return { curriculum: [], error: null };

    const sectionIds = sections.map((s) => s.id);
    const { data: topics, error: topError } = await supabase
      .from('program_curriculum_topics')
      .select('*')
      .in('section_id', sectionIds)
      .order('display_order', { ascending: true });

    if (topError) return { curriculum: [], error: topError };

    const topicList = (topics as ProgramCurriculumTopic[]) || [];
    const grouped: CurriculumSectionWithTopics[] = sections.map((sec) => ({
      ...(sec as ProgramCurriculumSection),
      topics: topicList.filter((t) => t.section_id === sec.id),
    }));

    return { curriculum: grouped, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { curriculum: [], error };
  }
}

export async function createCurriculumSection(
  section: ProgramCurriculumSectionInsert
): Promise<{ section: ProgramCurriculumSection | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return createMockCurriculumSection(section);
  }

  try {
    const { data, error } = await supabase
      .from('program_curriculum_sections')
      .insert(section)
      .select()
      .single();

    if (error) return { section: null, error };
    return { section: data as ProgramCurriculumSection, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { section: null, error };
  }
}

export async function updateCurriculumSection(
  id: string,
  updates: ProgramCurriculumSectionUpdate
): Promise<{ section: ProgramCurriculumSection | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return updateMockCurriculumSection(id, updates);
  }

  try {
    const { data, error } = await supabase
      .from('program_curriculum_sections')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { section: null, error };
    return { section: data as ProgramCurriculumSection, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { section: null, error };
  }
}

export async function deleteCurriculumSection(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return deleteMockCurriculumSection(id);
  }

  try {
    const { error } = await supabase
      .from('program_curriculum_sections')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

export async function reorderCurriculumSections(
  programId: string,
  sectionIds: string[]
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return reorderMockCurriculumSections(programId, sectionIds);
  }

  try {
    const updates = sectionIds.map((id, index) =>
      supabase
        .from('program_curriculum_sections')
        .update({ display_order: index + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    await Promise.all(updates);
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

export async function createCurriculumTopic(
  topic: ProgramCurriculumTopicInsert
): Promise<{ topic: ProgramCurriculumTopic | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return createMockCurriculumTopic(topic);
  }

  try {
    const { data, error } = await supabase
      .from('program_curriculum_topics')
      .insert(topic)
      .select()
      .single();

    if (error) return { topic: null, error };
    return { topic: data as ProgramCurriculumTopic, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { topic: null, error };
  }
}

export async function updateCurriculumTopic(
  id: string,
  updates: ProgramCurriculumTopicUpdate
): Promise<{ topic: ProgramCurriculumTopic | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return updateMockCurriculumTopic(id, updates);
  }

  try {
    const { data, error } = await supabase
      .from('program_curriculum_topics')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return { topic: null, error };
    return { topic: data as ProgramCurriculumTopic, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { topic: null, error };
  }
}

export async function deleteCurriculumTopic(
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return deleteMockCurriculumTopic(id);
  }

  try {
    const { error } = await supabase
      .from('program_curriculum_topics')
      .delete()
      .eq('id', id);

    if (error) return { success: false, error };
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}

export async function reorderCurriculumTopics(
  sectionId: string,
  topicIds: string[]
): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return reorderMockCurriculumTopics(sectionId, topicIds);
  }

  try {
    const updates = topicIds.map((id, index) =>
      supabase
        .from('program_curriculum_topics')
        .update({ display_order: index + 1, updated_at: new Date().toISOString() })
        .eq('id', id)
    );

    await Promise.all(updates);
    return { success: true, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    return { success: false, error };
  }
}
