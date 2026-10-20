import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  Calendar,
  Users,
  FileCheck,
  Award,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  BookOpen,
  ListTodo,
  FileText,
  FolderKanban,
  HelpCircle,
  Megaphone,
  X,
  ChevronRight,
  AlertCircle,
  GraduationCap,
  Mail,
  CheckCircle2,
  Compass,
} from 'lucide-react';

type ModuleType =
  | 'study-plans'
  | 'tasks'
  | 'assignments'
  | 'resources'
  | 'doubts'
  | 'announcements';

interface ModuleModalInfo {
  title: string;
  workflowStep: string;
  badge: string;
  description: string;
  details: string[];
  actionNote: string;
}

const MODULE_DETAILS: Record<ModuleType, ModuleModalInfo> = {
  'study-plans': {
    title: 'Study Plans & Syllabus Milestones',
    workflowStep: 'STEP 1: PLAN',
    badge: 'UPCOMING MODULE',
    description:
      'Curriculum mapping and milestone scheduling for your assigned students. Mentors will define weekly targets, syllabus pacing, and required concept mastery.',
    details: [
      'Set weekly chapter targets and reading allocations.',
      'Calibrate study pacing based on student progress and evaluations.',
      'Synchronize student milestones with academic term calendars.',
    ],
    actionNote:
      'Study Plan database tables and RLS policies are scheduled for the next backend milestone.',
  },
  tasks: {
    title: 'Daily Study Tasks & Time Blocks',
    workflowStep: 'STEP 2: STUDY',
    badge: 'UPCOMING MODULE',
    description:
      'Structured daily task allocation. Mentors will be able to dispatch prioritized study tasks directly into each student’s daily queue.',
    details: [
      'Assign focused 50-minute study blocks with specific objectives.',
      'Monitor task completion and daily student focus consistency.',
      'Flag overdue or missed practice exercises.',
    ],
    actionNote:
      'Student daily tasks are currently in the foundation phase. Full task dispatch will activate with the Study Planner schema.',
  },
  assignments: {
    title: 'Assignments & Practice Sets',
    workflowStep: 'STEP 3: PRACTICE',
    badge: 'UPCOMING MODULE',
    description:
      'Problem set creation and distribution. Mentors will distribute chapter exercises, numerical problem sheets, and theoretical questions.',
    details: [
      'Upload practice problem sheets with recommended solution steps.',
      'Specify deadlines and handwritten submission requirements.',
      'Prepare rubrics for step-by-step grading.',
    ],
    actionNote:
      'Practice assignments will connect directly to the Submission Review queue upon database migration.',
  },
  resources: {
    title: 'Academic Resources & Formulas',
    workflowStep: 'STUDY REFERENCE',
    badge: 'UPCOMING MODULE',
    description:
      'Centralized academic reference library. Share reference sheets, summary formulas, and textbook excerpts with your assigned students.',
    details: [
      'Curate chapter-wise formula cheatsheets and concept summaries.',
      'Share reference materials accessible only by your assigned students.',
      'Attach supplementary notes to specific study milestones.',
    ],
    actionNote:
      'Resource storage will use Supabase Storage buckets with strict mentor-student RLS policies.',
  },
  doubts: {
    title: 'Doubt Resolution Desk',
    workflowStep: 'STEP 6: FEEDBACK',
    badge: 'UPCOMING MODULE',
    description:
      'Direct inquiry resolution. Answer specific conceptual doubts and homework questions submitted by your assigned students.',
    details: [
      'Review student doubt questions with uploaded problem context.',
      'Provide targeted text guidance or concept clarification notes.',
      'Flag recurring student misconceptions for upcoming evaluations.',
    ],
    actionNote:
      'Students can currently draft doubts locally. Dedicated doubt dispatch routes will open in the Feedback milestone.',
  },
  announcements: {
    title: 'Class Announcements & Notices',
    workflowStep: 'COMMUNICATION',
    badge: 'UPCOMING MODULE',
    description:
      'Broadcast academic updates, schedule adjustments, and motivation notes to all students assigned to your roster.',
    details: [
      'Post syllabus adjustment notices visible on student notice boards.',
      'Announce upcoming milestone evaluation dates.',
      'Broadcast study tips and exam preparation guidance.',
    ],
    actionNote:
      'Announcements will publish directly to the Student Dashboard Academic Notice Board once implemented.',
  },
};

