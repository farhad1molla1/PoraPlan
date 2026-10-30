import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import {
  getStudentSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
} from '../../lib/subjects';
import type { Profile, Subject, SubjectStatus } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ArrowRight,
  ArrowLeft,
  Calendar,
  GraduationCap,
} from 'lucide-react';

export const MentorSubjectsPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);

  // Form States
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStatus, setFormStatus] = useState<SubjectStatus>('active');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // 1. Fetch assigned students on mount
  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    getAssignedStudents(user.id).then(({ students: list, error }) => {
      if (!isMounted) return;
      if (error) {
        setErrorMessage(error.message);
      } else {
        setStudents(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0].id);
        }
      }
      setLoadingStudents(false);
    });
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // 2. Fetch subjects whenever selected student changes
  const loadSubjectsForStudent = useCallback(async (sId: string) => {
    if (!sId) return;
    setLoadingSubjects(true);
    setErrorMessage(null);
    const { subjects: list, error } = await getStudentSubjects(sId);
    if (error) {
      setErrorMessage(error.message);
    } else {
      setSubjects(list);
    }
    setLoadingSubjects(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (!selectedStudentId) {
      Promise.resolve().then(() => {
        if (isMounted) setSubjects([]);
      });
      return () => {
        isMounted = false;
      };
    }
    getStudentSubjects(selectedStudentId).then(({ subjects: list, error }) => {
      if (!isMounted) return;
      if (error) {
        setErrorMessage(error.message);
      } else {
        setSubjects(list);
      }
      setLoadingSubjects(false);
    });
    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  const activeStudent = students.find((s) => s.id === selectedStudentId);

  // Open Create Modal
  const openCreateModal = () => {
    setFormName('');
    setFormCode('');
    setFormDesc('');
    setFormStatus('active');
    setFormError(null);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setFormName(subject.name);
    setFormCode(subject.code || '');
    setFormDesc(subject.description || '');
    setFormStatus(subject.status);
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Open Delete Modal
  const openDeleteModal = (subject: Subject) => {
    setSelectedSubject(subject);
    setIsDeleteModalOpen(true);
  };

  // Handle Create Subject
  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Please enter a study area name.');
      return;
    }

    if (!selectedStudentId) {
      setFormError('No student selected.');
      return;
    }

    setFormSubmitting(true);
    try {
      const { subject, error } = await createSubject({
        studentId: selectedStudentId,
        name: cleanName,
        code: formCode.trim() || undefined,
        description: formDesc.trim() || undefined,
        createdBy: user?.id,
      });

      if (error || !subject) {
        setFormError(error?.message || 'Failed to create study area.');
        return;
      }

      setSuccessMessage(`Study area "${subject.name}" successfully created.`);
      setIsCreateModalOpen(false);
      await loadSubjectsForStudent(selectedStudentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error creating study area.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Edit Subject
  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;
    setFormError(null);

    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Study area name cannot be empty.');
      return;
    }

    setFormSubmitting(true);
    try {
      const { subject, error } = await updateSubject(selectedSubject.id, {
        name: cleanName,
        code: formCode.trim() || undefined,
        description: formDesc.trim() || undefined,
        status: formStatus,
      });

      if (error || !subject) {
        setFormError(error?.message || 'Failed to update study area.');
        return;
      }

      setSuccessMessage(`Study area "${subject.name}" updated successfully.`);
      setIsEditModalOpen(false);
      await loadSubjectsForStudent(selectedStudentId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error updating study area.';
      setFormError(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  // Handle Delete Subject
  const handleDeleteSubject = async () => {
    if (!selectedSubject) return;
    setFormSubmitting(true);
    try {
      const { success, error } = await deleteSubject(selectedSubject.id);
      if (!success || error) {
        setErrorMessage(error?.message || 'Failed to delete study area.');
      } else {
        setSuccessMessage(`Study area "${selectedSubject.name}" deleted.`);
        setIsDeleteModalOpen(false);
        await loadSubjectsForStudent(selectedStudentId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error deleting study area.';
      setErrorMessage(msg);
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section
          aria-labelledby="mentor-subjects-heading"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Link
                  to="/mentor/dashboard"
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase font-bold text-brand-gold hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  Mentor Dashboard
                </Link>
                <span className="text-brand-bg/50 font-mono text-xs">/</span>
                <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                  SUBJECTS
                </span>
              </div>

              <h1 id="mentor-subjects-heading" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Subjects
              </h1>

              <p className="text-xs sm:text-sm text-brand-bg/85 font-sans max-w-2xl leading-relaxed">
                Configure syllabus subjects for your assigned students based on their university coursework.
              </p>
            </div>

            <div className="shrink-0">
              <Button
                variant="primary"
                size="md"
                onClick={openCreateModal}
                disabled={loadingStudents || students.length === 0}
                leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                className="bg-brand-gold text-brand-dark hover:bg-brand-gold-light border-2 border-brand-dark"
              >
                Add Subject
              </Button>
            </div>
          </div>
        </section>

        {/* Success / Error Alerts */}
        {successMessage && (
          <div className="p-3 border-2 border-brand-dark bg-emerald-50 text-emerald-900 text-xs font-sans flex items-center justify-between shadow-brutal-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-800 hover:text-emerald-950 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-sans flex items-center justify-between shadow-brutal-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-800 hover:text-red-950 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Student Selector Bar */}
        <section aria-label="Target Student Selection" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-brand-teal shrink-0 stroke-[2.2]" />
              <label htmlFor="student-selector" className="font-heading font-extrabold text-sm text-brand-navy">
                Select Assigned Student:
              </label>
            </div>

            {loadingStudents ? (
              <span className="font-mono text-xs text-brand-muted">Loading assigned students roster...</span>
            ) : students.length > 0 ? (
              <select
                id="student-selector"
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-xs font-bold font-sans text-brand-dark focus:bg-brand-teal-light focus:outline-none"
              >
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name} ({student.poraplan_id || 'Student'})
                  </option>
                ))}
              </select>
            ) : (
              <Badge variant="muted" size="sm">0 ASSIGNED STUDENTS</Badge>
            )}
          </div>

          {activeStudent && (
            <div className="p-2.5 border border-brand-dark/20 bg-brand-paper-tint text-xs font-mono flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-brand-navy">{activeStudent.full_name}</span>
                <span>•</span>
                <span className="text-brand-gold font-bold">{activeStudent.poraplan_id || 'PP001'}</span>
                <span>•</span>
                <span className="text-brand-muted truncate max-w-[200px]">{activeStudent.email}</span>
              </div>
              <Badge variant="teal" size="sm">ACTIVE ROSTER</Badge>
            </div>
          )}
        </section>

        {/* Content Section: Study Areas for Selected Student */}
        {loadingStudents || loadingSubjects ? (
          <div className="p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-teal mx-auto" />
            <p className="font-heading font-bold text-sm text-brand-navy">
              Loading Study Areas...
            </p>
          </div>
        ) : students.length === 0 ? (
          /* Empty State: Mentor has no students on roster */
          <div className="p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper shadow-brutal text-center space-y-3">
            <div className="w-12 h-12 border-2 border-brand-dark bg-brand-teal-light mx-auto flex items-center justify-center">
              <Users className="w-6 h-6 text-brand-teal stroke-[2.2]" />
            </div>
            <h2 className="font-heading font-extrabold text-base text-brand-navy">
              No Students Assigned to Your Roster
            </h2>
            <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
              You must have enrolled students assigned in the <span className="font-mono">mentor_students</span> table before creating study areas. Contact the system administrator (PPA001) to allocate students to your mentor account.
            </p>
          </div>
        ) : subjects.length > 0 ? (
          /* List of Subjects for Active Student */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                Enrolled Study Areas for {activeStudent?.full_name} ({subjects.length})
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {subject.code && (
                            <span className="font-mono text-[10px] font-extrabold uppercase px-2 py-0.5 border border-brand-dark bg-brand-paper-tint text-brand-navy shadow-brutal-xs">
                              {subject.code}
                            </span>
                          )}
                          <Badge variant={subject.status === 'active' ? 'teal' : 'muted'} size="sm">
                            {subject.status.toUpperCase()}
                          </Badge>
                        </div>
                        <h3 className="font-heading font-extrabold text-lg text-brand-navy">
                          {subject.name}
                        </h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(subject)}
                          className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint shadow-brutal-xs"
                          title="Edit Study Area"
                          aria-label="Edit Study Area"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-brand-navy" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteModal(subject)}
                          className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-red-50 text-brand-dark hover:text-red-700 shadow-brutal-xs"
                          title="Delete Study Area"
                          aria-label="Delete Study Area"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-brand-dark/85 font-sans leading-relaxed line-clamp-3">
                      {subject.description || 'Core syllabus study area for disciplined study sessions and problem practice.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-1.5 text-brand-muted text-[11px]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{subject.created_at ? new Date(subject.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Configured'}</span>
                    </div>

                    <Link
                      to={`/mentor/subjects/${subject.id}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1 border border-brand-dark bg-brand-navy text-brand-bg font-bold hover:bg-brand-dark transition-colors shadow-brutal-xs text-xs"
                    >
                      <span>Inspect Area</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Empty State: Student has 0 subjects */
          <div className="p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper shadow-brutal text-center space-y-3">
            <div className="w-12 h-12 border-2 border-brand-dark bg-brand-gold-light mx-auto flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-brand-gold-dark stroke-[2.2]" />
            </div>
            <h2 className="font-heading font-extrabold text-base text-brand-navy">
              No Study Areas Assigned to {activeStudent?.full_name}
            </h2>
            <p className="text-xs text-brand-muted max-w-md mx-auto leading-relaxed">
              Get started by creating syllabus study areas (e.g. Physics, Higher Mathematics, Chemistry) for this student.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add First Study Area
            </Button>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE STUDY AREA                                                */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-subject-modal-title"
        >
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h2 id="create-subject-modal-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Add Study Area
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            {formError && (
              <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-sans flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubject} className="space-y-3.5">
              {/* Target Student Display */}
              <div className="p-2.5 border border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  Assigning to Student:
                </span>
                <span className="text-xs font-bold text-brand-navy font-heading">
                  {activeStudent?.full_name} ({activeStudent?.poraplan_id || 'PP001'})
                </span>
              </div>

              {/* Subject Name */}
              <div>
                <label htmlFor="create-subject-name" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Subject / Course Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="create-subject-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Physics, Higher Mathematics, Chemistry"
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-brand-paper font-sans focus:bg-brand-teal-light focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Subject Code */}
              <div>
                <label htmlFor="create-subject-code" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Course Code <span className="font-normal text-brand-muted font-sans text-[11px]">(optional)</span>
                </label>
                <input
                  id="create-subject-code"
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  placeholder="e.g. PHY-101, MATH-102"
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-brand-paper font-sans uppercase focus:bg-brand-teal-light focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="create-subject-desc" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Syllabus Overview / Notes <span className="font-normal text-brand-muted font-sans text-[11px]">(optional)</span>
                </label>
                <textarea
                  id="create-subject-desc"
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="e.g. Mechanics, thermodynamics, wave optics, and problem sets."
                  className="w-full p-2.5 text-xs border-2 border-brand-dark bg-brand-paper font-sans focus:bg-brand-teal-light focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-brand-dark/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    'Create Study Area'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT STUDY AREA                                                  */}
      {/* ========================================================================= */}
      {isEditModalOpen && selectedSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-subject-modal-title"
        >
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h2 id="edit-subject-modal-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Edit Study Area
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            {formError && (
              <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-sans flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubject} className="space-y-3.5">
              <div>
                <label htmlFor="edit-subject-name" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Subject / Course Name <span className="text-red-600">*</span>
                </label>
                <input
                  id="edit-subject-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-brand-paper font-sans focus:bg-brand-teal-light focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-subject-code" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Course Code <span className="font-normal text-brand-muted font-sans text-[11px]">(optional)</span>
                </label>
                <input
                  id="edit-subject-code"
                  type="text"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-brand-paper font-sans uppercase focus:bg-brand-teal-light focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-subject-desc" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Syllabus Overview / Notes <span className="font-normal text-brand-muted font-sans text-[11px]">(optional)</span>
                </label>
                <textarea
                  id="edit-subject-desc"
                  rows={3}
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full p-2.5 text-xs border-2 border-brand-dark bg-brand-paper font-sans focus:bg-brand-teal-light focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="edit-subject-status" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Status
                </label>
                <select
                  id="edit-subject-status"
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as SubjectStatus)}
                  className="w-full px-3 py-2 text-xs border-2 border-brand-dark bg-brand-paper font-sans focus:bg-brand-teal-light focus:outline-none"
                >
                  <option value="active">Active (Enrolled in Current Term)</option>
                  <option value="archived">Archived (Term Completed)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-brand-dark/20">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={formSubmitting}
                >
                  {formSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: DELETE STUDY AREA CONFIRMATION                                   */}
      {/* ========================================================================= */}
      {isDeleteModalOpen && selectedSubject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-subject-modal-title"
        >
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-700 stroke-[2.5]" />
                <h2 id="delete-subject-modal-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Delete Study Area
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <p className="text-xs font-sans text-brand-dark leading-relaxed">
              Are you sure you want to delete <strong className="text-brand-navy">"{selectedSubject.name}"</strong>? This will remove this study area from the student’s study dashboard.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-brand-dark/20">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={formSubmitting}
              >
                Cancel
              </Button>
              <button
                type="button"
                onClick={handleDeleteSubject}
                disabled={formSubmitting}
                className="px-3 py-1.5 border-2 border-brand-dark bg-red-700 text-white font-mono text-xs font-bold shadow-brutal-xs hover:bg-red-800 disabled:opacity-60"
              >
                {formSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
