import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getStudentTasks, setTaskStatus, type TaskWithMeta } from '../../lib/tasks';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile, TaskStatus } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  ListTodo,
  CheckCircle2,
  Clock,
  Calendar,
  BookOpen,
  Compass,
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
  Sparkles,
  ArrowRight,
  Circle,
  CheckCircle,
} from 'lucide-react';

export const StudentTasksPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const studentId = user?.id || '';

  const loadData = () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getStudentTasks(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([tasksRes, mentorsRes]) => {
        if (tasksRes.error) {
          setError(tasksRes.error.message);
        } else {
          setTasks(tasksRes.tasks);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load tasks.';
        setError(msg);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!studentId) {
      Promise.resolve().then(() => setLoading(false));
      return;
    }
    let isMounted = true;

    Promise.all([
      getStudentTasks(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([tasksRes, mentorsRes]) => {
        if (!isMounted) return;
        if (tasksRes.error) {
          setError(tasksRes.error.message);
        } else {
          setTasks(tasksRes.tasks);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load tasks.';
        setError(msg);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleToggleStatus = async (task: TaskWithMeta) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    setUpdatingTaskId(task.id);

    try {
      const { task: updated, error } = await setTaskStatus(task.id, nextStatus);
      if (!error && updated) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: updated.status, completed_at: updated.completed_at } : t))
        );
      }
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const assignedMentor = mentors.length > 0 ? mentors[0] : null;

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'all') return true;
    return task.status === statusFilter;
  });

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section aria-labelledby="tasks-heading" className="border-2 border-brand-dark bg-brand-navy text-brand-paper shadow-brutal p-5 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] tracking-wider uppercase font-bold text-brand-gold bg-brand-navy border border-brand-gold/40 px-2 py-0.5 shadow-brutal-xs">
                  DAILY TARGETS
                </span>
              </div>
              <h1 id="tasks-heading" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Today's Tasks
              </h1>
              <p className="text-xs sm:text-sm text-brand-bg/80 font-sans max-w-2xl leading-relaxed">
                Prioritized daily study tasks and practice sessions organized by your mentor.
              </p>
            </div>

            {/* Quick Stats Banner */}
            <div className="flex items-center gap-2.5 self-start sm:self-center">
              <div className="border border-brand-paper/30 bg-brand-navy p-2.5 text-center min-w-[75px] shadow-brutal-xs">
                <span className="text-[10px] font-mono text-brand-paper/70 block uppercase">Pending</span>
                <span className="text-lg font-heading font-extrabold text-brand-gold">{pendingCount + inProgressCount}</span>
              </div>
              <div className="border border-brand-paper/30 bg-brand-navy p-2.5 text-center min-w-[75px] shadow-brutal-xs">
                <span className="text-[10px] font-mono text-brand-paper/70 block uppercase">Completed</span>
                <span className="text-lg font-heading font-extrabold text-brand-teal-light">{completedCount}</span>
              </div>
            </div>
          </div>

          {/* Mentor Attribution Strip */}
          {assignedMentor && (
            <div className="mt-4 pt-3 border-t border-brand-paper/20 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-brand-bg/90">
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-gold" />
                <span>Assigned Mentor:</span>
                <strong className="text-brand-gold font-bold">
                  {assignedMentor.full_name}{assignedMentor.poraplan_id ? ` (${assignedMentor.poraplan_id})` : ''}
                </strong>
              </div>
              {profile?.poraplan_id && (
                <div className="text-[11px] text-brand-paper/70">
                  Student ID: <span className="text-brand-teal-light font-bold">{profile.poraplan_id}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Filter Tabs & Refresh Action */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 border-2 border-brand-dark bg-brand-paper p-1 shadow-brutal-xs self-start overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              ALL ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'pending'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              PENDING ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'in_progress'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              IN PROGRESS ({inProgressCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 font-heading text-xs font-bold transition-colors whitespace-nowrap ${
                statusFilter === 'completed'
                  ? 'bg-brand-navy text-brand-paper border border-brand-dark'
                  : 'text-brand-dark hover:bg-brand-bg'
              }`}
            >
              COMPLETED ({completedCount})
            </button>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-heading font-bold border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:bg-brand-bg transition-colors disabled:opacity-50 self-end sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 border-2 border-brand-dark bg-red-50 text-brand-dark shadow-brutal flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-heading font-extrabold text-sm text-red-900">
                Unable to load study tasks
              </h3>
              <p className="text-xs text-red-700 font-sans">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-2 text-xs font-bold underline text-red-900 hover:text-red-950 font-mono"
              >
                Retry request
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-12 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
            <h2 className="font-heading font-extrabold text-sm text-brand-navy">
              RETRIEVING SCHEDULED TASKS
            </h2>
            <span className="font-mono text-xs text-brand-muted block">
              Accessing verified student activity queue...
            </span>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredTasks.length === 0 && (
          <section aria-labelledby="empty-tasks-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
              <ListTodo className="w-8 h-8 text-brand-dark stroke-[2.2]" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 id="empty-tasks-title" className="font-heading font-extrabold text-lg text-brand-navy">
                NO TASKS IN THIS QUEUE
              </h2>
              <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                {statusFilter !== 'all'
                  ? `You have no tasks marked as "${statusFilter.replace('_', ' ')}" currently.`
                  : 'Your assigned mentor has not allocated any study activities for today. Check your active Study Plans or reach out to your mentor for guidance.'}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2">
              <Link to="/student/plans">
                <Button variant="outline" size="sm" leftIcon={<Compass className="w-3.5 h-3.5" />}>
                  View My Study Plans
                </Button>
              </Link>
              <Link to="/student/dashboard">
                <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Tasks List */}
        {!loading && !error && filteredTasks.length > 0 && (
          <section aria-label="Tasks list" className="space-y-3">
            {filteredTasks.map((task) => {
              const isCompleted = task.status === 'completed';
              const isUpdating = updatingTaskId === task.id;

              return (
                <article
                  key={task.id}
                  className={`border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-all ${
                    isCompleted ? 'opacity-80 bg-brand-paper-tint' : ''
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    {/* Completion Checkbox Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(task)}
                      disabled={isUpdating}
                      aria-label={isCompleted ? `Mark ${task.title} as pending` : `Mark ${task.title} as completed`}
                      className={`w-6 h-6 border-2 border-brand-dark flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        isCompleted
                          ? 'bg-brand-teal text-white shadow-none'
                          : 'bg-white hover:bg-brand-paper shadow-brutal-xs'
                      }`}
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-navy" />
                      ) : isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-brand-dark/30" />
                      )}
                    </button>

                    <div className="space-y-2 flex-1">
                      {/* Tags & Badges */}
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
                        <h2
                          className={`font-heading font-extrabold text-base text-brand-navy ${
                            isCompleted ? 'line-through text-brand-dark/60' : ''
                          }`}
                        >
                          {task.title}
                        </h2>

                        {task.description && (
                          <p className="text-xs text-brand-dark/85 font-sans mt-1 leading-relaxed">
                            {task.description}
                          </p>
                        )}
                      </div>

                      {/* Timestamps & Estimates */}
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
                </article>
              );
            })}
          </section>
        )}

        {/* Academic Workflow Guidance Footer */}
        <section aria-labelledby="task-workflow-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 border-2 border-brand-dark bg-brand-teal-light flex items-center justify-center shrink-0 shadow-brutal-xs">
              <Sparkles className="w-5 h-5 text-brand-navy stroke-[2.2]" />
            </div>
            <div>
              <h2 id="task-workflow-title" className="font-heading font-bold text-xs sm:text-sm text-brand-navy">
                Step 2: Study Discipline
              </h2>
              <p className="text-xs text-brand-muted font-sans">
                Complete daily scheduled tasks before proceeding to practice assignments and evaluation submissions.
              </p>
            </div>
          </div>

          <Link to="/student/plans" className="shrink-0">
            <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3 h-3" />}>
              Study Plans
            </Button>
          </Link>
        </section>

      </div>
    </div>
  );
};
