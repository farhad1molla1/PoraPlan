import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  getPrograms,
  createProgram,
  updateProgram,
  deleteProgram,
  getCohorts,
  createCohort,
  updateCohort,
  deleteCohort,
  getProgramCurriculum,
  createCurriculumSection,
  updateCurriculumSection,
  deleteCurriculumSection,
  reorderCurriculumSections,
  createCurriculumTopic,
  updateCurriculumTopic,
  deleteCurriculumTopic,
  getProgramCategoryLabel,
  generateSlug,
} from '../../lib/programs';
import type {
  Program,
  ProgramInsert,
  Cohort,
  CohortInsert,
  ProgramCurriculumSection,
  CurriculumSectionWithTopics,
  ProgramCategory,
  ProgramPublicationStatus,
  ProgramEnrollmentStatus,
  CohortStatus,
} from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Layers,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
  ArrowUp,
  ArrowDown,
  Eye,
  Loader2,
  Clock,
  Laptop,
} from 'lucide-react';

export const AdminProgramsPage: React.FC = () => {
  const { user } = useAuth();

  // State: Programs & Filter
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<'all' | ProgramCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | ProgramPublicationStatus>('all');

  // Modals & Active Selections
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  const [cohortModalOpen, setCohortModalOpen] = useState(false);
  const [selectedProgramForCohorts, setSelectedProgramForCohorts] = useState<Program | null>(null);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);

  const [curriculumModalOpen, setCurriculumModalOpen] = useState(false);
  const [selectedProgramForCurriculum, setSelectedProgramForCurriculum] = useState<Program | null>(null);
  const [curriculumSections, setCurriculumSections] = useState<CurriculumSectionWithTopics[]>([]);
  const [editingSection, setEditingSection] = useState<ProgramCurriculumSection | null>(null);
  const [sectionModalOpen, setSectionModalOpen] = useState(false);

  const [editingTopic, setEditingTopic] = useState<{ sectionId: string; topic?: any } | null>(null);
  const [topicModalOpen, setTopicModalOpen] = useState(false);

  // Form State: Program
  const [programForm, setProgramForm] = useState<ProgramInsert>({
    name: '',
    slug: '',
    category: 'academic_mentorship',
    short_description: '',
    description: '',
    learning_objectives: [],
    target_audience: '',
    prerequisites: '',
    duration: '',
    delivery_mode: '',
    publication_status: 'draft',
    enrollment_status: 'closed',
    display_order: 1,
  });
  const [objectivesInput, setObjectivesInput] = useState('');

  // Form State: Cohort
  const [cohortForm, setCohortForm] = useState<CohortInsert>({
    program_id: '',
    name: '',
    code: '',
    description: '',
    start_date: '',
    end_date: '',
    capacity: 30,
    status: 'planned',
  });

  // Form State: Section
  const [sectionForm, setSectionForm] = useState({
    title: '',
    description: '',
  });

  // Form State: Topic
  const [topicForm, setTopicForm] = useState({
    title: '',
    description: '',
  });

  // Load Data
  const loadData = async () => {
    try {
      const [progRes, cohRes] = await Promise.all([
        getPrograms({ includeUnpublished: true }),
        getCohorts(),
      ]);

      if (progRes.error) {
        setError(progRes.error.message);
      } else {
        setPrograms(progRes.programs);
        setCohorts(cohRes.cohorts);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load program data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const [progRes, cohRes] = await Promise.all([
          getPrograms({ includeUnpublished: true }),
          getCohorts(),
        ]);
        if (!isMounted) return;
        if (progRes.error) {
          setError(progRes.error.message);
        } else {
          setPrograms(progRes.programs);
          setCohorts(cohRes.cohorts);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load program data');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered Programs
  const filteredPrograms = programs.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && p.publication_status !== statusFilter) return false;
    return true;
  });

  // Notifications timeout
  useEffect(() => {
    if (successMessage) {
      const t = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(t);
    }
  }, [successMessage]);

  // --- Program Handlers ---
  const handleOpenCreateProgram = () => {
    setEditingProgram(null);
    setProgramForm({
      name: '',
      slug: '',
      category: 'academic_mentorship',
      short_description: '',
      description: '',
      learning_objectives: [],
      target_audience: '',
      prerequisites: '',
      duration: '',
      delivery_mode: '',
      publication_status: 'draft',
      enrollment_status: 'closed',
      display_order: programs.length + 1,
    });
    setObjectivesInput('');
    setProgramModalOpen(true);
  };

  const handleOpenEditProgram = (prog: Program) => {
    setEditingProgram(prog);
    setProgramForm({
      name: prog.name,
      slug: prog.slug,
      category: prog.category,
      short_description: prog.short_description,
      description: prog.description || '',
      learning_objectives: prog.learning_objectives || [],
      target_audience: prog.target_audience || '',
      prerequisites: prog.prerequisites || '',
      duration: prog.duration || '',
      delivery_mode: prog.delivery_mode || '',
      publication_status: prog.publication_status,
      enrollment_status: prog.enrollment_status,
      display_order: prog.display_order,
    });
    setObjectivesInput((prog.learning_objectives || []).join('\n'));
    setProgramModalOpen(true);
  };

  const handleProgramNameChange = (name: string) => {
    if (!editingProgram) {
      setProgramForm((prev) => ({
        ...prev,
        name,
        slug: generateSlug(name),
      }));
    } else {
      setProgramForm((prev) => ({ ...prev, name }));
    }
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programForm.name.trim() || !programForm.slug.trim()) {
      setError('Program name and slug are required.');
      return;
    }

    const objectives = objectivesInput
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const payload: ProgramInsert = {
      ...programForm,
      learning_objectives: objectives,
      created_by: user?.id,
    };

    if (editingProgram) {
      const res = await updateProgram(editingProgram.id, payload);
      if (res.error) {
        setError(res.error.message);
      } else {
        setSuccessMessage(`Program '${payload.name}' updated successfully.`);
        setProgramModalOpen(false);
        loadData();
      }
    } else {
      const res = await createProgram(payload);
      if (res.error) {
        setError(res.error.message);
      } else {
        setSuccessMessage(`Program '${payload.name}' created successfully.`);
        setProgramModalOpen(false);
        loadData();
      }
    }
  };

  const handleDeleteProgram = async (prog: Program) => {
    if (!window.confirm(`Are you sure you want to delete program '${prog.name}'? This will also remove associated cohorts and curriculum.`)) {
      return;
    }

    const res = await deleteProgram(prog.id);
    if (res.error) {
      setError(res.error.message);
    } else {
      setSuccessMessage(`Program '${prog.name}' removed.`);
      loadData();
    }
  };

  const handleTogglePublication = async (prog: Program) => {
    const nextStatus: ProgramPublicationStatus =
      prog.publication_status === 'published' ? 'draft' : 'published';

    const res = await updateProgram(prog.id, { publication_status: nextStatus });
    if (res.error) {
      setError(res.error.message);
    } else {
      setSuccessMessage(`Program status changed to ${nextStatus.toUpperCase()}`);
      loadData();
    }
  };

  const handleToggleEnrollment = async (prog: Program) => {
    const nextStatus: ProgramEnrollmentStatus =
      prog.enrollment_status === 'open' ? 'closed' : 'open';

    const res = await updateProgram(prog.id, { enrollment_status: nextStatus });
    if (res.error) {
      setError(res.error.message);
    } else {
      setSuccessMessage(`Enrollment is now ${nextStatus.toUpperCase()}`);
      loadData();
    }
  };

  // --- Cohort Handlers ---
  const handleOpenCohorts = (prog: Program) => {
    setSelectedProgramForCohorts(prog);
    setCohortModalOpen(true);
  };

  const handleOpenCreateCohort = () => {
    if (!selectedProgramForCohorts) return;
    setEditingCohort(null);
    setCohortForm({
      program_id: selectedProgramForCohorts.id,
      name: '',
      code: '',
      description: '',
      start_date: '',
      end_date: '',
      capacity: 30,
      status: 'planned',
    });
  };

  const handleSaveCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cohortForm.name.trim() || !cohortForm.code.trim()) {
      setError('Cohort name and code are required.');
      return;
    }

    if (editingCohort) {
      const res = await updateCohort(editingCohort.id, cohortForm);
      if (res.error) {
        setError(res.error.message);
      } else {
        setSuccessMessage('Cohort updated successfully.');
        setEditingCohort(null);
        loadData();
      }
    } else {
      const res = await createCohort({
        ...cohortForm,
        program_id: selectedProgramForCohorts!.id,
        created_by: user?.id,
      });
      if (res.error) {
        setError(res.error.message);
      } else {
        setSuccessMessage('Cohort created successfully.');
        handleOpenCreateCohort();
        loadData();
      }
    }
  };

  const handleDeleteCohort = async (cohortId: string) => {
    if (!window.confirm('Are you sure you want to delete this cohort?')) return;
    const res = await deleteCohort(cohortId);
    if (res.error) {
      setError(res.error.message);
    } else {
      setSuccessMessage('Cohort deleted.');
      loadData();
    }
  };

  // --- Curriculum Handlers ---
  const handleOpenCurriculum = async (prog: Program) => {
    setSelectedProgramForCurriculum(prog);
    setCurriculumModalOpen(true);
    await reloadCurriculum(prog.id);
  };

  const reloadCurriculum = async (programId: string) => {
    const res = await getProgramCurriculum(programId);
    if (res.error) {
      setError(res.error.message);
    } else {
      setCurriculumSections(res.curriculum);
    }
  };

  const handleOpenCreateSection = () => {
    setEditingSection(null);
    setSectionForm({ title: '', description: '' });
    setSectionModalOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgramForCurriculum || !sectionForm.title.trim()) return;

    if (editingSection) {
      const res = await updateCurriculumSection(editingSection.id, {
        title: sectionForm.title.trim(),
        description: sectionForm.description.trim() || null,
      });
      if (res.error) setError(res.error.message);
      else setSuccessMessage('Module updated.');
    } else {
      const res = await createCurriculumSection({
        program_id: selectedProgramForCurriculum.id,
        title: sectionForm.title.trim(),
        description: sectionForm.description.trim() || null,
        display_order: curriculumSections.length + 1,
      });
      if (res.error) setError(res.error.message);
      else setSuccessMessage('Module added.');
    }

    setSectionModalOpen(false);
    await reloadCurriculum(selectedProgramForCurriculum.id);
  };

  const handleDeleteSection = async (secId: string) => {
    if (!window.confirm('Delete this section and its topics?')) return;
    const res = await deleteCurriculumSection(secId);
    if (res.error) setError(res.error.message);
    else {
      setSuccessMessage('Section removed.');
      await reloadCurriculum(selectedProgramForCurriculum!.id);
    }
  };

  const handleMoveSection = async (index: number, direction: 'up' | 'down') => {
    if (!selectedProgramForCurriculum) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= curriculumSections.length) return;

    const reordered = [...curriculumSections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(newIndex, 0, moved);

    setCurriculumSections(reordered);
    await reorderCurriculumSections(
      selectedProgramForCurriculum.id,
      reordered.map((s) => s.id)
    );
  };

  // Topic handlers
  const handleOpenCreateTopic = (sectionId: string) => {
    setEditingTopic({ sectionId });
    setTopicForm({ title: '', description: '' });
    setTopicModalOpen(true);
  };

  const handleSaveTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTopic || !topicForm.title.trim()) return;

    if (editingTopic.topic) {
      const res = await updateCurriculumTopic(editingTopic.topic.id, {
        title: topicForm.title.trim(),
        description: topicForm.description.trim() || null,
      });
      if (res.error) setError(res.error.message);
      else setSuccessMessage('Topic updated.');
    } else {
      const sec = curriculumSections.find((s) => s.id === editingTopic.sectionId);
      const res = await createCurriculumTopic({
        section_id: editingTopic.sectionId,
        title: topicForm.title.trim(),
        description: topicForm.description.trim() || null,
        display_order: (sec?.topics.length || 0) + 1,
      });
      if (res.error) setError(res.error.message);
      else setSuccessMessage('Topic added.');
    }

    setTopicModalOpen(false);
    await reloadCurriculum(selectedProgramForCurriculum!.id);
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!window.confirm('Delete this topic?')) return;
    const res = await deleteCurriculumTopic(topicId);
    if (res.error) setError(res.error.message);
    else {
      setSuccessMessage('Topic deleted.');
      await reloadCurriculum(selectedProgramForCurriculum!.id);
    }
  };

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Top Header Ribbon */}
        <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-6 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                ADMIN CONSOLE
              </span>
              <Badge variant="navy" size="sm" className="bg-brand-paper text-brand-dark">
                PROGRAM MANAGEMENT
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              Programs, Cohorts &amp; Curriculum
            </h1>
            <p className="font-mono text-xs text-brand-bg/75">
              Configure unified Academic Mentorship and SkillSprint offerings.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateProgram}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create New Program
          </Button>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="p-3.5 border-2 border-brand-dark bg-emerald-50 text-emerald-950 flex items-center gap-3 shadow-brutal-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-3 shadow-brutal-xs">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-wrap items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-brand-muted uppercase font-bold mr-1">Category:</span>
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 font-mono text-xs border ${
                categoryFilter === 'all'
                  ? 'bg-brand-navy text-white border-brand-dark font-bold'
                  : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
              }`}
            >
              All ({programs.length})
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('academic_mentorship')}
              className={`px-3 py-1 font-mono text-xs border ${
                categoryFilter === 'academic_mentorship'
                  ? 'bg-brand-gold text-brand-dark border-brand-dark font-bold'
                  : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
              }`}
            >
              Academic Mentorship
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('skillsprint')}
              className={`px-3 py-1 font-mono text-xs border ${
                categoryFilter === 'skillsprint'
                  ? 'bg-brand-teal text-white border-brand-dark font-bold'
                  : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
              }`}
            >
              SkillSprint
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-brand-muted uppercase font-bold mr-1">Status:</span>
            {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2.5 py-1 font-mono text-xs uppercase border ${
                  statusFilter === st
                    ? 'bg-brand-dark text-white border-brand-dark font-bold'
                    : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Program Cards List */}
        {loading ? (
          <div className="p-12 text-center border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
            <p className="font-mono text-xs text-brand-muted">Loading programs...</p>
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="p-10 text-center border-2 border-brand-dark bg-brand-paper shadow-brutal space-y-2">
            <p className="font-heading font-extrabold text-brand-navy">No Programs Matching Filter</p>
            <p className="font-sans text-xs text-brand-muted">Click "Create New Program" to provision your first offering.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPrograms.map((prog) => {
              const progCohorts = cohorts.filter((c) => c.program_id === prog.id);
              const isPublished = prog.publication_status === 'published';
              const isEnrollmentOpen = prog.enrollment_status === 'open';

              return (
                <div
                  key={prog.id}
                  className="p-5 sm:p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={prog.category === 'academic_mentorship' ? 'gold' : 'teal'}
                        size="sm"
                      >
                        {getProgramCategoryLabel(prog.category)}
                      </Badge>

                      <Badge
                        variant={isPublished ? 'teal' : prog.publication_status === 'draft' ? 'paper' : 'muted'}
                        size="sm"
                      >
                        {prog.publication_status.toUpperCase()}
                      </Badge>

                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 border ${
                          isEnrollmentOpen
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-700'
                            : 'bg-red-50 text-red-800 border-red-700'
                        }`}
                      >
                        ENROLLMENT {prog.enrollment_status.toUpperCase()}
                      </span>

                      <span className="font-mono text-xs text-brand-muted ml-1">
                        Slug: <strong className="text-brand-dark">{prog.slug}</strong>
                      </span>
                    </div>

                    {/* Quick Toggles */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePublication(prog)}
                        className="px-2.5 py-1 border border-brand-dark bg-brand-paper-tint text-[11px] font-mono hover:bg-brand-paper shadow-brutal-xs"
                        title="Toggle publication state"
                      >
                        {isPublished ? 'Unpublish' : 'Publish'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleEnrollment(prog)}
                        className="px-2.5 py-1 border border-brand-dark bg-brand-paper-tint text-[11px] font-mono hover:bg-brand-paper shadow-brutal-xs"
                        title="Toggle enrollment availability"
                      >
                        {isEnrollmentOpen ? 'Close Enrollment' : 'Open Enrollment'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="font-heading font-extrabold text-xl text-brand-navy">
                      {prog.name}
                    </h2>
                    <p className="font-sans text-xs sm:text-sm text-brand-dark/80">
                      {prog.short_description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-brand-muted border-t border-brand-dark/20 pt-3">
                    {prog.duration && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-brand-teal" />
                        {prog.duration}
                      </span>
                    )}
                    {prog.delivery_mode && (
                      <span className="flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-brand-navy" />
                        {prog.delivery_mode}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 font-bold text-brand-dark">
                      <Users className="w-3.5 h-3.5 text-brand-gold" />
                      {progCohorts.length} Cohorts
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t-2 border-brand-dark flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCohorts(prog)}
                        leftIcon={<Users className="w-3.5 h-3.5 text-brand-navy" />}
                      >
                        Manage Cohorts ({progCohorts.length})
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCurriculum(prog)}
                        leftIcon={<Layers className="w-3.5 h-3.5 text-brand-teal" />}
                      >
                        Curriculum Builder
                      </Button>

                      {isPublished && (
                        <Button
                          to={`/programs/${prog.slug}`}
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                        >
                          Public Preview
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditProgram(prog)}
                        className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-brand-dark shadow-brutal-xs"
                        title="Edit program"
                        aria-label="Edit program"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProgram(prog)}
                        className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-red-50 text-red-600 shadow-brutal-xs"
                        title="Delete program"
                        aria-label="Delete program"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: Create / Edit Program */}
      {programModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                {editingProgram ? 'Edit Program Offering' : 'Create New Program Offering'}
              </h3>
              <button
                type="button"
                onClick={() => setProgramModalOpen(false)}
                className="p-1 border border-brand-dark bg-brand-paper-tint"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">
                    Program Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={programForm.name}
                    onChange={(e) => handleProgramNameChange(e.target.value)}
                    placeholder="e.g. Academic Mentorship 0.1 (Beta)"
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">
                    Program Slug <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={programForm.slug}
                    onChange={(e) => setProgramForm((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="e.g. academic-program-beta"
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Category</label>
                  <select
                    value={programForm.category}
                    onChange={(e) =>
                      setProgramForm((prev) => ({ ...prev, category: e.target.value as ProgramCategory }))
                    }
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                  >
                    <option value="academic_mentorship">Academic Mentorship</option>
                    <option value="skillsprint">SkillSprint</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Publication</label>
                  <select
                    value={programForm.publication_status}
                    onChange={(e) =>
                      setProgramForm((prev) => ({
                        ...prev,
                        publication_status: e.target.value as ProgramPublicationStatus,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                  >
                    <option value="draft">Draft (Hidden)</option>
                    <option value="published">Published (Visible)</option>
                    <option value="archived">Archived (Hidden)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Enrollment</label>
                  <select
                    value={programForm.enrollment_status}
                    onChange={(e) =>
                      setProgramForm((prev) => ({
                        ...prev,
                        enrollment_status: e.target.value as ProgramEnrollmentStatus,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs uppercase font-bold block">
                  Short Description <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={programForm.short_description}
                  onChange={(e) => setProgramForm((prev) => ({ ...prev, short_description: e.target.value }))}
                  placeholder="Summary for catalog card preview..."
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs uppercase font-bold block">Detailed Overview</label>
                <textarea
                  rows={3}
                  value={programForm.description || ''}
                  onChange={(e) => setProgramForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="In-depth description of the mentoring or sprint structure..."
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Duration</label>
                  <input
                    type="text"
                    value={programForm.duration || ''}
                    onChange={(e) => setProgramForm((prev) => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g. 4 Months (Full Semester)"
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Delivery Mode</label>
                  <input
                    type="text"
                    value={programForm.delivery_mode || ''}
                    onChange={(e) => setProgramForm((prev) => ({ ...prev, delivery_mode: e.target.value }))}
                    placeholder="e.g. Hybrid Mentorship & Tracking"
                    className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs uppercase font-bold block">
                  Learning Objectives (one per line)
                </label>
                <textarea
                  rows={3}
                  value={objectivesInput}
                  onChange={(e) => setObjectivesInput(e.target.value)}
                  placeholder="Master core topics&#10;Systematic syllabus coverage&#10;Weekly doubt clearing"
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-white font-sans font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-brand-dark">
                <Button variant="outline" size="sm" onClick={() => setProgramModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" leftIcon={<Save className="w-3.5 h-3.5" />}>
                  {editingProgram ? 'Update Program' : 'Create Program'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Manage Cohorts for Program */}
      {cohortModalOpen && selectedProgramForCohorts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-6 space-y-6 my-8">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  Cohort Desk
                </span>
                <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                  Cohorts for {selectedProgramForCohorts.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCohortModalOpen(false)}
                className="p-1 border border-brand-dark bg-brand-paper-tint"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Existing Cohorts */}
            <div className="space-y-3">
              <h4 className="font-heading font-bold text-sm text-brand-navy">
                Associated Batches / Cohorts
              </h4>
              {cohorts.filter((c) => c.program_id === selectedProgramForCohorts.id).length === 0 ? (
                <p className="p-4 border border-brand-dark bg-brand-paper-tint text-xs font-mono text-brand-muted text-center">
                  No cohorts created under this program yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {cohorts
                    .filter((c) => c.program_id === selectedProgramForCohorts.id)
                    .map((cohort) => (
                      <div
                        key={cohort.id}
                        className="p-3 border-2 border-brand-dark bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-brand-teal px-1.5 py-0.2 border border-brand-dark bg-brand-paper-tint">
                              {cohort.code}
                            </span>
                            <span className="font-bold text-brand-navy">{cohort.name}</span>
                            <Badge
                              variant={cohort.status === 'active' ? 'teal' : cohort.status === 'planned' ? 'gold' : 'paper'}
                              size="sm"
                            >
                              {cohort.status.toUpperCase()}
                            </Badge>
                          </div>
                          <span className="font-mono text-[11px] text-brand-muted block">
                            Dates: {cohort.start_date || 'TBD'} to {cohort.end_date || 'TBD'} • Capacity: {cohort.capacity || 'Unlimited'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCohort(cohort);
                              setCohortForm({ ...cohort });
                            }}
                            className="p-1 border border-brand-dark bg-brand-paper text-brand-dark hover:bg-brand-paper-tint"
                            title="Edit cohort"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCohort(cohort.id)}
                            className="p-1 border border-brand-dark bg-brand-paper text-red-600 hover:bg-red-50"
                            title="Delete cohort"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Cohort Form (Create / Edit) */}
            <form onSubmit={handleSaveCohort} className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-3">
              <h4 className="font-heading font-extrabold text-xs uppercase tracking-wider text-brand-navy">
                {editingCohort ? 'Edit Cohort' : 'Add New Cohort'}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">
                    Cohort Name <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cohortForm.name}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. UU CSE Batch 67 — Fall 2026"
                    className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-sans"
                  />
                </div>

                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">
                    Cohort Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={cohortForm.code}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="e.g. UU-CSE-B67-F26"
                    className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={cohortForm.start_date || ''}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">End Date</label>
                  <input
                    type="date"
                    value={cohortForm.end_date || ''}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">Status</label>
                  <select
                    value={cohortForm.status}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, status: e.target.value as CohortStatus }))}
                    className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-sans"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {editingCohort && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingCohort(null);
                      handleOpenCreateCohort();
                    }}
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button type="submit" variant="primary" size="sm" leftIcon={<Save className="w-3.5 h-3.5" />}>
                  {editingCohort ? 'Update Cohort' : 'Save Cohort'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Curriculum Builder */}
      {curriculumModalOpen && selectedProgramForCurriculum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-6 space-y-6 my-8">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  Curriculum Builder
                </span>
                <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                  Curriculum for {selectedProgramForCurriculum.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCurriculumModalOpen(false)}
                className="p-1 border border-brand-dark bg-brand-paper-tint"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-sans text-xs text-brand-muted">
                Modules are presented sequentially to students and mentors.
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateSection}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
              >
                Add Module / Section
              </Button>
            </div>

            {/* Sections & Topics List */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {curriculumSections.length === 0 ? (
                <div className="p-8 border-2 border-brand-dark bg-brand-paper-tint text-center font-mono text-xs text-brand-muted">
                  No curriculum sections added yet. Click "Add Module / Section" to begin.
                </div>
              ) : (
                curriculumSections.map((sec, sIdx) => (
                  <div
                    key={sec.id}
                    className="border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs overflow-hidden"
                  >
                    {/* Section Header */}
                    <div className="p-3 bg-brand-navy text-white flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-gold">
                          Module {sIdx + 1}:
                        </span>
                        <h4 className="font-heading font-bold text-sm text-white truncate max-w-md">
                          {sec.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={sIdx === 0}
                          onClick={() => handleMoveSection(sIdx, 'up')}
                          className="p-1 text-white hover:bg-white/10 disabled:opacity-30"
                          title="Move section up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={sIdx === curriculumSections.length - 1}
                          onClick={() => handleMoveSection(sIdx, 'down')}
                          className="p-1 text-white hover:bg-white/10 disabled:opacity-30"
                          title="Move section down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSection(sec);
                            setSectionForm({ title: sec.title, description: sec.description || '' });
                            setSectionModalOpen(true);
                          }}
                          className="p-1 text-white hover:bg-white/10 ml-1"
                          title="Edit module"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(sec.id)}
                          className="p-1 text-red-400 hover:bg-white/10"
                          title="Delete module"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Topics Sublist */}
                    <div className="p-3 space-y-2 bg-brand-paper">
                      {sec.description && (
                        <p className="font-sans text-xs text-brand-muted pb-1 border-b border-brand-dark/15">
                          {sec.description}
                        </p>
                      )}

                      <div className="space-y-1.5">
                        {sec.topics.map((t, tIdx) => (
                          <div
                            key={t.id}
                            className="p-2 border border-brand-dark/30 bg-brand-paper-tint flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-start gap-2">
                              <span className="font-mono text-[10px] font-bold text-brand-teal mt-0.5">
                                {sIdx + 1}.{tIdx + 1}
                              </span>
                              <div>
                                <span className="font-bold text-brand-navy">{t.title}</span>
                                {t.description && (
                                  <p className="text-[11px] text-brand-muted">{t.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTopic({ sectionId: sec.id, topic: t });
                                  setTopicForm({ title: t.title, description: t.description || '' });
                                  setTopicModalOpen(true);
                                }}
                                className="p-1 hover:bg-black/5"
                                title="Edit topic"
                              >
                                <Edit className="w-3 h-3 text-brand-dark" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(t.id)}
                                className="p-1 hover:bg-red-50 text-red-600"
                                title="Delete topic"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenCreateTopic(sec.id)}
                        leftIcon={<Plus className="w-3 h-3 text-brand-teal" />}
                        className="text-xs text-brand-teal font-bold"
                      >
                        Add Topic to this Module
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Add / Edit Section */}
      {sectionModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2">
              <h4 className="font-heading font-extrabold text-sm text-brand-navy">
                {editingSection ? 'Edit Module' : 'Add Curriculum Module'}
              </h4>
              <button type="button" onClick={() => setSectionModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="space-y-3">
              <div>
                <label className="font-mono text-xs uppercase font-bold block mb-1">
                  Module Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={sectionForm.title}
                  onChange={(e) => setSectionForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. Phase 1: Academic Diagnostic & Setup"
                  className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-sans"
                />
              </div>

              <div>
                <label className="font-mono text-xs uppercase font-bold block mb-1">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Outline the scope of this learning block..."
                  className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/20">
                <Button variant="outline" size="sm" onClick={() => setSectionModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save Module
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Add / Edit Topic */}
      {topicModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal p-5 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2">
              <h4 className="font-heading font-extrabold text-sm text-brand-navy">
                {editingTopic?.topic ? 'Edit Topic' : 'Add Curriculum Topic'}
              </h4>
              <button type="button" onClick={() => setTopicModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="space-y-3">
              <div>
                <label className="font-mono text-xs uppercase font-bold block mb-1">
                  Topic Title <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={topicForm.title}
                  onChange={(e) => setTopicForm((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g. 1-on-1 Academic Diagnostic Session"
                  className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-sans"
                />
              </div>

              <div>
                <label className="font-mono text-xs uppercase font-bold block mb-1">
                  Topic Details (optional)
                </label>
                <textarea
                  rows={2}
                  value={topicForm.description}
                  onChange={(e) => setTopicForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Specific learning outcome or required activity..."
                  className="w-full px-2.5 py-1.5 text-xs border border-brand-dark bg-white font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-brand-dark/20">
                <Button variant="outline" size="sm" onClick={() => setTopicModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Save Topic
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
