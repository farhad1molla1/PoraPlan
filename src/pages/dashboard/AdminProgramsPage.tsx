import React, { useState, useEffect, useRef } from 'react';
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
  uploadProgramThumbnail,
  deleteProgramThumbnail,
  uploadCohortThumbnail,
  deleteCohortThumbnail,
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
  CohortPublicationStatus,
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
  Image as ImageIcon,
  Upload,
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

  // Form State: Thumbnail
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    publication_status: 'draft',
  });

  // Form State: Cohort Thumbnail
  const [cohortThumbnailFile, setCohortThumbnailFile] = useState<File | null>(null);
  const [cohortThumbnailPreview, setCohortThumbnailPreview] = useState<string | null>(null);
  const [cohortThumbnailError, setCohortThumbnailError] = useState<string | null>(null);
  const cohortFileInputRef = useRef<HTMLInputElement | null>(null);

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
        getCohorts(undefined, { includeArchived: true }),
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
          getCohorts(undefined, { includeArchived: true }),
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

  // Modal Escape key and body scroll lock for builder modals
  useEffect(() => {
    if (!sectionModalOpen && !topicModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (topicModalOpen) {
          setTopicModalOpen(false);
        } else if (sectionModalOpen) {
          setSectionModalOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [sectionModalOpen, topicModalOpen]);

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
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    setThumbnailFile(null);
    setThumbnailPreview(prog.cover_image_url || null);
    setThumbnailError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setProgramModalOpen(true);
  };

  const handleThumbnailFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setThumbnailError('Invalid file format. Only PNG, JPEG, and WebP are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setThumbnailError('File exceeds 5MB maximum size limit.');
      return;
    }

    setThumbnailError(null);
    setThumbnailFile(file);
    const objectUrl = URL.createObjectURL(file);
    setThumbnailPreview(objectUrl);
  };

  const handleRemoveThumbnail = () => {
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setThumbnailError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        if (thumbnailFile) {
          const thumbRes = await uploadProgramThumbnail(editingProgram.id, thumbnailFile);
          if (thumbRes.error) {
            setError(`Program updated, but thumbnail upload failed: ${thumbRes.error.message}`);
          }
        } else if (editingProgram.cover_image_url && !thumbnailPreview) {
          await deleteProgramThumbnail(editingProgram.id, editingProgram.cover_image_url);
        }
        setSuccessMessage(`Program '${payload.name}' updated successfully.`);
        setProgramModalOpen(false);
        loadData();
      }
    } else {
      const res = await createProgram(payload);
      if (res.error) {
        setError(res.error.message);
      } else {
        if (thumbnailFile && res.program) {
          const thumbRes = await uploadProgramThumbnail(res.program.id, thumbnailFile);
          if (thumbRes.error) {
            setError(`Program created, but thumbnail upload failed: ${thumbRes.error.message}`);
          }
        }
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

    if (prog.cover_image_url) {
      await deleteProgramThumbnail(prog.id, prog.cover_image_url);
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
    handleOpenCreateCohort();
    setCohortModalOpen(true);
  };

  const handleCohortThumbnailFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setCohortThumbnailError('Invalid file format. Only PNG, JPEG, and WebP are allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setCohortThumbnailError('File exceeds 5MB maximum size limit.');
      return;
    }

    setCohortThumbnailError(null);
    setCohortThumbnailFile(file);
    const objectUrl = URL.createObjectURL(file);
    setCohortThumbnailPreview(objectUrl);
  };

  const handleRemoveCohortThumbnail = () => {
    setCohortThumbnailFile(null);
    setCohortThumbnailPreview(null);
    setCohortThumbnailError(null);
    if (cohortFileInputRef.current) {
      cohortFileInputRef.current.value = '';
    }
  };

  const handleOpenCreateCohort = () => {
    setEditingCohort(null);
    setCohortForm({
      program_id: selectedProgramForCohorts ? selectedProgramForCohorts.id : '',
      name: '',
      code: '',
      description: '',
      start_date: '',
      end_date: '',
      capacity: 30,
      status: 'planned',
      publication_status: 'draft',
    });
    setCohortThumbnailFile(null);
    setCohortThumbnailPreview(null);
    setCohortThumbnailError(null);
    if (cohortFileInputRef.current) cohortFileInputRef.current.value = '';
  };

  const handleOpenEditCohort = (cohort: Cohort) => {
    setEditingCohort(cohort);
    setCohortForm({
      program_id: cohort.program_id,
      name: cohort.name,
      code: cohort.code,
      description: cohort.description || '',
      start_date: cohort.start_date || '',
      end_date: cohort.end_date || '',
      capacity: cohort.capacity || 30,
      status: cohort.status,
      publication_status: cohort.publication_status || 'draft',
    });
    setCohortThumbnailFile(null);
    setCohortThumbnailPreview(cohort.cover_image_url || null);
    setCohortThumbnailError(null);
    if (cohortFileInputRef.current) cohortFileInputRef.current.value = '';
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
        if (cohortThumbnailFile) {
          const thumbRes = await uploadCohortThumbnail(editingCohort.id, cohortThumbnailFile);
          if (thumbRes.error) {
            setError(`Cohort updated, but thumbnail upload failed: ${thumbRes.error.message}`);
          }
        } else if (editingCohort.cover_image_url && !cohortThumbnailPreview) {
          await deleteCohortThumbnail(editingCohort.id, editingCohort.cover_image_url);
        }
        setSuccessMessage('Cohort updated successfully.');
        handleOpenCreateCohort();
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
        if (cohortThumbnailFile && res.cohort) {
          const thumbRes = await uploadCohortThumbnail(res.cohort.id, cohortThumbnailFile);
          if (thumbRes.error) {
            setError(`Cohort created, but thumbnail upload failed: ${thumbRes.error.message}`);
          }
        }
        setSuccessMessage('Cohort created successfully.');
        handleOpenCreateCohort();
        loadData();
      }
    }
  };

  const handleToggleCohortPublication = async (cohort: Cohort) => {
    const nextPubStatus: CohortPublicationStatus =
      cohort.publication_status === 'published' ? 'draft' : 'published';
    const res = await updateCohort(cohort.id, { publication_status: nextPubStatus });
    if (res.error) {
      setError(res.error.message);
    } else {
      setSuccessMessage(
        nextPubStatus === 'published'
          ? `Cohort '${cohort.name}' published (academic status remains '${cohort.status}').`
          : `Cohort '${cohort.name}' unpublished (academic status remains '${cohort.status}').`
      );
      loadData();
    }
  };

  const handleDeleteCohort = async (cohort: Cohort) => {
    if (!window.confirm(`Are you sure you want to delete cohort '${cohort.name}'?`)) return;
    if (cohort.cover_image_url) {
      await deleteCohortThumbnail(cohort.id, cohort.cover_image_url);
    }
    const res = await deleteCohort(cohort.id);
    if (res.error) {
      setError(res.error.message);
    } else {
      setSuccessMessage('Cohort deleted.');
      if (editingCohort?.id === cohort.id) {
        handleOpenCreateCohort();
      }
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
    <div className="w-full py-3 sm:py-8 px-2.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-screen">
      <div className="max-w-6xl mx-auto space-y-3 sm:space-y-6">

        {/* Top Header Ribbon */}
        <div className="border sm:border-2 border-brand-dark bg-brand-navy text-brand-bg p-2.5 sm:p-6 shadow-none sm:shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4">
          <div className="space-y-0.5 sm:space-y-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-mono text-[10px] sm:text-xs uppercase text-brand-gold font-bold tracking-wider">
                ADMIN CONSOLE
              </span>
              <Badge variant="navy" size="sm" className="bg-brand-paper text-brand-dark text-[8px] sm:text-[9px]">
                PROGRAM MANAGEMENT
              </Badge>
            </div>
            <h1 className="text-base sm:text-2xl md:text-3xl font-extrabold font-heading text-brand-bg">
              Programs, Cohorts &amp; Curriculum
            </h1>
            <p className="font-mono text-[10px] sm:text-xs text-brand-bg/75">
              Configure unified Academic Mentorship and SkillSprint offerings.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateProgram}
            leftIcon={<Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            className="w-full sm:w-auto min-h-[34px] sm:min-h-0 text-[11px] sm:text-xs py-1 px-2.5 sm:py-1.5 sm:px-3"
          >
            Create New Program
          </Button>
        </div>

        {/* Global Notifications */}
        {successMessage && (
          <div className="p-2.5 sm:p-3.5 border sm:border-2 border-brand-dark bg-emerald-50 text-emerald-950 flex items-center gap-2 sm:gap-3 shadow-none sm:shadow-brutal-xs">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{successMessage}</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 sm:p-3.5 border sm:border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-2 sm:gap-3 shadow-none sm:shadow-brutal-xs">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{error}</span>
          </div>
        )}

        {/* Filters Bar */}
        <div className="p-2 sm:p-4 border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-2 sm:gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <span className="font-mono text-[10px] sm:text-xs text-brand-muted uppercase font-bold mr-0.5 sm:mr-1">Category:</span>
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className={`px-2 sm:px-3 py-1 sm:py-1 min-h-[32px] sm:min-h-0 font-mono text-[10px] sm:text-xs border motion-reduce:transition-none ${
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
              className={`px-2 sm:px-3 py-1 sm:py-1 min-h-[32px] sm:min-h-0 font-mono text-[10px] sm:text-xs border motion-reduce:transition-none ${
                categoryFilter === 'academic_mentorship'
                  ? 'bg-brand-gold text-brand-dark border-brand-dark font-bold'
                  : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
              }`}
            >
              Academic Programs
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter('skillsprint')}
              className={`px-2 sm:px-3 py-1 sm:py-1 min-h-[32px] sm:min-h-0 font-mono text-[10px] sm:text-xs border motion-reduce:transition-none ${
                categoryFilter === 'skillsprint'
                  ? 'bg-brand-teal text-white border-brand-dark font-bold'
                  : 'bg-brand-paper-tint text-brand-dark border-brand-dark/40 hover:bg-brand-paper'
              }`}
            >
              Upskilling Programs
            </button>
          </div>

          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <span className="font-mono text-[10px] sm:text-xs text-brand-muted uppercase font-bold mr-0.5 sm:mr-1">Status:</span>
            {(['all', 'published', 'draft', 'archived'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-1 sm:py-1 min-h-[32px] sm:min-h-0 font-mono text-[10px] sm:text-xs uppercase border motion-reduce:transition-none ${
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
          <div className="p-8 sm:p-12 text-center border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal space-y-2 sm:space-y-3">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin motion-reduce:animate-none text-brand-teal mx-auto" />
            <p className="font-mono text-xs text-brand-muted">Loading programs...</p>
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="p-6 sm:p-10 text-center border sm:border-2 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal space-y-1.5 sm:space-y-2">
            <p className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">No Programs Matching Filter</p>
            <p className="font-sans text-[11px] sm:text-xs text-brand-muted">Click "Create New Program" to provision your first offering.</p>
          </div>
        ) : (
          <div className="space-y-2.5 sm:space-y-4">
            {filteredPrograms.map((prog) => {
              const progCohorts = cohorts.filter((c) => c.program_id === prog.id);
              const isPublished = prog.publication_status === 'published';
              const isEnrollmentOpen = prog.enrollment_status === 'open';

              return (
                <div
                  key={prog.id}
                  className="p-2.5 sm:p-6 border sm:border-3 border-brand-dark bg-brand-paper shadow-none sm:shadow-brutal space-y-2 sm:space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 border-b sm:border-b-2 border-brand-dark pb-2 sm:pb-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                        className={`font-mono text-[10px] sm:text-[11px] font-bold px-1.5 sm:px-2 py-0.5 border ${isEnrollmentOpen
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-700'
                          : 'bg-red-50 text-red-800 border-red-700'
                          }`}
                      >
                        ENROLLMENT {prog.enrollment_status.toUpperCase()}
                      </span>

                      <span className="font-mono text-[10px] sm:text-xs text-brand-muted ml-0.5 sm:ml-1">
                        Slug: <strong className="text-brand-dark">{prog.slug}</strong>
                      </span>
                    </div>

                    {/* Quick Toggles */}
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePublication(prog)}
                        className="px-2 sm:px-2.5 py-0.5 sm:py-1 border border-brand-dark bg-brand-paper-tint text-[10px] sm:text-[11px] font-mono hover:bg-brand-paper shadow-none sm:shadow-brutal-xs"
                        title="Toggle publication state"
                      >
                        {isPublished ? 'Unpublish' : 'Publish'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleEnrollment(prog)}
                        className="px-2 sm:px-2.5 py-0.5 sm:py-1 border border-brand-dark bg-brand-paper-tint text-[10px] sm:text-[11px] font-mono hover:bg-brand-paper shadow-none sm:shadow-brutal-xs"
                        title="Toggle enrollment availability"
                      >
                        {isEnrollmentOpen ? 'Close Enrollment' : 'Open Enrollment'}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-4 items-start">
                    {prog.cover_image_url ? (
                      <div className="w-full sm:w-44 h-24 sm:h-28 shrink-0 overflow-hidden border sm:border-2 border-brand-dark bg-brand-paper-tint">
                        <img
                          src={prog.cover_image_url}
                          alt={prog.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-full sm:w-44 h-24 sm:h-28 shrink-0 border border-dashed sm:border-2 border-brand-dark/30 bg-brand-paper-tint flex flex-col items-center justify-center gap-1 text-brand-muted">
                        <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5 stroke-[1.5]" />
                        <span className="font-mono text-[10px] sm:text-[11px]">No Thumbnail</span>
                      </div>
                    )}
                    <div className="space-y-1 sm:space-y-1.5 flex-1 min-w-0">
                      <h2 className="font-heading font-extrabold text-sm sm:text-xl text-brand-navy">
                        {prog.name}
                      </h2>
                      <p className="font-sans text-[11px] sm:text-sm text-brand-dark/80 line-clamp-3">
                        {prog.short_description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1 sm:gap-y-2 font-mono text-[10px] sm:text-xs text-brand-muted border-t border-brand-dark/20 pt-2 sm:pt-3">
                    {prog.duration && (
                      <span className="flex items-center gap-1 sm:gap-1.5">
                        <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-brand-teal" />
                        {prog.duration}
                      </span>
                    )}
                    {prog.delivery_mode && (
                      <span className="flex items-center gap-1 sm:gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-brand-navy" />
                        {prog.delivery_mode}
                      </span>
                    )}
                    <span className="flex items-center gap-1 sm:gap-1.5 font-bold text-brand-dark">
                      <Users className="w-3.5 h-3.5 text-brand-gold" />
                      {progCohorts.length} {prog.category === 'skillsprint' ? 'Courses / Cohorts' : 'Cohorts'}
                    </span>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-2 sm:pt-3 border-t sm:border-t-2 border-brand-dark flex flex-wrap items-center justify-between gap-2 sm:gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCohorts(prog)}
                        leftIcon={<Users className="w-3.5 h-3.5 text-brand-navy" />}
                        className="min-h-[32px] sm:min-h-0 text-[11px] sm:text-xs py-1 px-2.5 sm:py-1.5 sm:px-3"
                      >
                        {prog.category === 'skillsprint' ? 'Manage Courses / Runs' : 'Manage Cohorts'} ({progCohorts.length})
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenCurriculum(prog)}
                        leftIcon={<Layers className="w-3.5 h-3.5 text-brand-teal" />}
                        className="min-h-[32px] sm:min-h-0 text-[11px] sm:text-xs py-1 px-2.5 sm:py-1.5 sm:px-3"
                      >
                        Curriculum Builder
                      </Button>

                      {isPublished && (
                        <Button
                          to={`/programs/${prog.slug}`}
                          variant="ghost"
                          size="sm"
                          leftIcon={<Eye className="w-3.5 h-3.5" />}
                          className="min-h-[32px] sm:min-h-0 text-[11px] sm:text-xs py-1 px-2.5 sm:py-1.5 sm:px-3"
                        >
                          Public Preview
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEditProgram(prog)}
                        className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-brand-dark shadow-none sm:shadow-brutal-xs flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                        title="Edit program"
                        aria-label="Edit program"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteProgram(prog)}
                        className="min-w-[34px] min-h-[34px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-1.5 border border-brand-dark bg-brand-paper hover:bg-red-50 text-red-600 shadow-none sm:shadow-brutal-xs flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-brand-paper border-2 sm:border-3 border-brand-dark shadow-brutal-sm sm:shadow-brutal-lg p-5 sm:p-6 space-y-5 my-8">
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
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
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
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Parent Category</label>
                  <select
                    value={programForm.category}
                    onChange={(e) =>
                      setProgramForm((prev) => ({ ...prev, category: e.target.value as ProgramCategory }))
                    }
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
                  >
                    <option value="academic_mentorship">Academic Program (Academic Mentorship Cohorts)</option>
                    <option value="skillsprint">Upskilling Program (SkillSprint Courses)</option>
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
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
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
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
                  >
                    <option value="open">Open</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>

              {/* Thumbnail Management */}
              <div className="space-y-2 border-2 border-brand-dark bg-brand-paper-tint p-4">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-xs uppercase font-bold text-brand-navy flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-brand-teal" />
                    Program Thumbnail
                  </label>
                  <span className="font-mono text-[10px] text-brand-muted">Max 5MB (PNG, JPG, WebP)</span>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleThumbnailFileSelect}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-label="Upload program thumbnail"
                />

                {thumbnailPreview ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[16/9] w-full max-h-48 overflow-hidden border-2 border-brand-dark bg-brand-dark/5">
                      <img
                        src={thumbnailPreview}
                        alt="Program thumbnail preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        leftIcon={<Upload className="w-3.5 h-3.5" />}
                      >
                        Replace Image
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveThumbnail}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-brand-dark/40 bg-brand-paper p-6 text-center cursor-pointer hover:border-brand-dark hover:bg-brand-paper transition-colors space-y-1.5"
                  >
                    <ImageIcon className="w-8 h-8 text-brand-muted mx-auto stroke-[1.5]" />
                    <p className="font-mono text-xs font-bold text-brand-dark">Click to upload thumbnail</p>
                    <p className="font-sans text-[11px] text-brand-muted">Recommended aspect ratio: 16:9 for clean catalog card rendering</p>
                  </div>
                )}

                {thumbnailError && (
                  <div className="p-2 border border-red-600 bg-red-50 text-red-900 font-mono text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span>{thumbnailError}</span>
                  </div>
                )}
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
                  className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
                />
              </div>

              <div className="space-y-1">
                <label className="font-mono text-xs uppercase font-bold block">Detailed Overview</label>
                <textarea
                  rows={3}
                  value={programForm.description || ''}
                  onChange={(e) => setProgramForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="In-depth description of the mentoring or sprint structure..."
                  className="w-full px-3 py-2 text-base sm:text-xs border-2 border-brand-dark bg-brand-paper font-sans leading-relaxed"
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
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono text-xs uppercase font-bold block">Delivery Mode</label>
                  <input
                    type="text"
                    value={programForm.delivery_mode || ''}
                    onChange={(e) => setProgramForm((prev) => ({ ...prev, delivery_mode: e.target.value }))}
                    placeholder="e.g. Hybrid Mentorship & Tracking"
                    className="w-full px-3 py-2 text-base sm:text-xs min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper font-sans"
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
                  className="w-full px-3 py-2 text-base sm:text-xs border-2 border-brand-dark bg-brand-paper font-sans font-mono"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-brand-paper border-2 sm:border-3 border-brand-dark shadow-brutal-sm sm:shadow-brutal-lg p-4 sm:p-6 space-y-4 sm:space-y-6 my-auto sm:my-8 max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3 shrink-0">
              <div className="min-w-0 pr-2">
                <span className="font-mono text-[11px] uppercase font-bold text-brand-muted block">
                  Cohort Desk
                </span>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy truncate">
                  Cohorts for {selectedProgramForCohorts.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCohortModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center border border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shrink-0"
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
                        className="p-3 border-2 border-brand-dark bg-brand-paper flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {cohort.cover_image_url ? (
                            <div className="w-16 h-10 border border-brand-dark/30 overflow-hidden shrink-0 bg-brand-paper-tint">
                              <img src={cohort.cover_image_url} alt={cohort.name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-16 h-10 border border-dashed border-brand-dark/30 flex items-center justify-center shrink-0 bg-brand-paper-tint text-brand-muted">
                              <ImageIcon className="w-4 h-4 stroke-[1.5]" />
                            </div>
                          )}
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-brand-teal px-1.5 py-0.2 border border-brand-dark bg-brand-paper-tint">
                                {cohort.code}
                              </span>
                              <span className="font-bold text-brand-navy truncate">{cohort.name}</span>
                              <Badge
                                variant={cohort.status === 'active' ? 'teal' : cohort.status === 'planned' ? 'gold' : 'navy'}
                                size="sm"
                              >
                                {cohort.status.toUpperCase()}
                              </Badge>
                              <Badge
                                variant={cohort.publication_status === 'published' ? 'teal' : cohort.publication_status === 'draft' ? 'paper' : 'muted'}
                                size="sm"
                              >
                                {(cohort.publication_status || 'draft').toUpperCase()}
                              </Badge>
                            </div>
                            <span className="font-mono text-[11px] text-brand-muted block truncate">
                              Dates: {cohort.start_date || 'TBD'} to {cohort.end_date || 'TBD'} • Capacity: {cohort.capacity || 'Unlimited'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCohortPublication(cohort)}
                            className="px-2 py-1 border border-brand-dark bg-brand-paper-tint hover:bg-brand-paper text-[10px] font-mono shadow-brutal-xs"
                            title={cohort.publication_status === 'published' ? 'Unpublish cohort' : 'Publish cohort'}
                          >
                            {cohort.publication_status === 'published' ? 'Unpublish' : 'Publish'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEditCohort(cohort)}
                            className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-1 border border-brand-dark bg-brand-paper text-brand-dark hover:bg-brand-paper-tint shadow-brutal-xs flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                            title="Edit cohort"
                            aria-label={`Edit ${cohort.name}`}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCohort(cohort)}
                            className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 sm:p-1 border border-brand-dark bg-brand-paper text-red-600 hover:bg-red-50 shadow-brutal-xs flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
                            title="Delete cohort"
                            aria-label={`Delete ${cohort.name}`}
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
                {editingCohort ? `Edit Cohort: ${editingCohort.name}` : 'Add New Cohort'}
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
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-sans"
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
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-mono uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono text-[11px] font-bold block mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  value={cohortForm.description || ''}
                  onChange={(e) => setCohortForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this cohort or course run..."
                  className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs border border-brand-dark bg-brand-paper font-sans"
                />
              </div>

              {/* Cohort Independent Thumbnail */}
              <div className="space-y-2 border border-brand-dark bg-brand-paper p-3">
                <div className="flex items-center justify-between">
                  <label className="font-mono text-[11px] uppercase font-bold text-brand-navy flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-brand-teal" />
                    Cohort Thumbnail
                  </label>
                  <span className="font-mono text-[10px] text-brand-muted">Max 5MB (PNG, JPG, WebP)</span>
                </div>

                <input
                  type="file"
                  ref={cohortFileInputRef}
                  onChange={handleCohortThumbnailFileSelect}
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  aria-label="Upload cohort thumbnail"
                />

                {cohortThumbnailPreview ? (
                  <div className="space-y-2">
                    <div className="relative aspect-[16/9] w-full max-h-36 overflow-hidden border border-brand-dark bg-brand-dark/5">
                      <img
                        src={cohortThumbnailPreview}
                        alt="Cohort thumbnail preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => cohortFileInputRef.current?.click()}
                        leftIcon={<Upload className="w-3.5 h-3.5" />}
                      >
                        Replace Image
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveCohortThumbnail}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => cohortFileInputRef.current?.click()}
                    className="border border-dashed border-brand-dark/40 bg-brand-paper-tint p-3 text-center cursor-pointer hover:border-brand-dark transition-colors space-y-1"
                  >
                    <ImageIcon className="w-5 h-5 text-brand-muted mx-auto stroke-[1.5]" />
                    <p className="font-mono text-[11px] font-bold text-brand-dark">Click to upload cohort thumbnail</p>
                    <p className="font-sans text-[10px] text-brand-muted">Independent from Program thumbnail (16:9 ratio)</p>
                  </div>
                )}

                {cohortThumbnailError && (
                  <div className="p-2 border border-red-600 bg-red-50 text-red-900 font-mono text-[11px]">
                    {cohortThumbnailError}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={cohortForm.start_date || ''}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">End Date</label>
                  <input
                    type="date"
                    value={cohortForm.end_date || ''}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-mono"
                  />
                </div>

                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">Academic Status</label>
                  <select
                    value={cohortForm.status}
                    onChange={(e) => setCohortForm((prev) => ({ ...prev, status: e.target.value as CohortStatus }))}
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-sans"
                  >
                    <option value="planned">Planned</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="font-mono text-[11px] font-bold block mb-1">Publication Status</label>
                  <select
                    value={cohortForm.publication_status}
                    onChange={(e) =>
                      setCohortForm((prev) => ({
                        ...prev,
                        publication_status: e.target.value as CohortPublicationStatus,
                      }))
                    }
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-sans"
                  >
                    <option value="draft">Draft (Private)</option>
                    <option value="published">Published (Public)</option>
                    <option value="archived">Archived (Hidden)</option>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl bg-brand-paper border-2 sm:border-3 border-brand-dark shadow-brutal-sm sm:shadow-brutal-lg p-4 sm:p-6 space-y-4 sm:space-y-6 my-auto sm:my-8 max-h-[92dvh] flex flex-col">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3 shrink-0">
              <div className="min-w-0 pr-2">
                <span className="font-mono text-[11px] uppercase font-bold text-brand-muted block">
                  Curriculum Builder
                </span>
                <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy truncate">
                  Curriculum for {selectedProgramForCurriculum.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCurriculumModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center border border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shrink-0 cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0">
              <span className="font-sans text-xs text-brand-muted">
                Modules are presented sequentially to students and mentors.
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleOpenCreateSection}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto"
              >
                Add Module / Section
              </Button>
            </div>

            {/* Sections & Topics List */}
            <div className="space-y-4 flex-1 overflow-y-auto pr-1">
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
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-brand-gold shrink-0">
                          Module {sIdx + 1}:
                        </span>
                        <h4 className="font-heading font-bold text-sm text-white truncate max-w-xs sm:max-w-md">
                          {sec.title}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={sIdx === 0}
                          onClick={() => handleMoveSection(sIdx, 'up')}
                          className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 rounded-xs cursor-pointer"
                          title="Move section up"
                          aria-label="Move section up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={sIdx === curriculumSections.length - 1}
                          onClick={() => handleMoveSection(sIdx, 'down')}
                          className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-white hover:bg-white/10 disabled:opacity-30 rounded-xs cursor-pointer"
                          title="Move section down"
                          aria-label="Move section down"
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
                          className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-white hover:bg-white/10 ml-0.5 rounded-xs cursor-pointer"
                          title="Edit module"
                          aria-label="Edit module"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSection(sec.id)}
                          className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center text-red-400 hover:bg-white/10 rounded-xs cursor-pointer"
                          title="Delete module"
                          aria-label="Delete module"
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
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="font-mono text-[10px] font-bold text-brand-teal mt-0.5 shrink-0">
                                {sIdx + 1}.{tIdx + 1}
                              </span>
                              <div className="min-w-0">
                                <span className="font-bold text-brand-navy block truncate">{t.title}</span>
                                {t.description && (
                                  <p className="text-[11px] text-brand-muted line-clamp-2">{t.description}</p>
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
                                className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center hover:bg-black/5 rounded-xs cursor-pointer"
                                title="Edit topic"
                                aria-label="Edit topic"
                              >
                                <Edit className="w-3.5 h-3.5 text-brand-dark" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTopic(t.id)}
                                className="min-w-[36px] min-h-[36px] p-2 flex items-center justify-center hover:bg-red-50 text-red-600 rounded-xs cursor-pointer"
                                title="Delete topic"
                                aria-label="Delete topic"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
        <div
          className="fixed inset-0 z-60 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-brand-dark/60 backdrop-blur-xs overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingSection ? 'Edit Module' : 'Add Curriculum Module'}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSectionModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md max-h-[90dvh] sm:max-h-[85dvh] flex flex-col bg-brand-paper border-t-2 sm:border-3 border-brand-dark rounded-t-2xl sm:rounded-none shadow-brutal-sm sm:shadow-brutal p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle Affordance */}
            <div className="w-12 h-1.5 bg-brand-dark/25 rounded-full mx-auto mb-2.5 sm:hidden shrink-0" aria-hidden="true" />

            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2 shrink-0">
              <h4 className="font-heading font-extrabold text-sm text-brand-navy">
                {editingSection ? 'Edit Module' : 'Add Curriculum Module'}
              </h4>
              <button
                type="button"
                onClick={() => setSectionModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2 -mr-2 -mt-1 flex items-center justify-center border border-brand-dark bg-brand-paper-tint hover:bg-brand-paper cursor-pointer"
                aria-label="Close module modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="overflow-y-auto flex-1 pr-1 space-y-3">
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
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-sans"
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
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs border border-brand-dark bg-brand-paper font-sans"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-brand-dark/20 shrink-0">
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
        <div
          className="fixed inset-0 z-60 flex flex-col justify-end sm:justify-center sm:items-center p-0 sm:p-4 bg-brand-dark/60 backdrop-blur-xs overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label={editingTopic?.topic ? 'Edit Topic' : 'Add Curriculum Topic'}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setTopicModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md max-h-[90dvh] sm:max-h-[85dvh] flex flex-col bg-brand-paper border-t-2 sm:border-3 border-brand-dark rounded-t-2xl sm:rounded-none shadow-brutal-sm sm:shadow-brutal p-4 sm:p-5 pb-[max(1rem,env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Drag Handle Affordance */}
            <div className="w-12 h-1.5 bg-brand-dark/25 rounded-full mx-auto mb-2.5 sm:hidden shrink-0" aria-hidden="true" />

            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2 shrink-0">
              <h4 className="font-heading font-extrabold text-sm text-brand-navy">
                {editingTopic?.topic ? 'Edit Topic' : 'Add Curriculum Topic'}
              </h4>
              <button
                type="button"
                onClick={() => setTopicModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2 -mr-2 -mt-1 flex items-center justify-center border border-brand-dark bg-brand-paper-tint hover:bg-brand-paper cursor-pointer"
                aria-label="Close topic modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTopic} className="flex-1 flex flex-col min-h-0 pt-3">
              <div className="overflow-y-auto flex-1 pr-1 space-y-3">
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
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs min-h-[44px] sm:min-h-0 border border-brand-dark bg-brand-paper font-sans"
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
                    className="w-full px-2.5 py-2 sm:py-1.5 text-base sm:text-xs border border-brand-dark bg-brand-paper font-sans"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 mt-3 border-t border-brand-dark/20 shrink-0">
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
