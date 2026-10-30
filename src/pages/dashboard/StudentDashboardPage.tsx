import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedMentors } from '../../lib/mentorship';
import { getStudentTasks, setTaskStatus, type TaskWithMeta } from '../../lib/tasks';
import { getStudentStudyPlans, type StudyPlanWithMeta } from '../../lib/studyPlans';
import { getStudentAssignments, type AssignmentWithMeta } from '../../lib/assignments';
import { getStudentDoubts, type DoubtWithMeta } from '../../lib/doubts';
import { getStudentEvaluations, type EvaluationWithMeta } from '../../lib/evaluations';
import type { Profile, TaskStatus } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  ListTodo,
  TrendingUp,
  Users,
  Compass,
  Clock,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Mail,
  BookOpen,
  FileCheck,
  Award,
  ChevronRight,
  Check,
  BookMarked,
  Megaphone,
  Circle,
  Loader2,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user, profile, role, poraplanId, connectEmail } = useAuth();
  const studentId = user?.id || '';

  const [mentors, setMentors] = useState<Profile[]>([]);
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
      getAssignedMentors(studentId),
      getStudentTasks(studentId),
      getStudentStudyPlans(studentId),
      getStudentAssignments(studentId),
      getStudentDoubts(studentId),
      getStudentEvaluations(studentId),
    ])
      .then(([mentorsRes, tasksRes, plansRes, assignmentsRes, doubtsRes, evalsRes]) => {
        if (!isMounted) return;
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
  const assignedMentor = mentors.length > 0 ? mentors[0] : null;

  // Active plan & daily tasks
  const activePlan = plans.find((p) => p.status === 'active') || plans[0] || null;
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingAssignments = assignments.filter((a) => !a.submission);
  const openDoubts = doubts.filter((d) => d.status === 'open');
  const upcomingEval = evaluations.find((e) => e.status === 'scheduled');

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* 1. GREETING & MENTOR CONNECTION HEADER */}
        <section
          aria-labelledby="student-greeting"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                  STUDY WORKSPACE
                </span>
                <Badge variant="teal" size="sm">ACTIVE</Badge>
              </div>

              <h1 id="student-greeting" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Welcome, {studentName}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-brand-bg/85 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                  {currentDate}
                </span>
                {(poraplanId || profile?.poraplan_id) && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-brand-gold">
                      ID: {poraplanId || profile?.poraplan_id}
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="uppercase text-brand-teal font-bold">{role || 'Student'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start">
              <div className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>Personal Study Assistance</span>
              </div>
            </div>
          </div>

          {/* Mentor Status Strip */}
          <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-gold text-brand-dark shadow-brutal-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wide uppercase">
                  <Users className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.5]" />
                  <span>YOUR MENTOR</span>
                </div>
                <p className="text-xs font-sans font-medium text-brand-dark/90 leading-relaxed">
                  {assignedMentor ? (
                    <>
                      <span className="font-bold">{assignedMentor.full_name}</span> is organizing your study schedule. Need quick help? Reach out on WhatsApp or submit a doubt below.
                    </>
                  ) : (
                    'Your mentor pairing is being set up. You can view your study materials or contact support.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/student/doubts"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-dark transition-colors"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Ask a Doubt</span>
                </Link>
                <Link
                  to="/student/plans"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-paper-tint transition-colors"
                >
                  <span>Study Plans</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 2. TODAY'S STUDY & TASKS (THE CORE ANSWER: WHAT DO I STUDY TODAY?) */}
        <section aria-labelledby="today-study-title" className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <Sparkles className="w-4 h-4 text-brand-teal" />
                <span className="font-mono text-xs font-bold uppercase text-brand-teal">
                  TODAY'S TARGETS
                </span>
              </div>
              <h2 id="today-study-title" className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
                What to Study Today
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <Link to="/student/tasks">
                <Button variant="outline" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  View All Tasks
                </Button>
              </Link>
            </div>
          </div>

          {/* Active Study Plan Overview */}
          {activePlan && (
            <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-[11px] font-mono font-bold text-brand-muted uppercase">
                  <span>ACTIVE STUDY PLAN</span>
                  {activePlan.subject_name && (
                    <span className="px-1.5 py-0.2 bg-brand-teal text-white">
                      {activePlan.subject_name}
                    </span>
                  )}
                </div>
                <h3 className="font-heading font-bold text-base text-brand-navy">
                  {activePlan.title}
                </h3>
                {activePlan.description && (
                  <p className="text-xs text-brand-dark/80 font-sans line-clamp-1">
                    {activePlan.description}
                  </p>
                )}
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
              <span>Loading today's study targets...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-6 border-2 border-dashed border-brand-dark/30 bg-brand-paper-tint text-center space-y-2">
              <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light mx-auto flex items-center justify-center">
                <ListTodo className="w-5 h-5 text-brand-dark" />
              </div>
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                No Tasks Scheduled For Today
              </h3>
              <p className="text-xs text-brand-muted font-sans max-w-md mx-auto leading-relaxed">
                Your mentor organizes your study targets based on your syllabus and upcoming exam deadlines. Check back soon or message your mentor if you're ready for new work.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs font-mono text-brand-muted">
                <span>
                  Showing {pendingTasks.length} pending, {completedTasks.length} completed
                </span>
                <span className="text-[11px]">Click checkbox to mark complete</span>
              </div>

              <div className="space-y-2">
                {tasks.slice(0, 5).map((task) => {
                  const isDone = task.status === 'completed';
                  return (
                    <div
                      key={task.id}
                      className={`p-3 border-2 border-brand-dark flex items-start gap-3 transition-colors ${
                        isDone ? 'bg-brand-paper-tint/60 opacity-75' : 'bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTaskStatus(task)}
                        disabled={updatingTaskId === task.id}
                        className={`mt-0.5 w-5 h-5 border-2 border-brand-dark flex items-center justify-center shrink-0 transition-colors ${
                          isDone ? 'bg-brand-teal text-white' : 'bg-brand-paper hover:bg-brand-gold-light'
                        }`}
                        title={isDone ? 'Mark as pending' : 'Mark as completed'}
                        aria-label={`Toggle task completion for ${task.title}`}
                      >
                        {isDone ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Circle className="w-3 h-3 text-transparent" />}
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
              </div>

              {tasks.length > 5 && (
                <div className="text-center pt-1">
                  <Link
                    to="/student/tasks"
                    className="font-mono text-xs font-bold text-brand-teal hover:underline inline-flex items-center gap-1"
                  >
                    <span>View {tasks.length - 5} more tasks in queue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 3. FOUR CORE WORKSPACE CARDS (REAL STATUS AT A GLANCE) */}
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
              <span>Full Progress Report</span>
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
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  TASKS
                </span>
                <ListTodo className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {pendingTasks.length} <span className="text-xs font-mono font-normal text-brand-muted">Pending</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {completedTasks.length} Completed
              </span>
            </Link>

            {/* Card 2: Assignments */}
            <Link
              to="/student/assignments"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  ASSIGNMENTS
                </span>
                <FileCheck className="w-4 h-4 text-brand-gold" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {pendingAssignments.length} <span className="text-xs font-mono font-normal text-brand-muted">To Submit</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                {assignments.length - pendingAssignments.length} Submitted
              </span>
            </Link>

            {/* Card 3: Doubts */}
            <Link
              to="/student/doubts"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  DOUBTS
                </span>
                <HelpCircle className="w-4 h-4 text-brand-teal" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {openDoubts.length} <span className="text-xs font-mono font-normal text-brand-muted">Open</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {doubts.filter((d) => d.status === 'answered' || d.status === 'resolved').length} Answered
              </span>
            </Link>

            {/* Card 4: Evaluation */}
            <Link
              to="/student/evaluations"
              className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  EVALUATION
                </span>
                <Award className="w-4 h-4 text-brand-navy" />
              </div>
              <div className="font-heading font-extrabold text-sm sm:text-base text-brand-navy truncate">
                {upcomingEval ? 'Scheduled' : 'None Scheduled'}
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                {evaluations.filter((e) => e.status === 'completed').length} Completed Reviews
              </span>
            </Link>
          </div>
        </section>

        {/* 4. PRIMARY MODULES QUICK HUB */}
        <section aria-labelledby="modules-hub-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="modules-hub-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Compass className="w-4 h-4 text-brand-navy" />
              Study Modules
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {/* Study Plans */}
            <Link
              to="/student/plans"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    ROADMAPS
                  </span>
                  <Compass className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Study Plans
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Weekly chapter roadmaps and milestone goals organized by your mentor.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>View Plans ({plans.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Assignments */}
            <Link
              to="/student/assignments"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    PRACTICE
                  </span>
                  <FileCheck className="w-4 h-4 text-brand-dark group-hover:text-brand-gold" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold">
                  Assignments
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Practice problem sets and homework to submit for mentor review and feedback.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-gold">
                <span>Open Assignments ({assignments.length})</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Doubts */}
            <Link
              to="/student/doubts"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    HELP
                  </span>
                  <HelpCircle className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Doubts
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Stuck on a problem or formula? Ask your mentor directly and get clear answers.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>Ask a Doubt</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Resources */}
            <Link
              to="/student/resources"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    LIBRARY
                  </span>
                  <BookMarked className="w-4 h-4 text-brand-dark group-hover:text-brand-navy" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-navy">
                  Study Resources
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Curated formula sheets, lecture notes, and textbook problems shared by your mentor.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Open Resources</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Announcements */}
            <Link
              to="/student/announcements"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    NOTICES
                  </span>
                  <Megaphone className="w-4 h-4 text-brand-dark group-hover:text-brand-gold" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold">
                  Announcements
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Schedule updates, exam guidance, and directives from your mentor.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-gold">
                <span>View Notices</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Subjects */}
            <Link
              to="/student/subjects"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    COURSES
                  </span>
                  <BookOpen className="w-4 h-4 text-brand-dark group-hover:text-brand-teal" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal">
                  Subjects
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Your university courses and syllabus outlines organized for your study plan.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy group-hover:text-brand-teal">
                <span>View Subjects</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          </div>
        </section>

        {/* 5. EMAIL CONNECTION (OPTIONAL BACKUP) */}
        {!profile?.linked_email && (
          <section className="p-4 border-2 border-brand-dark bg-brand-gold-light shadow-brutal-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-brand-navy">
                <Mail className="w-4 h-4 text-brand-navy shrink-0" />
                <span>LINK YOUR PERSONAL EMAIL</span>
              </div>
              <p className="text-xs text-brand-dark/85 font-sans">
                Link your personal email address for self-service password recovery and Google sign-in.
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
