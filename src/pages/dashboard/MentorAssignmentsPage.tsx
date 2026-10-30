import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import { getStudentSubjects } from '../../lib/subjects';
import { getStudentStudyPlans } from '../../lib/studyPlans';
import {
  getStudentAssignments,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  reviewSubmission,
  type AssignmentWithMeta,
} from '../../lib/assignments';
import type { Profile, Subject, StudyPlan, AssignmentStatus, SubmissionStatus } from '../../types/database';
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
  FileText,
  Calendar,
  X,
  CheckCircle2,
  ExternalLink,
  Paperclip,
  Eye,
  FileCheck,
} from 'lucide-react';

export const MentorAssignmentsPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Data for selected student
  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter state
  const [filterState, setFilterState] = useState<'all' | 'pending' | 'submitted' | 'reviewed'>('all');

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formPlanId, setFormPlanId] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formTotalPoints, setFormTotalPoints] = useState('100');
  const [formStatus, setFormStatus] = useState<AssignmentStatus>('published');

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<AssignmentWithMeta | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Review Submission Modal State
  const [reviewTarget, setReviewTarget] = useState<AssignmentWithMeta | null>(null);
  const [updatingReviewStatus, setUpdatingReviewStatus] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewScore, setReviewScore] = useState('');
  const [reviewStatus, setReviewStatus] = useState<SubmissionStatus>('reviewed');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  const mentorId = user?.id || '';

  // 1. Load Assigned Students Roster
  useEffect(() => {
    if (!mentorId) {
      Promise.resolve().then(() => setLoadingStudents(false));
      return;
    }
    let isMounted = true;
    getAssignedStudents(mentorId)
      .then(({ students: loadedStudents }) => {
        if (!isMounted) return;
        setStudents(loadedStudents);
        if (loadedStudents.length > 0) {
          setSelectedStudentId((prev) => prev || loadedStudents[0].id);
        }
        setLoadingStudents(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load students.';
        setErrorMessage(msg);
        setLoadingStudents(false);
      });

    return () => {
      isMounted = false;
    };
  }, [mentorId]);

  // 2. Load Selected Student Data
  const loadStudentData = (studentId: string) => {
    if (!studentId) return;
    setLoadingAssignments(true);
    setErrorMessage(null);

    Promise.all([
      getStudentAssignments(studentId),
      getStudentSubjects(studentId),
      getStudentStudyPlans(studentId),
    ])
      .then(([assignRes, subjRes, plansRes]) => {
        if (assignRes.error) {
          setErrorMessage(assignRes.error.message);
        } else {
          setAssignments(assignRes.assignments);
        }
        setSubjects(subjRes.subjects);
        setPlans(plansRes.plans);
        setLoadingAssignments(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load student data.';
        setErrorMessage(msg);
        setLoadingAssignments(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    if (!selectedStudentId) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setAssignments([]);
          setSubjects([]);
          setPlans([]);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    Promise.all([
      getStudentAssignments(selectedStudentId),
      getStudentSubjects(selectedStudentId),
      getStudentStudyPlans(selectedStudentId),
    ])
      .then(([assignRes, subjRes, plansRes]) => {
        if (!isMounted) return;
        if (assignRes.error) {
          setErrorMessage(assignRes.error.message);
        } else {
          setAssignments(assignRes.assignments);
        }
        if (subjRes.subjects) {
          setSubjects(subjRes.subjects);
        }
        if (plansRes.plans) {
          setPlans(plansRes.plans);
        }
        setLoadingAssignments(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load student data.';
        setErrorMessage(msg);
        setLoadingAssignments(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingAssignmentId(null);
    setFormTitle('');
    setFormSubjectId(subjects.length > 0 ? subjects[0].id : '');
    setFormPlanId('');
    setFormInstructions('');
    setFormDueDate('');
    setFormTotalPoints('100');
    setFormStatus('published');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (assignment: AssignmentWithMeta) => {
    setEditingAssignmentId(assignment.id);
    setFormTitle(assignment.title);
    setFormSubjectId(assignment.subject_id || '');
    setFormPlanId(assignment.plan_id || '');
    setFormInstructions(assignment.instructions || '');
    setFormDueDate(assignment.due_date || '');
    setFormTotalPoints(assignment.total_points ? String(assignment.total_points) : '100');
    setFormStatus(assignment.status);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Save Assignment (Create or Edit)
  const handleSubmitAssignmentForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Assignment title is required.');
      return;
    }
    if (!selectedStudentId) {
      setFormError('Please select an assigned student.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const pointsNumber = formTotalPoints ? parseInt(formTotalPoints, 10) : 100;

    if (editingAssignmentId) {
      const { assignment, error } = await updateAssignment(editingAssignmentId, {
        title: formTitle,
        subject_id: formSubjectId || null,
        plan_id: formPlanId || null,
        instructions: formInstructions,
        due_date: formDueDate || null,
        total_points: isNaN(pointsNumber) ? 100 : pointsNumber,
        status: formStatus,
      });

      setIsSubmitting(false);

      if (error) {
        setFormError(error.message);
      } else if (assignment) {
        setIsModalOpen(false);
        loadStudentData(selectedStudentId);
      }
    } else {
      const { assignment, error } = await createAssignment({
        studentId: selectedStudentId,
        mentorId,
        subjectId: formSubjectId || undefined,
        planId: formPlanId || undefined,
        title: formTitle,
        instructions: formInstructions || undefined,
        dueDate: formDueDate || undefined,
        totalPoints: isNaN(pointsNumber) ? 100 : pointsNumber,
        status: formStatus,
      });

      setIsSubmitting(false);

      if (error) {
        setFormError(error.message);
      } else if (assignment) {
        setIsModalOpen(false);
        loadStudentData(selectedStudentId);
      }
    }
  };

  // Delete Assignment
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    const { success, error } = await deleteAssignment(deleteTarget.id);
    setIsDeleting(false);

    if (error) {
      setErrorMessage(error.message);
    } else if (success) {
      setDeleteTarget(null);
      loadStudentData(selectedStudentId);
    }
  };

  // Open Review Evaluation Modal
  const handleOpenReviewModal = (assignment: AssignmentWithMeta) => {
    setReviewTarget(assignment);
    setReviewFeedback(assignment.submission?.feedback || '');
    setReviewScore(
      assignment.submission?.score !== undefined && assignment.submission?.score !== null
        ? String(assignment.submission.score)
        : ''
    );
    setReviewStatus(assignment.submission?.status === 'needs_revision' ? 'needs_revision' : 'reviewed');
    setReviewError(null);
    setReviewSuccess(null);
  };

  // Submit Mentor Evaluation & Feedback
  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget?.submission) return;
    if (!reviewFeedback.trim()) {
      setReviewError('Feedback comments are required.');
      return;
    }

    setUpdatingReviewStatus(true);
    setReviewError(null);
    setReviewSuccess(null);

    const parsedScore = reviewScore.trim() ? parseFloat(reviewScore) : null;
    const { submission, error } = await reviewSubmission({
      submissionId: reviewTarget.submission.id,
      mentorId,
      status: reviewStatus,
      feedback: reviewFeedback,
      score: parsedScore,
    });

    setUpdatingReviewStatus(false);

    if (error) {
      setReviewError(error.message);
    } else if (submission) {
      setReviewSuccess('Review assessment and feedback saved successfully!');
      setReviewTarget({ ...reviewTarget, submission });
      loadStudentData(selectedStudentId);
    }
  };

  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  // Filtered list
  const filteredAssignments = assignments.filter((a) => {
    if (filterState === 'all') return true;
    if (filterState === 'pending') return !a.submission;
    if (filterState === 'submitted') return a.submission && (a.submission.status === 'submitted' || a.submission.status === 'under_review');
    if (filterState === 'reviewed') return a.submission && a.submission.status === 'reviewed';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-brand-bg border-4 border-brand-dark p-6 shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-brand-gold uppercase tracking-wider">
              Mentorship Practice
            </span>
          </div>
          <h1 className="font-heading font-black text-2xl md:text-3xl text-brand-navy">
            Assignments
          </h1>
          <p className="text-sm text-brand-muted mt-1 max-w-2xl">
            Create and assign practice problem sets, questions, and revision exercises for your assigned students.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {students.length > 0 && (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 shadow-brutal"
            >
              <Plus className="w-4 h-4" />
              New Assignment
            </Button>
          )}
        </div>
      </div>

      {/* Student Selector Card */}
      <div className="bg-white border-3 border-brand-dark p-4 sm:p-5 shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-gold/20 border-2 border-brand-dark flex items-center justify-center font-bold text-brand-navy">
            <Users className="w-5 h-5 text-brand-navy" />
          </div>
          <div>
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-muted">
              Select Assigned Student
            </div>
            <div className="font-heading font-bold text-base text-brand-navy">
              {selectedStudent ? `${selectedStudent.full_name} (${selectedStudent.poraplan_id})` : 'No Student Selected'}
            </div>
          </div>
        </div>

        {loadingStudents ? (
          <div className="flex items-center gap-2 text-xs font-mono text-brand-muted">
            <Loader2 className="w-4 h-4 animate-spin text-brand-teal" />
            Loading assigned students...
          </div>
        ) : students.length === 0 ? (
          <div className="text-xs font-mono text-brand-muted bg-brand-paper px-3 py-1.5 border border-brand-dark">
            0 Assigned Students
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="bg-brand-paper border-2 border-brand-dark px-3 py-1.5 text-xs font-mono font-bold text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
              aria-label="Filter by assigned student"
            >
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name} ({student.poraplan_id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border-3 border-red-500 p-4 text-red-700 flex items-start gap-3 shadow-brutal-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-bold text-sm">Action Failed</h4>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Filter Tabs & Stats */}
      {selectedStudentId && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setFilterState('all')}
              className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
                filterState === 'all'
                  ? 'bg-brand-navy text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                  : 'bg-white text-brand-dark hover:bg-brand-paper'
              }`}
            >
              All Sets ({assignments.length})
            </button>
            <button
              onClick={() => setFilterState('pending')}
              className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
                filterState === 'pending'
                  ? 'bg-brand-gold text-brand-dark shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                  : 'bg-white text-brand-dark hover:bg-brand-paper'
              }`}
            >
              Awaiting Student ({assignments.filter((a) => !a.submission).length})
            </button>
            <button
              onClick={() => setFilterState('submitted')}
              className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
                filterState === 'submitted'
                  ? 'bg-brand-teal text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                  : 'bg-white text-brand-dark hover:bg-brand-paper'
              }`}
            >
              Needs Review ({assignments.filter((a) => a.submission && a.submission.status !== 'reviewed').length})
            </button>
            <button
              onClick={() => setFilterState('reviewed')}
              className={`font-mono text-xs font-bold uppercase px-3 py-1.5 border-2 border-brand-dark transition-all ${
                filterState === 'reviewed'
                  ? 'bg-brand-navy text-white shadow-brutal-xs translate-x-0.5 translate-y-0.5'
                  : 'bg-white text-brand-dark hover:bg-brand-paper'
              }`}
            >
              Reviewed ({assignments.filter((a) => a.submission && a.submission.status === 'reviewed').length})
            </button>
          </div>

          <div className="font-mono text-xs text-brand-muted">
            Viewing {filteredAssignments.length} of {assignments.length} assignments
          </div>
        </div>
      )}

      {/* Main Content List */}
      {loadingStudents || loadingAssignments ? (
        <div className="bg-white border-3 border-brand-dark p-12 text-center shadow-brutal">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-teal mb-3" />
          <p className="font-mono text-sm text-brand-muted font-bold uppercase tracking-wider">
            Loading assignment roster...
          </p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white border-4 border-brand-dark p-8 md:p-12 text-center shadow-brutal">
          <div className="w-16 h-16 bg-brand-paper-tint border-3 border-brand-dark flex items-center justify-center mx-auto mb-4 shadow-brutal-sm">
            <Users className="w-8 h-8 text-brand-muted" />
          </div>
          <h3 className="font-heading font-black text-xl text-brand-navy mb-2">
            No Assigned Students Found
          </h3>
          <p className="text-sm text-brand-muted max-w-md mx-auto mb-6">
            You do not currently have any students assigned to your mentorship roster. Administrative pairing is required before distributing assignments.
          </p>
        </div>
      ) : filteredAssignments.length === 0 ? (
        <div className="bg-white border-4 border-brand-dark p-8 md:p-12 text-center shadow-brutal">
          <div className="w-16 h-16 bg-brand-paper-tint border-3 border-brand-dark flex items-center justify-center mx-auto mb-4 shadow-brutal-sm">
            <FileText className="w-8 h-8 text-brand-muted" />
          </div>
          <h3 className="font-heading font-black text-xl text-brand-navy mb-2">
            {filterState === 'all'
              ? 'No Assignments for This Student'
              : `No Assignments in "${filterState.toUpperCase()}" Status`}
          </h3>
          <p className="text-sm text-brand-muted max-w-md mx-auto mb-6">
            Create an assignment for {selectedStudent?.full_name} to reinforce theoretical concepts from their study plans.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 mx-auto"
          >
            <Plus className="w-4 h-4" />
            Distribute First Assignment
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAssignments.map((assignment) => {
            const hasSubmission = !!assignment.submission;

            return (
              <div
                key={assignment.id}
                className="bg-white border-3 border-brand-dark p-5 sm:p-6 shadow-brutal-sm hover:shadow-brutal transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    {/* Meta Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      {assignment.subject_name && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-paper-tint border border-brand-dark px-2 py-0.5 text-brand-navy flex items-center gap-1">
                          <BookOpen className="w-3 h-3 text-brand-teal" />
                          {assignment.subject_name}
                        </span>
                      )}

                      {assignment.plan_title && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-bg border border-brand-dark px-2 py-0.5 text-brand-muted flex items-center gap-1">
                          <Compass className="w-3 h-3 text-brand-muted" />
                          {assignment.plan_title}
                        </span>
                      )}

                      <Badge
                        variant={hasSubmission ? (assignment.submission?.status === 'reviewed' ? 'teal' : 'gold') : 'muted'}
                        size="sm"
                      >
                        {hasSubmission
                          ? `SUBMISSION: ${assignment.submission?.status.replace('_', ' ').toUpperCase()}`
                          : 'AWAITING WORK'}
                      </Badge>

                      {assignment.total_points && (
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-white border border-brand-dark px-2 py-0.5 text-brand-dark">
                          {assignment.total_points} PTS
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="font-heading font-bold text-lg text-brand-navy">
                      {assignment.title}
                    </h3>

                    {/* Instructions */}
                    {assignment.instructions && (
                      <p className="text-xs sm:text-sm text-brand-muted font-sans leading-relaxed line-clamp-3 bg-brand-paper p-3 border border-brand-dark/30">
                        {assignment.instructions}
                      </p>
                    )}

                    {/* Submission Preview Banner if submitted */}
                    {hasSubmission && (
                      <div className="mt-3 p-3 bg-teal-50/70 border border-brand-teal flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="w-4 h-4 text-brand-teal flex-shrink-0" />
                          <span className="font-mono font-bold text-brand-navy">
                            Student Submitted ({assignment.submission?.submission_type.toUpperCase()}):
                          </span>
                          <span className="text-brand-muted truncate max-w-xs font-mono">
                            {assignment.submission?.submission_type === 'link'
                              ? assignment.submission.link_url
                              : assignment.submission?.submission_type === 'file'
                              ? assignment.submission.file_name
                              : assignment.submission?.content}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenReviewModal(assignment)}
                          className="flex items-center gap-1 text-xs py-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-teal" />
                          Review Work
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Actions & Dates */}
                  <div className="flex flex-col md:items-end justify-between gap-3 flex-shrink-0">
                    <div className="text-xs font-mono text-brand-muted space-y-1">
                      {assignment.due_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                          Due: {new Date(assignment.due_date).toLocaleDateString()}
                        </div>
                      )}
                      <div>
                        Created: {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {hasSubmission && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenReviewModal(assignment)}
                          className="flex items-center gap-1"
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          Review
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(assignment)}
                        className="flex items-center gap-1"
                        aria-label="Edit assignment"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteTarget(assignment)}
                        className="flex items-center gap-1 text-red-600 hover:bg-red-50 border-red-500"
                        aria-label="Delete assignment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT ASSIGNMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-white border-4 border-brand-dark p-6 max-w-xl w-full shadow-brutal max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-brand-dark mb-4">
              <h3 className="font-heading font-black text-xl text-brand-navy flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-gold" />
                {editingAssignmentId ? 'Edit Assignment Brief' : 'Distribute Practice Assignment'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-brand-muted hover:text-brand-dark p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="bg-red-50 border-2 border-red-500 p-3 text-red-700 text-xs mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAssignmentForm} className="space-y-4">
              {/* Target Scholar */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                  Assigned Student
                </label>
                <div className="bg-brand-paper border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark">
                  {selectedStudent ? `${selectedStudent.full_name} (${selectedStudent.poraplan_id})` : 'None'}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                  Assignment Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Newtonian Mechanics: Inclined Plane Dynamics"
                  className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs sm:text-sm text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  required
                />
              </div>

              {/* Subject & Study Plan Linkage */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                    Study Area (Subject)
                  </label>
                  <select
                    value={formSubjectId}
                    onChange={(e) => setFormSubjectId(e.target.value)}
                    className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">-- None / General --</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.code ? `(${s.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                    Study Plan Roadmap
                  </label>
                  <select
                    value={formPlanId}
                    onChange={(e) => setFormPlanId(e.target.value)}
                    className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  >
                    <option value="">-- None / Standalone --</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Points & Due Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                    Total Points / Weight
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="1000"
                    value={formTotalPoints}
                    onChange={(e) => setFormTotalPoints(e.target.value)}
                    className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>

                <div>
                  <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                  Problem Set Instructions &amp; Brief
                </label>
                <textarea
                  rows={4}
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="Detail the specific questions, page numbers, or derivation criteria required from the student..."
                  className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                  Assignment Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as AssignmentStatus)}
                  className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                >
                  <option value="published">Published (Visible to Student)</option>
                  <option value="draft">Draft (Saved only for Mentor)</option>
                  <option value="closed">Closed (Submissions Locked)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Form Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t-2 border-brand-dark">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      {editingAssignmentId ? 'Save Changes' : 'Distribute Assignment'}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVIEW SUBMISSION MODAL */}
      {reviewTarget && reviewTarget.submission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-white border-4 border-brand-dark p-6 max-w-xl w-full shadow-brutal max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-brand-dark mb-4">
              <div>
                <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-teal">
                  Submission Inspection
                </div>
                <h3 className="font-heading font-black text-lg text-brand-navy">
                  {reviewTarget.title}
                </h3>
              </div>
              <button
                onClick={() => setReviewTarget(null)}
                className="text-brand-muted hover:text-brand-dark p-1"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Submission Meta */}
              <div className="bg-brand-paper p-3 border-2 border-brand-dark flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div>
                  <span className="text-brand-muted">Student:</span>{' '}
                  <strong>{selectedStudent?.full_name}</strong>
                </div>
                <div>
                  <span className="text-brand-muted">Submitted:</span>{' '}
                  <strong>
                    {reviewTarget.submission.submitted_at
                      ? new Date(reviewTarget.submission.submitted_at).toLocaleString()
                      : 'N/A'}
                  </strong>
                </div>
                <div>
                  <Badge
                    variant={reviewTarget.submission.status === 'reviewed' ? 'teal' : 'gold'}
                    size="sm"
                  >
                    STATUS: {reviewTarget.submission.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Submission Content */}
              <div>
                <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                  Submitted Work ({reviewTarget.submission.submission_type.toUpperCase()})
                </label>

                {reviewTarget.submission.submission_type === 'link' ? (
                  <div className="p-4 bg-white border-2 border-brand-dark space-y-2">
                    <div className="flex items-center gap-2 text-brand-teal font-mono text-xs">
                      <ExternalLink className="w-4 h-4 flex-shrink-0" />
                      <a
                        href={reviewTarget.submission.link_url || reviewTarget.submission.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-brand-navy break-all"
                      >
                        {reviewTarget.submission.link_url || reviewTarget.submission.content}
                      </a>
                    </div>
                    {reviewTarget.submission.content !== reviewTarget.submission.link_url && (
                      <p className="text-xs text-brand-muted font-sans mt-2">
                        {reviewTarget.submission.content}
                      </p>
                    )}
                  </div>
                ) : reviewTarget.submission.submission_type === 'file' ? (
                  <div className="p-4 bg-white border-2 border-brand-dark space-y-2">
                    <div className="flex items-center gap-2 font-mono text-xs text-brand-navy">
                      <Paperclip className="w-4 h-4 text-brand-teal flex-shrink-0" />
                      <strong>{reviewTarget.submission.file_name || 'Attached File'}</strong>
                      {reviewTarget.submission.file_size && (
                        <span className="text-brand-muted">
                          ({Math.round(reviewTarget.submission.file_size / 1024)} KB)
                        </span>
                      )}
                    </div>
                    {reviewTarget.submission.content && (
                      <p className="text-xs text-brand-dark font-sans whitespace-pre-wrap">
                        {reviewTarget.submission.content}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-white border-2 border-brand-dark text-xs sm:text-sm font-sans whitespace-pre-wrap text-brand-dark leading-relaxed max-h-60 overflow-y-auto">
                    {reviewTarget.submission.content}
                  </div>
                )}
              </div>

              {/* Mentor Feedback & Scoring Evaluation Form */}
              <div className="border-t-2 border-brand-dark pt-4">
                <h4 className="font-heading font-black text-sm text-brand-navy uppercase mb-3 flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-brand-teal" />
                  Mentor Feedback &amp; Evaluation
                </h4>

                {reviewError && (
                  <div className="bg-red-50 border-2 border-red-500 p-2.5 text-red-700 text-xs mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{reviewError}</span>
                  </div>
                )}

                {reviewSuccess && (
                  <div className="bg-teal-50 border-2 border-brand-teal p-2.5 text-brand-dark text-xs mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-teal flex-shrink-0" />
                    <span>{reviewSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleSaveReview} className="space-y-3">
                  <div>
                    <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                      Correction Notes &amp; Guidance *
                    </label>
                    <textarea
                      rows={4}
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                      placeholder="Detail calculation errors, conceptual gaps, notation advice, or commend strong derivation steps..."
                      className="w-full bg-white border-2 border-brand-dark p-2.5 text-xs text-brand-dark font-sans focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                        Score / Points Awarded (Max {reviewTarget.total_points || 100})
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={reviewTarget.total_points || 1000}
                        step="0.5"
                        value={reviewScore}
                        onChange={(e) => setReviewScore(e.target.value)}
                        placeholder="e.g. 85"
                        className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-xs font-bold uppercase tracking-wider text-brand-navy mb-1">
                        Review Decision Status
                      </label>
                      <select
                        value={reviewStatus}
                        onChange={(e) => setReviewStatus(e.target.value as SubmissionStatus)}
                        className="w-full bg-white border-2 border-brand-dark p-2 text-xs font-mono text-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-teal"
                      >
                        <option value="reviewed">Reviewed &amp; Approved</option>
                        <option value="needs_revision">Needs Revision (Request Redo)</option>
                        <option value="under_review">Keep Under Review</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-brand-dark/20">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setReviewTarget(null)}
                    >
                      Close
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={updatingReviewStatus}
                      className="flex items-center gap-1.5"
                    >
                      {updatingReviewStatus ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Saving Evaluation...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Save Review &amp; Feedback
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/60 backdrop-blur-xs">
          <div className="bg-white border-4 border-brand-dark p-6 max-w-md w-full shadow-brutal">
            <h3 className="font-heading font-black text-xl text-brand-navy mb-2 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Assignment?
            </h3>
            <p className="text-sm text-brand-dark font-sans mb-4">
              Are you sure you want to delete{' '}
              <strong>"{deleteTarget.title}"</strong>? Any student submissions for this assignment will also be removed. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Yes, Delete
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
