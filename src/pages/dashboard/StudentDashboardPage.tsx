import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedMentors } from '../../lib/mentorship';
import { getEffectiveMentor } from '../../lib/mentorAssignments';
import { getStudentTasks, setTaskStatus, type TaskWithMeta } from '../../lib/tasks';
import { getStudentStudyPlans, type StudyPlanWithMeta } from '../../lib/studyPlans';
import { getStudentAssignments, type AssignmentWithMeta } from '../../lib/assignments';
import { getStudentDoubts, type DoubtWithMeta } from '../../lib/doubts';
import { getStudentEvaluations, type EvaluationWithMeta } from '../../lib/evaluations';
import type { Profile, TaskStatus, EffectiveMentorResolution } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  ListTodo,
  TrendingUp,
  Clock,
  HelpCircle,
  ArrowRight,
  Mail,
  FileCheck,
  Award,
  ChevronRight,
  Check,
  Circle,
  Loader2,
  Phone,
  Paperclip,
  User,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user, profile, poraplanId, connectEmail } = useAuth();
  const studentId = user?.id || '';

  const [mentors, setMentors] = useState<Profile[]>([]);
  const [effectiveResolution, setEffectiveResolution] = useState<EffectiveMentorResolution | null>(null);
  const [tasks, setTasks] = useState<TaskWithMeta[]>([]);
  const [plans, setPlans] = useState<StudyPlanWithMeta[]>([]);
  const [assignments, setAssignments] = useState<AssignmentWithMeta[]>([]);
  const [doubts, setDoubts] = useState<DoubtWithMeta[]>([]);
  const [evaluations, setEvaluations] = useState<EvaluationWithMeta[]>([]);
  const [loading, setLoading] = useState(() => Boolean(studentId));
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  // Email connection banner state
  const [emailInput, setEmailInput] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  // Fetch real student workspace data
  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;
    Promise.all([
      getEffectiveMentor(studentId),
      getAssignedMentors(studentId),
      getStudentTasks(studentId),
      getStudentStudyPlans(studentId),
      getStudentAssignments(studentId),
      getStudentDoubts(studentId),
      getStudentEvaluations(studentId),
    ])
      .then(([effRes, mentorsRes, tasksRes, plansRes, assignmentsRes, doubtsRes, evalsRes]) => {
        if (!isMounted) return;
        setEffectiveResolution(effRes.resolution || null);
        setMentors(mentorsRes.mentors || []);
        setTasks(tasksRes.tasks || []);
        setPlans(plansRes.plans || []);
        setAssignments(assignmentsRes.assignments || []);
        setDoubts(doubtsRes.doubts || []);
        setEvaluations(evalsRes.evaluations || []);
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const handleToggleTaskStatus = async (task: TaskWithMeta) => {
    const nextStatus: TaskStatus = task.status === 'completed' ? 'pending' : 'completed';
    setUpdatingTaskId(task.id);
    try {
      const { task: updated } = await setTaskStatus(task.id, nextStatus);
      if (updated) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, status: updated.status, completed_at: updated.completed_at } : t))
        );
      }
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const handleLinkEmail = async () => {
    if (!emailInput.trim()) return;
    setIsLinking(true);
    setLinkMsg(null);
    const { error } = await connectEmail(emailInput.trim());
    if (error) {
      setLinkMsg(`Error: ${error.message}`);
    } else {
      setLinkMsg('Personal email linked successfully!');
      setEmailInput('');
    }
    setIsLinking(false);
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const studentName = profile?.full_name || user?.user_metadata?.full_name || 'Student';
  const assignedMentor = effectiveResolution?.mentor || (mentors.length > 0 ? mentors[0] : null);
  const assignmentType = effectiveResolution?.assignment_type || (assignedMentor ? 'cohort' : 'none');

  // Active plan & daily tasks
  const activePlan = plans.find((p) => p.status === 'active') || plans[0] || null;
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingAssignments = assignments.filter((a) => !a.submission);
  const openDoubts = doubts.filter((d) => d.status === 'open');
  const upcomingEval = evaluations.find((e) => e.status === 'scheduled');

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* 1. GREETING & MENTOR SECTION */}
        <section
          aria-labelledby="student-greeting"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          {/* Top Row: Greeting & Meta */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-brand-dark pb-3">
            <div>
              <h1 id="student-greeting" className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight">
                Welcome, {studentName}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-brand-muted mt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                  {currentDate}
                </span>
                {(poraplanId || profile?.poraplan_id) && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-brand-navy">
                      ID: {poraplanId || profile?.poraplan_id}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="teal" size="sm" className="font-mono uppercase font-bold">
                Student
              </Badge>
            </div>
          </div>

          {/* Mentor Information */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-brand-muted uppercase">Mentor</span>
                {assignmentType === 'individual' ? (
                  <Badge variant="teal" size="sm">Individual</Badge>
                ) : assignmentType === 'cohort' ? (
                  <Badge variant="gold" size="sm">Cohort</Badge>
                ) : null}
              </div>

              {assignedMentor ? (
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/profile/${assignedMentor.id}`}
                      className="text-base font-heading font-bold text-brand-navy hover:text-brand-teal transition-colors underline decoration-brand-dark/30 hover:decoration-brand-teal"
                    >
                      {assignedMentor.full_name}
                    </Link>
                    {assignedMentor.poraplan_id && (
                      <span className="font-mono text-xs px-1.5 py-0.5 bg-brand-paper-tint border border-brand-dark/30 text-brand-navy font-bold">
                        {assignedMentor.poraplan_id}
                      </span>
                    )}
                  </div>
                  {(assignedMentor.academic_background || assignedMentor.expertise) && (
                    <p className="text-xs text-brand-dark/80 font-sans mt-0.5 line-clamp-1">
                      {assignedMentor.academic_background || assignedMentor.expertise}
                    </p>
                  )}
                  {(effectiveResolution?.program || effectiveResolution?.cohort) && (
                    <p className="text-xs font-mono text-brand-muted mt-0.5">
                      {effectiveResolution.program && effectiveResolution.program.name}
                      {effectiveResolution.cohort && ` • ${effectiveResolution.cohort.name}`}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-brand-muted font-sans">
                  No mentor assigned yet. You will be notified when your mentor is assigned.
                </p>
              )}
            </div>

            {/* Direct Mentor Actions */}
            {assignedMentor && (
              <div className="flex items-center gap-2 shrink-0">
                {assignedMentor.whatsapp_number && (
                  <a
                    href={`https://wa.me/${assignedMentor.whatsapp_number.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-emerald-600 text-white text-xs font-mono font-bold shadow-brutal-xs hover:bg-emerald-700 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                )}
                <Link
                  to={`/profile/${assignedMentor.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-navy text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-paper-tint transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Profile</span>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* 2. TODAY'S STUDY & TASKS (PRIMARY FOCUS: "WHAT SHOULD I STUDY TODAY?") */}
        <section
          aria-labelledby="today-study-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-brand-dark pb-3">
            <div>
              <h2 id="today-study-title" className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
                What to Study Today
              </h2>
              {tasks.length > 0 && (
                <p className="text-xs font-mono text-brand-muted mt-0.5">
                  {pendingTasks.length} pending, {completedTasks.length} completed
                </p>
              )}
            </div>

            <Link to="/student/tasks">
              <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                View All Tasks
              </Button>
            </Link>
          </div>

          {/* Active Study Plan Banner */}
          {activePlan && (
            <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono font-bold text-brand-muted uppercase">
                    Study Plan
                  </span>
                  {activePlan.subject_name && (
                    <Badge variant="teal" size="sm">{activePlan.subject_name}</Badge>
                  )}
                </div>
                <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy truncate">
                  {activePlan.title}
                </h3>
              </div>

              <Link
                to={`/student/plans/${activePlan.id}`}
                className="shrink-0 font-mono text-xs font-bold text-brand-teal hover:underline flex items-center gap-1"
              >
                <span>Open Roadmap</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {/* Today's Tasks List */}
          {loading ? (
            <div className="p-6 text-center text-xs font-mono text-brand-muted flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
              <span>Loading tasks...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-brand-dark/30 bg-brand-paper-tint text-center space-y-2">
              <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light mx-auto flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-brand-dark" />
              </div>
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                No Tasks for Today
              </h3>
              <p className="text-xs text-brand-muted font-sans max-w-sm mx-auto">
                You are all caught up! Check back later or reach out to your mentor if you need new study targets.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.slice(0, 5).map((task) => {
                const isDone = task.status === 'completed';
                return (
                  <div
                    key={task.id}
                    className={`p-3 border-2 border-brand-dark flex items-start gap-3 transition-colors ${
                      isDone
                        ? 'bg-brand-paper-tint/60 opacity-75'
                        : 'bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleTaskStatus(task)}
                      disabled={updatingTaskId === task.id}
                      className="relative -m-2.5 p-2.5 sm:m-0 sm:p-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                      title={isDone ? 'Mark as pending' : 'Mark as completed'}
                      aria-label={`Toggle task completion for ${task.title}`}
                    >
                      <span
                        className={`w-5 h-5 border-2 border-brand-dark flex items-center justify-center shrink-0 transition-colors ${
                          isDone ? 'bg-brand-teal text-white' : 'bg-brand-paper hover:bg-brand-gold-light'
                        }`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Circle className="w-3 h-3 text-transparent" />}
                      </span>
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <h4 className={`font-heading font-bold text-sm text-brand-navy ${isDone ? 'line-through text-brand-muted' : ''}`}>
                          {task.title}
                        </h4>
                        {task.estimated_minutes && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-brand-gold-light border border-brand-dark flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {task.estimated_minutes} min
                          </span>
                        )}
                        {task.attachment_path && (
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.2 bg-brand-teal-light border border-brand-dark flex items-center gap-1 text-brand-navy"
                            title={task.attachment_name || 'Attachment attached'}
                          >
                            <Paperclip className="w-3 h-3 text-brand-teal" />
                            File
                          </span>
                        )}
                        {task.priority === 'high' && (
                          <Badge variant="danger" size="sm">High Priority</Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className="text-xs text-brand-dark/80 font-sans line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    {task.subject_name && (
                      <span className="hidden sm:inline font-mono text-[10px] text-brand-muted border border-brand-dark/20 px-2 py-0.5 shrink-0">
                        {task.subject_name}
                      </span>
                    )}
                  </div>
                );
              })}

              {tasks.length > 5 && (
                <div className="text-center pt-1">
                  <Link
                    to="/student/tasks"
                    className="font-mono text-xs font-bold text-brand-teal hover:underline inline-flex items-center gap-1"
                  >
                    <span>View {tasks.length - 5} more tasks</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. STUDY STATUS (CURRENT REAL-TIME COUNTS) */}
        <section aria-labelledby="workspace-metrics-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="workspace-metrics-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-teal" />
              Study Status
            </h2>
            <Link
              to="/student/progress"
              className="font-mono text-xs font-bold text-brand-navy hover:underline flex items-center gap-1"
            >
              <span>Full Progress</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Today's Tasks */}
            <Link
              to="/student/tasks"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-brand-muted">
                  Tasks
                </span>
                <ListTodo className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {pendingTasks.length} <span className="text-xs font-mono font-normal text-brand-muted">Pending</span>
              </div>
              <span className="text-[11px] font-mono text-brand-teal font-bold mt-1">
                {completedTasks.length} completed
              </span>
            </Link>

            {/* Card 2: Assignments */}
            <Link
              to="/student/assignments"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-brand-muted">
                  Assignments
                </span>
                <FileCheck className="w-4 h-4 text-brand-gold" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {pendingAssignments.length} <span className="text-xs font-mono font-normal text-brand-muted">To Submit</span>
              </div>
              <span className="text-[11px] font-mono text-brand-muted mt-1">
                {assignments.length - pendingAssignments.length} submitted
              </span>
            </Link>

            {/* Card 3: Doubts */}
            <Link
              to="/student/doubts"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-brand-muted">
                  Doubts
                </span>
                <HelpCircle className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {openDoubts.length} <span className="text-xs font-mono font-normal text-brand-muted">Open</span>
              </div>
              <span className="text-[11px] font-mono text-brand-teal font-bold mt-1">
                {doubts.filter((d) => d.status === 'answered' || d.status === 'resolved').length} answered
              </span>
            </Link>

            {/* Card 4: Evaluation */}
            <Link
              to="/student/evaluations"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-bold text-brand-muted">
                  Evaluations
                </span>
                <Award className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="font-heading font-extrabold text-sm sm:text-base text-brand-navy truncate">
                {upcomingEval ? 'Scheduled' : 'None Scheduled'}
              </div>
              <span className="text-[11px] font-mono text-brand-muted mt-1">
                {evaluations.filter((e) => e.status === 'completed').length} completed
              </span>
            </Link>
          </div>
        </section>

        {/* 4. EMAIL CONNECTION (OPTIONAL BACKUP) */}
        {!profile?.linked_email && (
          <section className="p-4 border-2 border-brand-dark bg-brand-gold-light shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-brand-navy">
                <Mail className="w-4 h-4 text-brand-navy shrink-0" />
                <span>Link Personal Email</span>
              </div>
              <p className="text-xs text-brand-dark/85 font-sans">
                Link your personal email address for password recovery and Google sign-in.
              </p>
              {linkMsg && (
                <p className="text-[11px] font-sans font-bold text-emerald-800 pt-0.5">{linkMsg}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="yourname@gmail.com"
                className="px-2.5 py-1.5 text-xs border-2 border-brand-dark bg-brand-paper font-sans"
              />
              <button
                type="button"
                onClick={handleLinkEmail}
                disabled={isLinking}
                className="px-3 py-1.5 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold hover:bg-brand-dark shadow-brutal-xs"
              >
                {isLinking ? 'Linking...' : 'Connect'}
              </button>
            </div>
          </section>
        )}

      </div>
    </div>
  );
};