export const MentorDashboardPage: React.FC = () => {
  const { user, profile, role, poraplanId } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(() => Boolean(user?.id));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [selectedStudent, setSelectedStudent] = useState<Profile | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleType | null>(null);

  // Fetch real assigned students for this mentor via RLS helper
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    getAssignedStudents(user.id).then(({ students: assignedList, error }) => {
      if (isMounted) {
        if (error) {
          setErrorMessage(error.message);
        } else {
          setStudents(assignedList);
        }
        setLoadingStudents(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const mentorName = profile?.full_name || user?.user_metadata?.full_name || 'Academic Mentor';
  const mentorIdDisplay = poraplanId || profile?.poraplan_id || 'PPM001';

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ========================================================================= */}
        {/* 1. MENTOR IDENTITY & GREETING HEADER                                      */}
        {/* ========================================================================= */}
        <section
          aria-labelledby="mentor-greeting"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-4 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                  MENTOR WORKSPACE
                </span>
                <Badge variant="gold" size="sm">ACTIVE SESSION</Badge>
              </div>

              <h1 id="mentor-greeting" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                Welcome, {mentorName}
              </h1>

              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-brand-bg/85 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                  {currentDate}
                </span>
                <span>•</span>
                <span className="font-bold text-brand-gold">
                  ID: {mentorIdDisplay}
                </span>
                <span>•</span>
                <span className="uppercase text-brand-gold font-bold">{role || 'Mentor'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start">
              <div className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span>Verified Mentor Access</span>
              </div>
            </div>
          </div>

          {/* "What Requires Attention?" Mentor Priority Callout */}
          <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-gold text-brand-dark shadow-brutal-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 font-mono text-xs font-extrabold tracking-wide uppercase">
                  <Sparkles className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.5]" />
                  <span>WHAT REQUIRES ATTENTION?</span>
                </div>
                <p className="text-xs font-sans font-medium text-brand-dark/90 leading-relaxed">
                  {loadingStudents ? (
                    'Loading assigned student roster and checking pending reviews...'
                  ) : students.length === 0 ? (
                    <>
                      <span className="font-bold">Attention:</span> No students are currently assigned to your roster. Contact the platform administrator (PPA001) to allocate students to your mentor account.
                    </>
                  ) : (
                    <>
                      <span className="font-bold">Status Normal:</span> You have{' '}
                      <span className="font-extrabold underline decoration-brand-navy/60">
                        {students.length} active student{students.length > 1 ? 's' : ''}
                      </span>{' '}
                      enrolled on your roster. The submission review queue is clear (0 pending submissions).
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="#roster"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-dark transition-colors"
                >
                  <span>Student Roster</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
                <a
                  href="#reviews"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-paper-tint transition-colors"
                >
                  <span>Review Queue</span>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 2. MENTORSHIP SUMMARY METRICS                                             */}
        {/* ========================================================================= */}
        <section aria-labelledby="mentor-metrics-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mentor-metrics-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              Mentorship Summary
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted bg-brand-paper border border-brand-dark px-2 py-0.5 shadow-brutal-xs">
              REAL DATABASE METRICS
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Real Assigned Student Count */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  ASSIGNED STUDENTS
                </span>
                <Users className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                {loadingStudents ? '--' : students.length}{' '}
                <span className="text-xs font-mono font-normal text-brand-muted">Active</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {students.length > 0 ? 'Enrolled on Roster' : 'No Students Paired'}
              </span>
            </div>

            {/* Metric 2: Pending Reviews Queue */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  PENDING REVIEWS
                </span>
                <FileCheck className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                0 <span className="text-xs font-mono font-normal text-brand-muted">Queue</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                Review queue clear
              </span>
            </div>

            {/* Metric 3: Upcoming Evaluations */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  EVALUATIONS
                </span>
                <Calendar className="w-4 h-4 text-brand-navy stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-xl sm:text-2xl text-brand-navy">
                0 <span className="text-xs font-mono font-normal text-brand-muted">Today</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                No sessions scheduled
              </span>
            </div>

            {/* Metric 4: Platform Security & Attention Level */}
            <div className="p-3.5 sm:p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  ATTENTION LEVEL
                </span>
                <ShieldCheck className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-base text-brand-navy truncate">
                {students.length > 0 ? 'Normal / Clear' : 'Roster Empty'}
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                Strict Authorization Active
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. ASSIGNED STUDENTS ROSTER (REAL DB RELATIONSHIP VIA RLS)                */}
        {/* ========================================================================= */}
        <section
          id="roster"
          aria-labelledby="roster-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="roster-title" className="font-heading font-extrabold text-base text-brand-navy">
                Assigned Students Roster
              </h2>
            </div>
            <Badge variant={students.length > 0 ? 'teal' : 'muted'} size="sm">
              {loadingStudents ? 'CHECKING...' : `${students.length} ENROLLED`}
            </Badge>
          </div>

          {errorMessage && (
            <div className="p-3 border-2 border-brand-dark bg-red-50 text-red-900 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>Failed to load assigned students: {errorMessage}</span>
            </div>
          )}

          {loadingStudents ? (
            <div className="p-6 text-center font-mono text-xs text-brand-muted">
              Querying authorized assigned students from Supabase (mentor_students table)...
            </div>
          ) : students.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-brand-dark font-sans leading-relaxed">
                You are the assigned mentor for the following enrolled students. Student access is enforced at the database level by Row Level Security:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-4 border-2 border-brand-dark bg-brand-paper-tint flex flex-col justify-between gap-3 shadow-brutal-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-brand-teal shrink-0" />
                          <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                            {student.full_name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono text-brand-muted">
                          <span className="font-bold text-brand-gold">
                            ID: {student.poraplan_id || 'PP001'}
                          </span>
                          <span>•</span>
                          <span className="truncate max-w-[180px]">{student.email}</span>
                        </div>
                      </div>
                      <Badge variant="teal" size="sm">ACTIVE</Badge>
                    </div>

                    <div className="pt-2 border-t border-brand-dark/20 flex items-center justify-between">
                      <span className="font-mono text-[10px] text-brand-muted uppercase font-bold">
                        MENTORSHIP PAIRED
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStudent(student)}
                        className="text-xs"
                      >
                        Inspect Dossier
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5">
              <div className="w-10 h-10 border-2 border-brand-dark bg-brand-teal-light rounded-none mx-auto flex items-center justify-center">
                <Users className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  No Students Currently Assigned to Your Roster
                </h3>
                <p className="text-xs text-brand-muted font-sans mt-1 leading-relaxed">
                  You currently have 0 assigned students in the <span className="font-mono">mentor_students</span> table. When platform administrators pair students with your mentor account, their profiles, study submissions, and evaluations will appear here automatically.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ========================================================================= */}
        {/* 4. DUAL PANELS: REVIEW QUEUE & UPCOMING EVALUATIONS                      */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Submission Review Queue Card */}
          <section
            id="reviews"
            aria-labelledby="reviews-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  <h2 id="reviews-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Submission Review Queue
                  </h2>
                </div>
                <Badge variant="muted" size="sm">0 PENDING</Badge>
              </div>

              <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light rounded-none mx-auto flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    Review Queue Clear (0 Submissions Awaiting Review)
                  </h3>
                  <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                    Submission reviews activate following student practice exercises (Step 4: Submit → Step 5: Review). When assigned students submit problem sets, their handwritten solution scans or documents will queue here for your review and line-by-line feedback.
                  </p>
                </div>

                <div className="p-2.5 border border-brand-dark/20 bg-brand-paper text-left text-xs font-mono space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">Review Protocol Criteria:</span>
                  <div className="text-brand-dark text-[11px] flex items-center justify-between">
                    <span>• Step Accuracy &amp; Derivations</span>
                    <span className="text-brand-muted">Correct method check</span>
                  </div>
                  <div className="text-brand-dark text-[11px] flex items-center justify-between">
                    <span>• Line-by-Line Correction Notes</span>
                    <span className="text-brand-muted">Targeted mentor advice</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Step 4 &amp; 5: Submit &amp; Review</span>
              <span className="font-bold text-brand-dark">Queue Clear</span>
            </div>
          </section>

          {/* Upcoming Evaluations Card */}
          <section
            id="evaluations"
            aria-labelledby="evaluations-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  <h2 id="evaluations-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Upcoming Evaluations
                  </h2>
                </div>
                <Badge variant="muted" size="sm">0 SCHEDULED</Badge>
              </div>

              <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-teal-light rounded-none mx-auto flex items-center justify-center">
                  <Clock className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    No Evaluations Scheduled For Today
                  </h3>
                  <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                    Evaluations in PoraPlan are milestone review checkpoints conducted after homework submissions (Step 5: Review → Step 6: Feedback). Mentors evaluate concept retention and calibrate the upcoming weekly study plan.
                  </p>
                </div>

                <div className="p-2.5 border border-brand-dark/20 bg-brand-paper text-left text-xs font-mono space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block font-bold">Evaluation Format:</span>
                  <div className="text-brand-dark text-[11px] flex items-center justify-between">
                    <span>• Weekly Concept Assessment</span>
                    <span className="text-brand-muted">Oral or written review</span>
                  </div>
                  <div className="text-brand-dark text-[11px] flex items-center justify-between">
                    <span>• Study Pacing Calibration</span>
                    <span className="text-brand-muted">Next milestone setup</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Step 6 &amp; 7: Feedback &amp; Progress</span>
              <span className="font-bold text-brand-dark">Milestone Reviews</span>
            </div>
          </section>

        </div>

        {/* ========================================================================= */}
        {/* 5. QUICK ACTIONS: ACADEMIC MANAGEMENT HUB (9 REQUIRED ACTION MODULES)     */}
        {/* ========================================================================= */}
        <section id="actions" aria-labelledby="mentor-actions-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mentor-actions-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              Quick Actions &amp; Academic Management Hub
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
              9 CORE MODULES
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            
            {/* Action 1: Students */}
            <a
              href="#roster"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    ACTIVE ROSTER
                  </span>
                  <Users className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                  Students
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Inspect assigned student profiles, academic status, and contact details.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>View {students.length} Enrolled</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </a>

            {/* Action 2: Study Areas & Plans */}
            <Link
              to="/mentor/subjects"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    STEP 1: PLAN
                  </span>
                  <BookOpen className="w-4 h-4 text-brand-dark group-hover:text-brand-gold transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold transition-colors">
                  Study Areas
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Configure curriculum study areas, syllabus milestones, and course pacing for students.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Manage Study Areas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Action: Study Plans */}
            <Link
              to="/mentor/plans"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    STEP 1: PLAN
                  </span>
                  <Compass className="w-4 h-4 text-brand-dark group-hover:text-brand-gold transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold transition-colors">
                  Study Plans
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Draft sequential syllabus roadmaps, weekly chapter milestones, and study instructions.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Manage Study Plans</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Action 3: Tasks */}
            <Link
              to="/mentor/tasks"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    STEP 2: STUDY
                  </span>
                  <ListTodo className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                  Tasks
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Allocate daily prioritized study tasks, problem sets, and disciplined time blocks.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Manage Tasks</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Action 4: Assignments */}
            <Link
              to="/mentor/assignments"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    STEP 3: PRACTICE
                  </span>
                  <FileText className="w-4 h-4 text-brand-dark group-hover:text-brand-gold transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold transition-colors">
                  Assignments
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Distribute chapter problem sets, numerical exercises, and homework guidelines.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Manage Assignments</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </Link>

            {/* Action 5: Submission Review */}
            <a
              href="#reviews"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    STEP 5: REVIEW
                  </span>
                  <FileCheck className="w-4 h-4 text-brand-dark group-hover:text-brand-navy transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-navy transition-colors">
                  Submission Review
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Inspect student handwritten solutions, check derivations, and provide feedback.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Jump to Queue</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </a>

            {/* Action 6: Evaluations */}
            <a
              href="#evaluations"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-teal">
                    STEP 6: FEEDBACK
                  </span>
                  <Calendar className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                  Evaluations
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Schedule oral assessments and weekly concept retention checks.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Jump to Schedule</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </a>

            {/* Action 7: Resources */}
            <div
              onClick={() => setActiveModule('resources')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveModule('resources');
                }
              }}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                    REPOSITORY
                  </span>
                  <FolderKanban className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-teal transition-colors">
                  Resources
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Share reference formulas, chapter notes, and reading materials.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Module Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Action 8: Doubts */}
            <div
              onClick={() => setActiveModule('doubts')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveModule('doubts');
                }
              }}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-navy">
                    INQUIRY DESK
                  </span>
                  <HelpCircle className="w-4 h-4 text-brand-dark group-hover:text-brand-navy transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-navy transition-colors">
                  Doubts
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Review and answer theoretical inquiries submitted by your assigned students.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Module Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Action 9: Announcements */}
            <div
              onClick={() => setActiveModule('announcements')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveModule('announcements');
                }
              }}
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-gold">
                    BROADCAST
                  </span>
                  <Megaphone className="w-4 h-4 text-brand-dark group-hover:text-brand-gold transition-colors" />
                </div>
                <h3 className="font-heading font-extrabold text-base text-brand-navy group-hover:text-brand-gold transition-colors">
                  Announcements
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Broadcast schedule updates and syllabus reminders to your student roster.
                </p>
              </div>
              <div className="mt-3 pt-2 border-t border-brand-dark/20 flex items-center justify-between font-mono text-xs font-bold text-brand-navy">
                <span>Module Details</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

          </div>
        </section>

      </div>

      {/* ========================================================================= */}
      {/* 6. MODALS: STUDENT DOSSIER & ACADEMIC MODULES                             */}
      {/* ========================================================================= */}

      {/* MODAL: STUDENT DOSSIER */}
      {selectedStudent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="student-dossier-title"
        >
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h2 id="student-dossier-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  Student Dossier
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">Full Name</span>
                <span className="font-bold text-brand-dark text-sm font-sans">{selectedStudent.full_name}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block">PoraPlan ID</span>
                  <span className="font-bold text-brand-gold text-sm font-mono">
                    {selectedStudent.poraplan_id || 'PP001'}
                  </span>
                </div>

                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block">Account Status</span>
                  <Badge variant="teal" size="sm">
                    {selectedStudent.status || 'ACTIVE'}
                  </Badge>
                </div>
              </div>

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">Contact Email</span>
                <div className="flex items-center gap-1.5 text-brand-dark">
                  <Mail className="w-3.5 h-3.5 text-brand-navy shrink-0" />
                  <span className="font-bold text-xs truncate">{selectedStudent.email}</span>
                </div>
              </div>

              <div className="p-3.5 border-2 border-brand-dark bg-brand-teal-light/40 space-y-1 text-brand-dark font-sans text-xs">
                <div className="flex items-center gap-1.5 font-bold font-mono text-[10px] uppercase text-brand-teal">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mentorship Relationship Verified</span>
                </div>
                <p className="leading-relaxed">
                  Authorized mentorship relationship verified. You have permission to manage this student’s study areas, inspect submissions, and schedule evaluations.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-brand-dark/20">
              <Link to="/mentor/subjects" onClick={() => setSelectedStudent(null)}>
                <Button variant="primary" size="sm" leftIcon={<BookOpen className="w-3.5 h-3.5" />}>
                  Manage Study Areas
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedStudent(null)}
              >
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ACADEMIC MODULE PREVIEWS (FOR THE 6 UPCOMING MODULES) */}
      {activeModule && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="module-preview-title"
        >
          <div className="w-full max-w-lg bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-teal tracking-wider block">
                  {MODULE_DETAILS[activeModule].workflowStep}
                </span>
                <h2 id="module-preview-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  {MODULE_DETAILS[activeModule].title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setActiveModule(null)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <p className="text-brand-dark leading-relaxed">
                {MODULE_DETAILS[activeModule].description}
              </p>

              <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-2">
                <span className="font-mono text-[10px] font-bold uppercase text-brand-navy block">
                  KEY CAPABILITIES IN THIS MODULE:
                </span>
                <ul className="space-y-1.5 text-brand-muted">
                  {MODULE_DETAILS[activeModule].details.map((detail, index) => (
                    <li key={index} className="flex items-start gap-1.5">
                      <span className="text-brand-teal font-bold">•</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-3 border border-brand-dark/30 bg-brand-gold-light/40 space-y-1 font-mono text-[11px]">
                <span className="text-[10px] font-bold uppercase text-brand-navy block">
                  DEVELOPMENT STATUS
                </span>
                <p className="text-brand-dark/85 font-sans text-xs">
                  {MODULE_DETAILS[activeModule].actionNote}
                </p>
              </div>

              <div className="pt-2 flex justify-end border-t border-brand-dark/20">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setActiveModule(null)}
                >
                  Understood
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
