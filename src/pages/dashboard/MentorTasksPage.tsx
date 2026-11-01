import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import { getStudentSubjects } from '../../lib/subjects';
import { getStudentStudyPlans } from '../../lib/studyPlans';
import {
  getStudentTasks,
  createTask,
  updateTask,
  deleteTask,
  type TaskWithMeta,
} from '../../lib/tasks';
import {
  uploadAcademicFile,
  deleteAcademicFile,
  validateAcademicFile,
  getAcademicFileSignedUrl,
} from '../../lib/storage';
import { AttachmentViewerModal } from '../../components/common/AttachmentViewerModal';
import type { Profile, Subject, TaskPriority, TaskStatus, StudyPlan } from '../../types/database';
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
  ListTodo,
  Calendar,
  Clock,
  X,
  CheckCircle,
  Circle,
  CheckCircle2,
  Paperclip,
  Upload,
  Download,
  Eye,
} from 'lucide-react';

export const MentorTasksPage: React.FC = () => {
  const { user } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [loadingStudents, setLoadingStudents] = useState(true);

  // Data for selected student
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Fields
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formPlanId, setFormPlanId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState('60');
  const [formDueDate, setFormDueDate] = useState('');

  // Attachment State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileError, setSelectedFileError] = useState<string | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{
    name: string;
    size?: number | null;
    path: string;
  } | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attachment Viewer Modal State
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    fileName: string;
    filePath: string | null;
    fileUrl: string | null;
    fileSize?: number | null;
    loading: boolean;
    error: string | null;
  }>({
    isOpen: false,
    fileName: '',
    filePath: null,
    fileUrl: null,
    fileSize: null,
    loading: false,
    error: null,
  });

  // Delete Confirmation State
  const [deleteTargetTask, setDeleteTargetTask] = useState<TaskWithMeta | null>(null);
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

  // 2. Load Tasks, Subjects & Plans for Selected Student
  const refreshStudentTasks = (sId: string) => {
    if (!sId) return;
    setLoadingTasks(true);
    setErrorMessage(null);

    Promise.all([
      getStudentTasks(sId),
      getStudentSubjects(sId),
      getStudentStudyPlans(sId),
    ])
      .then(([tasksRes, subsRes, plansRes]) => {
        if (tasksRes.error) {
          setErrorMessage(tasksRes.error.message);
        } else {
          setTasks(tasksRes.tasks);
        }
        if (subsRes.subjects) {
          setSubjects(subsRes.subjects);
        }
        if (plansRes.plans) {
          setPlans(plansRes.plans);
        }
        setLoadingTasks(false);
      })
      .catch((err) => {
        setErrorMessage(err instanceof Error ? err.message : 'Error loading student tasks.');
        setLoadingTasks(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    if (!selectedStudentId) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setTasks([]);
          setSubjects([]);
          setPlans([]);
        }
      });
      return () => {
        isMounted = false;
      };
    }

    Promise.all([
      getStudentTasks(selectedStudentId),
      getStudentSubjects(selectedStudentId),
      getStudentStudyPlans(selectedStudentId),
    ])
      .then(([tasksRes, subsRes, plansRes]) => {
        if (!isMounted) return;
        if (tasksRes.error) {
          setErrorMessage(tasksRes.error.message);
        } else {
          setTasks(tasksRes.tasks);
        }
        if (subsRes.subjects) {
          setSubjects(subsRes.subjects);
        }
        if (plansRes.plans) {
          setPlans(plansRes.plans);
        }
        setLoadingTasks(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMessage(err instanceof Error ? err.message : 'Error loading student tasks.');
        setLoadingTasks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedStudentId]);

  const activeStudent = students.find((s) => s.id === selectedStudentId);

  // Attachment Helpers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateAcademicFile(file);
    if (!validation.valid) {
      setSelectedFileError(validation.error || 'Invalid file format or size.');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setSelectedFileError(null);
    setRemoveExistingAttachment(false);
  };

  const handleRemoveSelectedFile = () => {
    setSelectedFile(null);
    setSelectedFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveExistingAttachment = () => {
    setRemoveExistingAttachment(true);
    setSelectedFile(null);
    setSelectedFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePreviewAttachment = async (attachment: {
    name?: string | null;
    size?: number | null;
    path?: string | null;
  }) => {
    const name = attachment.name || 'attachment';
    if (!attachment.path) {
      setViewerModal({
        isOpen: true,
        fileName: name,
        filePath: null,
        fileUrl: null,
        fileSize: attachment.size || null,
        loading: false,
        error: 'Storage path was not recorded for this attachment.',
      });
      return;
    }

    setViewerModal({
      isOpen: true,
      fileName: name,
      filePath: attachment.path,
      fileUrl: null,
      fileSize: attachment.size || null,
      loading: true,
      error: null,
    });

    const { signedUrl, error: urlErr } = await getAcademicFileSignedUrl(attachment.path);
    if (urlErr || !signedUrl) {
      setViewerModal((prev) => ({
        ...prev,
        loading: false,
        error: urlErr?.message || 'Unable to generate secure preview link for this attachment.',
      }));
    } else {
      setViewerModal((prev) => ({
        ...prev,
        fileUrl: signedUrl,
        loading: false,
        error: null,
      }));
    }
  };

  const handleDownloadAttachment = async (attachment: {
    name?: string | null;
    path?: string | null;
  }) => {
    const name = attachment.name || 'download';
    if (!attachment.path) {
      alert('Attachment path is not available for download.');
      return;
    }

    const { signedUrl, error: urlErr } = await getAcademicFileSignedUrl(attachment.path);
    if (urlErr || !signedUrl) {
      alert(urlErr?.message || 'Failed to generate secure download link.');
      return;
    }

    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = name;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingTaskId(null);
    setFormTitle('');
    setFormSubjectId(subjects.length > 0 ? subjects[0].id : '');
    setFormPlanId(plans.length > 0 ? plans[0].id : '');
    setFormDescription('');
    setFormPriority('medium');
    setFormStatus('pending');
    setFormEstimatedMinutes('60');
    setFormDueDate('');
    setFormError(null);
    setSelectedFile(null);
    setSelectedFileError(null);
    setExistingAttachment(null);
    setRemoveExistingAttachment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (task: TaskWithMeta) => {
    setEditingTaskId(task.id);
    setFormTitle(task.title);
    setFormSubjectId(task.subject_id || '');
    setFormPlanId(task.plan_id || '');
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormEstimatedMinutes(task.estimated_minutes ? String(task.estimated_minutes) : '');
    setFormDueDate(task.due_date || '');
    setFormError(null);
    setSelectedFile(null);
    setSelectedFileError(null);
    if (task.attachment_path) {
      setExistingAttachment({
        name: task.attachment_name || 'Attachment',
        size: task.attachment_size,
        path: task.attachment_path,
      });
    } else {
      setExistingAttachment(null);
    }
    setRemoveExistingAttachment(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsModalOpen(true);
  };

  // Quick toggle status by mentor
  const handleToggleStatus = async (task: TaskWithMeta) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    const { task: updated, error } = await updateTask(task.id, {
      status: nextStatus,
    });
    if (!error && updated) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: updated.status, completed_at: updated.completed_at } : t))
      );
    }
  };

  // Handle Form Submit (Create / Edit)
  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Task title is required.');
      return;
    }
    if (!selectedStudentId) {
      setFormError('Please select a student from your roster.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const estMins = formEstimatedMinutes ? parseInt(formEstimatedMinutes, 10) : undefined;

    try {
      if (editingTaskId) {
        // 1. Update task general attributes
        const { task: updatedTask, error } = await updateTask(editingTaskId, {
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          subject_id: formSubjectId || null,
          plan_id: formPlanId || null,
          priority: formPriority,
          status: formStatus,
          due_date: formDueDate || null,
          estimated_minutes: estMins,
        });

        if (error || !updatedTask) {
          setFormError(error?.message || 'Failed to update task.');
          setIsSubmitting(false);
          return;
        }

        // 2. Handle attachment replacement / upload if new file selected
        if (selectedFile) {
          const { path: uploadedPath, error: uploadErr } = await uploadAcademicFile({
            category: 'tasks',
            entityId: editingTaskId,
            file: selectedFile,
          });

          if (uploadErr || !uploadedPath) {
            setFormError(`Task details updated, but attachment upload failed: ${uploadErr?.message || 'Upload error'}`);
            setIsSubmitting(false);
            refreshStudentTasks(selectedStudentId);
            return;
          }

          // Update task row with new attachment metadata
          const { error: metaErr } = await updateTask(editingTaskId, {
            attachment_path: uploadedPath,
            attachment_name: selectedFile.name,
            attachment_size: selectedFile.size,
          });

          if (metaErr) {
            // Rollback newly uploaded file on metadata failure
            await deleteAcademicFile(uploadedPath);
            setFormError(`Attachment metadata could not be saved: ${metaErr.message}`);
            setIsSubmitting(false);
            refreshStudentTasks(selectedStudentId);
            return;
          }

          // Delete old attachment if one existed and path is different
          if (existingAttachment?.path && existingAttachment.path !== uploadedPath) {
            await deleteAcademicFile(existingAttachment.path);
          }
        } else if (removeExistingAttachment && existingAttachment?.path) {
          // Mentor chose to remove the existing attachment
          const { error: remErr } = await updateTask(editingTaskId, {
            attachment_path: null,
            attachment_name: null,
            attachment_size: null,
          });

          if (!remErr) {
            await deleteAcademicFile(existingAttachment.path);
          }
        }
      } else {
        // 1. Create task row first
        const { task: createdTask, error } = await createTask({
          studentId: selectedStudentId,
          createdBy: user?.id,
          subjectId: formSubjectId || undefined,
          planId: formPlanId || undefined,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          priority: formPriority,
          dueDate: formDueDate || undefined,
          estimatedMinutes: estMins,
        });

        if (error || !createdTask) {
          setFormError(error?.message || 'Failed to create task.');
          setIsSubmitting(false);
          return;
        }

        // 2. If an attachment was chosen, upload using confirmed task id
        if (selectedFile) {
          const { path: uploadedPath, error: uploadErr } = await uploadAcademicFile({
            category: 'tasks',
            entityId: createdTask.id,
            file: selectedFile,
          });

          if (uploadErr || !uploadedPath) {
            setFormError(`Task was created, but attachment upload failed: ${uploadErr?.message || 'Upload error'}`);
            setIsSubmitting(false);
            refreshStudentTasks(selectedStudentId);
            return;
          }

          // 3. Update task row with attachment metadata
          const { error: metaErr } = await updateTask(createdTask.id, {
            attachment_path: uploadedPath,
            attachment_name: selectedFile.name,
            attachment_size: selectedFile.size,
          });

          if (metaErr) {
            // Rollback newly uploaded file
            await deleteAcademicFile(uploadedPath);
            setFormError(`Task was created, but attachment metadata failed to save: ${metaErr.message}`);
            setIsSubmitting(false);
            refreshStudentTasks(selectedStudentId);
            return;
          }
        }
      }

      setIsModalOpen(false);
      refreshStudentTasks(selectedStudentId);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to save task.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Task Deletion with Failure Compensation
  const handleDeleteTask = async () => {
    if (!deleteTargetTask) return;
    setIsDeleting(true);

    const taskToDelete = deleteTargetTask;
    const originalAttachmentPath = taskToDelete.attachment_path;
    let storageDeleted = false;

    try {
      // 1 & 2. Delete Storage object first if task has an attachment
      if (originalAttachmentPath) {
        const { success: fileDeleted, error: storageErr } = await deleteAcademicFile(originalAttachmentPath);
        if (storageErr || !fileDeleted) {
          // 3. If Storage deletion fails, halt and report error without touching the database task
          setErrorMessage(
            `Unable to delete task attachment from storage: ${storageErr?.message || 'Storage deletion failed'}. The task was not removed.`
          );
          setDeleteTargetTask(null);
          return;
        }
        storageDeleted = true;
      }

      // 4. Attempt to delete the task database row
      const { error: dbDeleteErr } = await deleteTask(taskToDelete.id);

      // 5. If database deletion succeeds, finish normally
      if (!dbDeleteErr) {
        setDeleteTargetTask(null);
        refreshStudentTasks(selectedStudentId);
        return;
      }

      // 6. Database deletion failed
      if (storageDeleted && originalAttachmentPath) {
        // Attempt compensating metadata clearance
        const { error: compErr } = await updateTask(taskToDelete.id, {
          attachment_path: null,
          attachment_name: null,
          attachment_size: null,
        });

        if (!compErr) {
          // Compensating metadata clearance succeeded
          setErrorMessage(
            `Task deletion failed (${dbDeleteErr.message}), but its storage attachment was removed. Attachment metadata was cleared from task "${taskToDelete.title}" (ID: ${taskToDelete.id}) to maintain data integrity.`
          );
          refreshStudentTasks(selectedStudentId);
        } else {
          // 7. Compensating metadata update also failed
          setErrorMessage(
            `CRITICAL: Task deletion failed (${dbDeleteErr.message}) and its attachment file was removed, but clearing task attachment metadata also failed (${compErr.message}). Manual recovery required for task "${taskToDelete.title}" (ID: ${taskToDelete.id}). Attachment path was: ${originalAttachmentPath}.`
          );
          refreshStudentTasks(selectedStudentId);
        }
      } else {
        // Task had no attachment
        setErrorMessage(`Failed to delete task: ${dbDeleteErr.message}`);
      }

      setDeleteTargetTask(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unexpected error during task deletion.';
      setErrorMessage(msg);
      setDeleteTargetTask(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section aria-labelledby="mentor-tasks-title" className="border-2 border-brand-dark bg-brand-navy text-brand-paper shadow-brutal p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-brand-gold bg-brand-navy border border-brand-gold/40 px-2 py-0.5 shadow-brutal-xs">
                  Daily Targets
                </span>
              </div>
              <h1 id="mentor-tasks-title" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Study Tasks
              </h1>
              <p className="text-xs sm:text-sm text-brand-bg/80 font-sans max-w-2xl leading-relaxed">
                Assign and monitor daily study sessions, reading chapters, and problem set checkpoints for your assigned students.
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              disabled={loadingStudents || students.length === 0}
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
            >
              Assign Task
            </Button>
          </div>
        </section>

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-4 border-2 border-brand-dark bg-red-50 text-brand-dark shadow-brutal flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-sm text-red-900">
                Tasks Queue Alert
              </h3>
              <p className="text-xs text-red-700 font-sans">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Student Roster Selector */}
        <section aria-labelledby="roster-tasks-heading" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-teal stroke-[2.2]" />
              <h2 id="roster-tasks-heading" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                Select Assigned Student
              </h2>
            </div>
            <span className="font-mono text-xs text-brand-muted">
              {students.length} {students.length === 1 ? 'student assigned' : 'students assigned'}
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
                    {student.poraplan_id && (
                      <div className="font-mono text-[10px] opacity-80 mt-0.5">
                        ID: {student.poraplan_id}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Student's Tasks Queue */}
        {selectedStudentId && activeStudent && (
          <section aria-label="Student tasks list" className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2">
              <div>
                <h2 className="font-heading font-extrabold text-base text-brand-navy">
                  Tasks for {activeStudent.full_name}
                </h2>
                {activeStudent.poraplan_id && (
                  <span className="font-mono text-xs text-brand-muted">
                    Student ID: {activeStudent.poraplan_id}
                  </span>
                )}
              </div>

              <span className="font-mono text-xs font-bold bg-brand-paper border border-brand-dark px-2.5 py-1 shadow-brutal-xs">
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
              </span>
            </div>

            {loadingTasks ? (
              <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
                <span className="font-mono text-xs text-brand-muted block">Loading student tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-8 text-center space-y-4">
                <div className="w-12 h-12 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
                  <ListTodo className="w-6 h-6 text-brand-dark stroke-[2.2]" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="font-heading font-extrabold text-sm text-brand-navy">
                    NO TASKS ALLOCATED YET
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    You have not allocated any study activities for {activeStudent.full_name}. Schedule chapter reviews, problem sets, or concept checkpoints.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={openCreateModal}
                  leftIcon={<Plus className="w-3.5 h-3.5" />}
                >
                  Allocate First Task
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const isCompleted = task.status === 'completed';

                  return (
                    <article
                      key={task.id}
                      className={`border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${
                        isCompleted ? 'opacity-80 bg-brand-paper-tint' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3.5 flex-1">
                        {/* Status Checkbox Button */}
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(task)}
                          aria-label={isCompleted ? `Mark ${task.title} as pending` : `Mark ${task.title} as completed`}
                          className={`w-6 h-6 border-2 border-brand-dark flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                            isCompleted
                              ? 'bg-brand-teal text-white shadow-none'
                              : 'bg-white hover:bg-brand-paper shadow-brutal-xs'
                          }`}
                        >
                          {isCompleted ? <CheckCircle className="w-4 h-4" /> : <Circle className="w-3.5 h-3.5 text-brand-dark/30" />}
                        </button>

                        <div className="space-y-2 flex-1">
                          {/* Badges Strip */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {task.subject_name && (
                              <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-teal-light border border-brand-dark px-2 py-0.5 text-brand-navy flex items-center gap-1">
                                <BookOpen className="w-3 h-3 text-brand-navy" />
                                {task.subject_name}
                              </span>
                            )}

                            {task.plan_title && (
                              <span className="font-mono text-[10px] font-bold uppercase tracking-wider bg-brand-bg border border-brand-dark px-2 py-0.5 text-brand-muted flex items-center gap-1">
                                <Compass className="w-3 h-3 text-brand-muted" />
                                {task.plan_title}
                              </span>
                            )}

                            <Badge
                              variant={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'gold' : 'muted'}
                              size="sm"
                            >
                              {task.priority.toUpperCase()} PRIORITY
                            </Badge>

                            <Badge
                              variant={task.status === 'completed' ? 'teal' : task.status === 'in_progress' ? 'gold' : 'muted'}
                              size="sm"
                            >
                              {task.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>

                          {/* Title & Description */}
                          <div>
                            <h3
                              className={`font-heading font-extrabold text-base text-brand-navy ${
                                isCompleted ? 'line-through text-brand-dark/60' : ''
                              }`}
                            >
                              {task.title}
                            </h3>

                            {task.description && (
                              <p className="text-xs text-brand-dark/85 font-sans mt-1 leading-relaxed">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Mentor Task Attachment Pill */}
                          {task.attachment_path && (
                            <div className="mt-2 p-2.5 bg-brand-bg border-2 border-brand-dark flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <Paperclip className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                                <span className="font-mono font-bold text-brand-navy truncate max-w-[200px] sm:max-w-xs">
                                  {task.attachment_name || 'Attached Reference'}
                                </span>
                                {task.attachment_size && (
                                  <span className="font-mono text-[11px] text-brand-muted shrink-0">
                                    ({task.attachment_size < 1024 * 1024
                                      ? `${Math.round(task.attachment_size / 1024)} KB`
                                      : `${(task.attachment_size / (1024 * 1024)).toFixed(2)} MB`})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handlePreviewAttachment({
                                      name: task.attachment_name,
                                      size: task.attachment_size,
                                      path: task.attachment_path,
                                    })
                                  }
                                  className="px-2 py-1 bg-white border border-brand-dark font-heading text-[11px] font-bold text-brand-navy hover:bg-brand-paper shadow-brutal-xs flex items-center gap-1"
                                >
                                  <Eye className="w-3 h-3 text-brand-teal" />
                                  Preview
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadAttachment({
                                      name: task.attachment_name,
                                      path: task.attachment_path,
                                    })
                                  }
                                  className="px-2 py-1 bg-brand-navy border border-brand-dark font-heading text-[11px] font-bold text-white hover:bg-brand-navy/90 shadow-brutal-xs flex items-center gap-1"
                                >
                                  <Download className="w-3 h-3 text-brand-gold" />
                                  Download
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Timestamps */}
                          <div className="flex items-center gap-4 text-xs font-mono text-brand-muted pt-1">
                            {task.estimated_minutes && (
                              <span className="flex items-center gap-1 text-brand-navy font-bold">
                                <Clock className="w-3.5 h-3.5 text-brand-teal" />
                                {task.estimated_minutes} mins duration
                              </span>
                            )}
                            {task.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                Due: {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            )}
                            {task.completed_at && (
                              <span className="flex items-center gap-1 text-brand-teal font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Completed on {new Date(task.completed_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mentor Action Buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-start">
                        <button
                          type="button"
                          onClick={() => openEditModal(task)}
                          aria-label={`Edit ${task.title}`}
                          className="p-1.5 border border-brand-dark bg-brand-paper hover:bg-brand-bg shadow-brutal-xs text-brand-navy"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetTask(task)}
                          aria-label={`Delete ${task.title}`}
                          className="p-1.5 border border-brand-dark bg-red-50 hover:bg-red-100 shadow-brutal-xs text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Modal: Create or Edit Task */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-6 overflow-y-auto">
            <div className="max-w-lg w-full border-2 border-brand-dark bg-brand-paper shadow-brutal my-8 flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b-2 border-brand-dark bg-brand-navy text-brand-paper flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold block">
                    {editingTaskId ? 'EDIT TASK ITEM' : 'NEW TASK ALLOCATION'}
                  </span>
                  <h2 className="font-heading font-extrabold text-base sm:text-lg text-brand-bg">
                    {editingTaskId ? 'Update Scheduled Activity' : `Allocate Task for ${activeStudent?.full_name}`}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 border border-brand-paper/40 hover:bg-brand-paper/10 text-brand-paper"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Form */}
              <form onSubmit={handleSubmitTask} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-700 text-xs font-sans flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Task Title */}
                <div className="space-y-1">
                  <label htmlFor="task-title-input" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                    Task Title *
                  </label>
                  <input
                    id="task-title-input"
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Read Giancoli Ch. 4 & Solve Friction Problems"
                    className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                  />
                </div>

                {/* Subject & Plan Associations */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="task-subject-select" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                      Study Area / Subject
                    </label>
                    <select
                      id="task-subject-select"
                      value={formSubjectId}
                      onChange={(e) => setFormSubjectId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                    >
                      <option value="">General (No Subject)</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.code ? `(${s.code})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="task-plan-select" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                      Linked Study Plan
                    </label>
                    <select
                      id="task-plan-select"
                      value={formPlanId}
                      onChange={(e) => setFormPlanId(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                    >
                      <option value="">No Plan Linked</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Priority & Status Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="task-priority-select" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                      Priority
                    </label>
                    <select
                      id="task-priority-select"
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as TaskPriority)}
                      className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                    >
                      <option value="low">LOW</option>
                      <option value="medium">MEDIUM</option>
                      <option value="high">HIGH</option>
                    </select>
                  </div>

                  {editingTaskId && (
                    <div className="space-y-1">
                      <label htmlFor="task-status-select" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                        Task Status
                      </label>
                      <select
                        id="task-status-select"
                        value={formStatus}
                        onChange={(e) => setFormStatus(e.target.value as TaskStatus)}
                        className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                      >
                        <option value="pending">PENDING</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="completed">COMPLETED</option>
                      </select>
                    </div>
                  )}
                </div>

                {/* Duration & Due Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="task-duration-input" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                      Estimated Duration (Mins)
                    </label>
                    <input
                      id="task-duration-input"
                      type="number"
                      min="5"
                      step="5"
                      value={formEstimatedMinutes}
                      onChange={(e) => setFormEstimatedMinutes(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="task-due-date-input" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                      Target / Due Date
                    </label>
                    <input
                      id="task-due-date-input"
                      type="date"
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                    />
                  </div>
                </div>

                {/* Description / Instructions */}
                <div className="space-y-1">
                  <label htmlFor="task-desc-input" className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                    Instructions &amp; Checkpoints
                  </label>
                  <textarea
                    id="task-desc-input"
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Specific reading chapters, practice problems, or study checkpoints..."
                    className="w-full px-3 py-2 text-xs font-sans border-2 border-brand-dark bg-white focus:outline-none focus:ring-2 focus:ring-brand-teal shadow-brutal-xs"
                  />
                </div>

                {/* Reference Attachment Field */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-heading font-bold text-brand-navy uppercase tracking-wider">
                    Task Reference Attachment (Optional)
                  </label>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.docx"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  {/* Existing attachment display */}
                  {existingAttachment && !removeExistingAttachment && !selectedFile && (
                    <div className="p-3 bg-brand-bg border-2 border-brand-dark flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-brand-teal shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-brand-navy truncate">
                            {existingAttachment.name}
                          </p>
                          {existingAttachment.size && (
                            <span className="font-mono text-[10px] text-brand-muted">
                              {existingAttachment.size < 1024 * 1024
                                ? `${Math.round(existingAttachment.size / 1024)} KB`
                                : `${(existingAttachment.size / (1024 * 1024)).toFixed(2)} MB`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-2 py-1 bg-white border border-brand-dark text-xs font-heading font-bold text-brand-navy hover:bg-brand-paper shadow-brutal-xs"
                        >
                          Replace File
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveExistingAttachment}
                          className="px-2 py-1 bg-red-50 border border-red-500 text-xs font-heading font-bold text-red-700 hover:bg-red-100 shadow-brutal-xs"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Newly selected file display */}
                  {selectedFile && (
                    <div className="p-3 bg-teal-50 border-2 border-brand-teal flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-brand-teal shrink-0" />
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-brand-navy truncate">
                            {selectedFile.name}
                          </p>
                          <span className="font-mono text-[10px] text-brand-muted">
                            {selectedFile.size < 1024 * 1024
                              ? `${Math.round(selectedFile.size / 1024)} KB`
                              : `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveSelectedFile}
                        className="px-2 py-1 bg-white border border-brand-dark text-xs font-heading font-bold text-red-600 hover:bg-red-50 shadow-brutal-xs shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Upload button when no file is chosen or existing was removed */}
                  {(!existingAttachment || removeExistingAttachment) && !selectedFile && (
                    <div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full border-2 border-dashed border-brand-dark bg-white hover:bg-brand-paper-tint p-4 text-center transition-colors shadow-brutal-xs flex flex-col items-center justify-center gap-1.5"
                      >
                        <Upload className="w-5 h-5 text-brand-teal" />
                        <span className="font-heading font-bold text-xs text-brand-navy">
                          Upload Task Reference Attachment
                        </span>
                        <span className="font-mono text-[10px] text-brand-muted">
                          PDF, Word (.docx), or Images (PNG, JPG, WebP) — Max 10MB
                        </span>
                      </button>
                    </div>
                  )}

                  {selectedFileError && (
                    <p className="text-xs text-red-600 font-sans mt-1">{selectedFileError}</p>
                  )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-3 border-t-2 border-brand-dark flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsModalOpen(false)}
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
                    {isSubmitting ? 'Saving Task...' : editingTaskId ? 'Update Task' : 'Allocate Task'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {deleteTargetTask && (
          <div className="fixed inset-0 z-50 bg-brand-dark/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 space-y-4">
              <div className="w-12 h-12 bg-red-100 border-2 border-brand-dark mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-700 stroke-[2.5]" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-heading font-extrabold text-base text-brand-navy">
                  Confirm Task Removal
                </h3>
                <p className="text-xs text-brand-dark/80 font-sans">
                  Are you sure you want to remove <strong className="font-bold text-brand-dark">{deleteTargetTask.title}</strong> from this student&apos;s tasks?
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteTargetTask(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleDeleteTask}
                  disabled={isDeleting}
                  className="bg-red-700 hover:bg-red-800 text-white"
                  leftIcon={isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                >
                  {isDeleting ? 'Removing...' : 'Confirm Remove'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Attachment Viewer Modal */}
        <AttachmentViewerModal
          isOpen={viewerModal.isOpen}
          onClose={() => setViewerModal((prev) => ({ ...prev, isOpen: false }))}
          fileName={viewerModal.fileName}
          fileUrl={viewerModal.fileUrl}
          fileSize={viewerModal.fileSize}
          loading={viewerModal.loading}
          error={viewerModal.error}
          onDownload={() =>
            handleDownloadAttachment({
              name: viewerModal.fileName,
              path: viewerModal.filePath,
            })
          }
        />

      </div>
    </div>
  );
};
