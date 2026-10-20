import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import { getStudentSubjects } from '../../lib/subjects';
import {
  getStudentStudyPlans,
  getStudyPlanById,
  createStudyPlan,
  updateStudyPlan,
  deleteStudyPlan,
  type StudyPlanWithMeta,
} from '../../lib/studyPlans';
import type { Profile, Subject, StudyPlanStatus, StudyPlanItemStatus } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Users,
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  Compass,
  ArrowRight,
  ListTodo,
  X,
  MoveUp,
  MoveDown,
} from 'lucide-react';

interface FormItemState {
  id?: string;
  title: string;
  instructions: string;
  estimated_minutes: string;
  target_date: string;
  status: StudyPlanItemStatus;
}

export const MentorPlansPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Plans & Subjects for selected student
  const [plans, setPlans] = useState<StudyPlanWithMeta[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Create/Edit Form fields
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<StudyPlanStatus>('active');
  const [formItems, setFormItems] = useState<FormItemState[]>([]);

  // Delete Confirmation State
  const [deleteTargetPlan, setDeleteTargetPlan] = useState<StudyPlanWithMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const mentorId = user?.id || '';

  // 1. Load Assigned Students Roster
  useEffect(() => {
    if (!mentorId) {
      Promise.resolve().then(() => setLoadingStudents(false));
      return;
    }
    let isMounted = true;
    getAssignedStudents(mentorId)
      .then(({ students: list, error }) => {
        if (!isMounted) return;
        if (error) {
          setErrorMessage(error.message);
        } else {
          setStudents(list);
          if (list.length > 0 && !selectedStudentId) {
            setSelectedStudentId(list[0].id);
          }
        }
        setLoadingStudents(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Error loading roster.');
        setLoadingStudents(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mentorId, selectedStudentId]);

  // 2. Load Plans & Subjects when selectedStudentId changes
  const refreshStudentData = (sId: string) => {
    if (!sId) return;
    setLoadingPlans(true);
    setErrorMessage(null);

    Promise.all([
      getStudentStudyPlans(sId),
      getStudentSubjects(sId),
    ])
      .then(([plansRes, subsRes]) => {
        if (plansRes.error) {
          setErrorMessage(plansRes.error.message);
        } else {
          setPlans(plansRes.plans);
        }
        if (subsRes.subjects) {
          setSubjects(subsRes.subjects);
        }
        setLoadingPlans(false);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Error loading student plans.');
        setLoadingPlans(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    if (!selectedStudentId) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setPlans([]);
          setSubjects([]);
        }
      });
      return () => {
        isMounted = false;
      };
    }
    Promise.all([
      getStudentStudyPlans(selectedStudentId),
      getStudentSubjects(selectedStudentId),
    ])
      .then(([plansRes, subsRes]) => {
        if (!isMounted) return;
        if (plansRes.error) {
          setErrorMessage(plansRes.error.message);
        } else {
          setPlans(plansRes.plans);
        }
        if (subsRes.subjects) {
          setSubjects(subsRes.subjects);
        }
        setLoadingPlans(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Error loading student plans.');
        setLoadingPlans(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  const activeStudent = students.find((s) => s.id === selectedStudentId);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingPlanId(null);
    setFormTitle('');
    setFormSubjectId(subjects.length > 0 ? subjects[0].id : '');
    setFormDescription('');
    setFormStatus('active');
    setFormItems([
      {
        title: '',
        instructions: '',
        estimated_minutes: '60',
        target_date: '',
        status: 'pending',
      },
    ]);
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = async (plan: StudyPlanWithMeta) => {
    setEditingPlanId(plan.id);
    setFormTitle(plan.title);
    setFormSubjectId(plan.subject_id || '');
    setFormDescription(plan.description || '');
    setFormStatus(plan.status);
    setFormError(null);

    // Fetch plan detail with items
    const { items } = await getStudyPlanById(plan.id);
    if (items && items.length > 0) {
      setFormItems(
        items.map((i) => ({
          id: i.id,
          title: i.title,
          instructions: i.instructions || '',
          estimated_minutes: i.estimated_minutes ? String(i.estimated_minutes) : '',
          target_date: i.target_date || '',
          status: i.status,
        }))
      );
    } else {
      setFormItems([
        {
          title: '',
          instructions: '',
          estimated_minutes: '60',
          target_date: '',
          status: 'pending',
        },
      ]);
    }
    setIsCreateModalOpen(true);
  };

  // Item form helpers
  const handleAddItem = () => {
    setFormItems((prev) => [
      ...prev,
      {
        title: '',
        instructions: '',
        estimated_minutes: '45',
        target_date: '',
        status: 'pending',
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    setFormItems((prev) => {
      const copy = [...prev];
      const targetIdx = direction === 'up' ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= copy.length) return prev;
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleItemChange = (index: number, field: keyof FormItemState, value: string) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Save Plan Submission (Create or Edit)
  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Plan title is required.');
      return;
    }
    if (!selectedStudentId) {
      setFormError('Please select a student from your roster.');
      return;
    }

    // Validate that at least one item has a title if items exist
    const validItems = formItems
      .filter((i) => i.title.trim().length > 0)
      .map((i) => ({
        id: i.id,
        title: i.title.trim(),
        instructions: i.instructions.trim() || undefined,
        estimated_minutes: i.estimated_minutes ? parseInt(i.estimated_minutes, 10) : undefined,
        target_date: i.target_date || undefined,
        status: i.status,
      }));

    setIsSubmitting(true);
    setFormError(null);

    try {
      if (editingPlanId) {
        // Update existing
        const { error } = await updateStudyPlan(
          editingPlanId,
          {
            title: formTitle.trim(),
            description: formDescription.trim() || undefined,
            subject_id: formSubjectId || null,
            status: formStatus,
          },
          validItems
        );

        if (error) {
          setFormError(error.message);
          setIsSubmitting(false);
          return;
        }
      } else {
        // Create new
        const { error } = await createStudyPlan({
          studentId: selectedStudentId,
          createdBy: user?.id,
          subjectId: formSubjectId || undefined,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          items: validItems,
        });

        if (error) {
          setFormError(error.message);
          setIsSubmitting(false);
          return;
        }
      }

      setIsCreateModalOpen(false);
      refreshStudentData(selectedStudentId);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save study plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Plan Deletion
  const handleDeletePlan = async () => {
    if (!deleteTargetPlan) return;
    setIsDeleting(true);

    try {
      const { error } = await deleteStudyPlan(deleteTargetPlan.id);
      if (error) {
        setErrorMessage(error.message);
      } else {
        setDeleteTargetPlan(null);
        refreshStudentData(selectedStudentId);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete plan.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section aria-labelledby="mentor-plans-title" className="border-2 border-brand-dark bg-brand-navy text-brand-paper shadow-brutal p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-brand-gold bg-brand-navy border border-brand-gold/40 px-2 py-0.5 shadow-brutal-xs">
                  STEP 1: PLAN • CURRICULUM MANAGEMENT
                </span>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-teal-light bg-brand-teal/20 border border-brand-teal/40 px-2 py-0.5">
                  Verified Mentor Access
                </span>
              </div>
              <h1 id="mentor-plans-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Study Plans &amp; Syllabus Roadmaps
              </h1>
              <p className="text-xs sm:text-sm text-brand-bg/80 font-sans max-w-2xl leading-relaxed">
                Design weekly targets, chapter milestones, and study instructions for your assigned scholars. Keep learning paced, structured, and auditable.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              disabled={loadingStudents || students.length === 0}
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            >
              Draft Study Plan
            </Button>
          </div>
        </section>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 border-2 border-brand-dark bg-red-50 text-brand-dark shadow-brutal flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-sm text-red-900">
                Study Plans Alert
              </h3>
              <p className="text-xs text-red-700 font-sans">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Student Roster Selector */}
        <section aria-labelledby="roster-selector-heading" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-teal stroke-[2.2]" />
              <h2 id="roster-selector-heading" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                Select Assigned Scholar
              </h2>
            </div>
            <span className="font-mono text-xs text-brand-muted">
              {students.length} {students.length === 1 ? 'scholar assigned' : 'scholars assigned'}
            </span>
          </div>

          {loadingStudents ? (
            <div className="py-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin text-brand-teal mx-auto mb-1" />
              <span className="font-mono text-xs text-brand-muted">Loading assigned students...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <AlertCircle className="w-6 h-6 text-brand-muted mx-auto" />
              <p className="font-heading font-bold text-xs text-brand-dark">
                No students currently assigned to your mentorship roster.
              </p>
              <p className="text-xs text-brand-muted max-w-sm mx-auto">
                Once an administrator pairs scholars with your mentor profile, their academic roadmaps will be manageable here.
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
              {students.map((student) => {
                const isSelected = student.id === selectedStudentId;
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`shrink-0 px-3.5 py-2 border-2 border-brand-dark text-left transition-all ${
                      isSelected
                        ? 'bg-brand-navy text-brand-paper shadow-brutal-sm -translate-y-0.5'
                        : 'bg-brand-bg text-brand-dark hover:bg-brand-paper shadow-brutal-xs'
                    }`}
                  >
                    <div className="font-heading font-extrabold text-xs tracking-tight">
                      {student.full_name}
                    </div>
                    <div className="font-mono text-[10px] opacity-80 mt-0.5 flex items-center gap-1">
                      <span>ID: {student.poraplan_id || 'PP001'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Student's Study Plans */}
        {selectedStudentId && activeStudent && (
          <section aria-label="Scholar study plans" className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2">
              <div>
                <h2 className="font-heading font-extrabold text-base text-brand-navy">
                  Curriculum Plans for {activeStudent.full_name}
                </h2>
                <span className="font-mono text-xs text-brand-muted">
                  Scholar PoraPlan ID: {activeStudent.poraplan_id || 'PP001'}
                </span>
              </div>

              <span className="font-mono text-xs font-bold bg-brand-paper border border-brand-dark px-2.5 py-1 shadow-brutal-xs">
                {plans.length} {plans.length === 1 ? 'Plan' : 'Plans'} Active
              </span>
            </div>

            {loadingPlans ? (
              <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
                <span className="font-mono text-xs text-brand-muted block">Loading scholar roadmaps...</span>
              </div>
            ) : plans.length === 0 ? (
              <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-8 text-center space-y-4">
                <div className="w-12 h-12 bg-brand-teal-light border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
                  <Compass className="w-6 h-6 text-brand-navy stroke-[2.2]" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="font-heading font-extrabold text-sm text-brand-navy">
                    NO STUDY PLANS DRAFTED YET
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    You have not published any study roadmaps for {activeStudent.full_name}. Create a structured milestone plan with topics and target timeframes.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={openCreateModal}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Draft First Study Plan
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plans.map((plan) => (
                  <article
                    key={plan.id}
                    className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-3">
                      {/* Card Top Strip */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {plan.subject_name ? (
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-teal-light border border-brand-dark px-2 py-0.5 text-brand-navy flex items-center gap-1">
                              <BookOpen className="w-3 h-3 text-brand-navy" />
                              {plan.subject_name}
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-bg border border-brand-dark px-2 py-0.5 text-brand-muted">
                              General Plan
                            </span>
                          )}
                          <Badge variant={plan.status === 'active' ? 'teal' : 'muted'} size="sm">
                            {plan.status.toUpperCase()}
                          </Badge>
                        </div>

                        <span className="font-mono text-[11px] font-bold text-brand-navy bg-brand-gold-light border border-brand-dark px-2 py-0.5 shadow-brutal-xs flex items-center gap-1">
                          <ListTodo className="w-3 h-3 text-brand-dark" />
                          {plan.items_count} {plan.items_count === 1 ? 'Topic' : 'Topics'}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-base sm:text-lg font-heading font-extrabold text-brand-navy">
                          {plan.title}
                        </h3>
                        <p className="text-xs text-brand-dark/85 font-sans mt-1.5 line-clamp-3 leading-relaxed">
                          {plan.description || 'No detailed learning objectives provided for this study roadmap.'}
                        </p>
                      </div>
                    </div>

                    {/* Actions Ribbon */}
                    <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Link to={`/mentor/plans/${plan.id}`}>
                          <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
                            View Roadmap
                          </Button>
                        </Link>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(plan)}
                          aria-label={`Edit ${plan.title}`}
                          className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs text-brand-navy"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetPlan(plan)}
                          aria-label={`Delete ${plan.title}`}
                          className="p-1.5 border border-brand-dark bg-red-50 hover:bg-red-100 shadow-brutal-xs text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Modal: Create or Edit Study Plan */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-6 overflow-y-auto">
            <div className="max-w-2xl w-full border-2 border-brand-dark bg-brand-paper shadow-brutal my-8 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-navy text-brand-paper flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold block">
                    {editingPlanId ? 'EDIT STUDY ROADMAP' : 'NEW STUDY ROADMAP'}
                  </span>
                  <h2 className="font-heading font-extrabold text-base sm:text-lg text-brand-bg">
                    {editingPlanId ? 'Update Curriculum Plan' : `Draft Study Plan for ${activeStudent?.full_name}`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-1 border border-brand-paper/40 hover:bg-brand-paper/10 text-brand-paper"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body / Form */}
              <form onSubmit={handleSubmitPlan} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-700 text-xs font-sans flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Plan Title */}
                <div className="space-y-1">
                  <label htmlFor="plan-title-input" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                    Plan Title *
                  </label>
                  <input
                    id="plan-title-input"
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Newtonian Dynamics & Friction Fundamentals"
                    className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                  />
                </div>

                {/* Associated Subject & Status Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="plan-subject-select" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                      Study Area / Subject
                    </label>
                    <select
                      id="plan-subject-select"
                      value={formSubjectId}
                      onChange={(e) => setFormSubjectId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                    >
                      <option value="">General (No Specific Subject)</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.code ? `(${s.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {editingPlanId && (
                    <div className="space-y-1">
                      <label htmlFor="plan-status-select" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                        Plan Status
                      </label>
                      <select
                        id="plan-status-select"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as StudyPlanStatus)}
                        className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                      >
                        <option value="active">ACTIVE</option>
                        <option value="completed">COMPLETED</option>
                        <option value="archived">ARCHIVED</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label htmlFor="plan-desc-input" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                    Roadmap Overview / Learning Goals
                  </label>
                  <textarea
                    id="plan-desc-input"
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Briefly state the academic learning goals and syllabus target for this plan..."
                    className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                  />
                </div>

                {/* Dynamic Plan Items Section */}
                <div className="pt-2 border-t-2 border-brand-dark space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-heading font-extrabold text-xs uppercase tracking-wider text-brand-navy">
                        Roadmap Topics &amp; Milestone Items
                      </h3>
                      <p className="text-[11px] text-brand-muted font-sans">
                        Sequential topics with study instructions and target duration.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="px-2.5 py-1 text-xs font-heading font-bold border border-brand-dark bg-brand-gold-light text-brand-navy hover:bg-brand-gold shadow-brutal-xs flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Topic
                    </button>
                  </div>

                  {formItems.length === 0 ? (
                    <div className="p-3 border border-dashed border-brand-dark text-center text-xs text-brand-muted">
                      No topics added yet. Click &quot;Add Topic&quot; to outline curriculum items.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {formItems.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 border-2 border-brand-dark bg-white shadow-brutal-xs space-y-2 relative"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold text-brand-navy bg-brand-teal-light px-2 py-0.5 border border-brand-dark">
                              ITEM #{idx + 1}
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => handleMoveItem(idx, 'up')}
                                className="p-1 border border-brand-dark hover:bg-brand-bg disabled:opacity-30"
                                aria-label="Move item up"
                              >
                                <MoveUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === formItems.length - 1}
                                onClick={() => handleMoveItem(idx, 'down')}
                                className="p-1 border border-brand-dark hover:bg-brand-bg disabled:opacity-30"
                                aria-label="Move item down"
                              >
                                <MoveDown className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 border border-brand-dark hover:bg-red-50 text-red-700"
                                aria-label="Remove item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <input
                              type="text"
                              required
                              value={item.title}
                              onChange={(e) => handleItemChange(idx, 'title', e.target.value)}
                              placeholder="Topic title (e.g. Newton's Second Law & Free Body Diagrams)"
                              className="w-full px-2.5 py-1.5 text-xs font-heading font-bold border border-brand-dark bg-white focus:outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={item.instructions}
                              onChange={(e) => handleItemChange(idx, 'instructions', e.target.value)}
                              placeholder="Instructions / Source (e.g. Read Giancoli Ch. 4)"
                              className="w-full px-2.5 py-1.5 text-xs font-sans border border-brand-dark bg-white focus:outline-none"
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="5"
                                step="5"
                                value={item.estimated_minutes}
                                onChange={(e) => handleItemChange(idx, 'estimated_minutes', e.target.value)}
                                placeholder="Mins (e.g. 60)"
                                className="w-24 px-2 py-1.5 text-xs font-mono border border-brand-dark bg-white focus:outline-none"
                              />
                              <input
                                type="date"
                                value={item.target_date}
                                onChange={(e) => handleItemChange(idx, 'target_date', e.target.value)}
                                className="flex-1 px-2 py-1.5 text-xs font-mono border border-brand-dark bg-white focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateModalOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isSubmitting}
                    leftIcon={isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
                  >
                    {isSubmitting ? 'Saving Plan...' : editingPlanId ? 'Update Plan' : 'Save Plan'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deleteTargetPlan && (
          <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 space-y-4">
              <div className="w-12 h-12 bg-red-100 border-2 border-brand-dark mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-700 stroke-[2.5]" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-heading font-extrabold text-base text-brand-navy">
                  Confirm Plan Deletion
                </h3>
                <p className="text-xs text-brand-dark/80 font-sans">
                  Are you sure you want to delete <strong className="font-bold text-brand-dark">{deleteTargetPlan.title}</strong>? All associated study topics will also be removed.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTargetPlan(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeletePlan}
                  disabled={isDeleting}
                  className="bg-red-700 hover:bg-red-800 text-white"
                  leftIcon={isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                >
                  {isDeleting ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
