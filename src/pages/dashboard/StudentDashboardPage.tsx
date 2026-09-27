import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import {
  Calendar,
  Target,
  ListTodo,
  TrendingUp,
  Users,
  Compass,
  FileText,
  Clock,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user, profile, role } = useAuth();
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(() => Boolean(user?.id));

  // Fetch real mentor pairings from database
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    getAssignedMentors(user.id).then(({ mentors: assignedList }) => {
      if (isMounted) {
        setMentors(assignedList);
        setLoadingMentors(false);
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

  const studentName = profile?.full_name || user?.user_metadata?.full_name || 'Academic Scholar';

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Workspace Greeting Ribbon Header */}
        <section
          aria-labelledby="student-greeting"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                STUDENT WORKSPACE
              </span>
              <Badge variant="teal" size="sm">ACTIVE SESSION</Badge>
            </div>

            <h1 id="student-greeting" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              Welcome, {studentName}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-brand-bg/80">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                {currentDate}
              </span>
              <span>•</span>
              <span className="truncate max-w-[200px]">Account: {user?.email}</span>
              <span>•</span>
              <span className="uppercase text-brand-teal font-bold">{role || 'Student'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              <span>Secure Session</span>
            </div>
          </div>
        </section>

        {/* Progress Summary Section */}
        <section id="progress" aria-labelledby="progress-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="progress-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              Study Progress Summary
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted bg-brand-paper border border-brand-dark px-2 py-0.5 shadow-brutal-xs">
              STUDY OVERVIEW
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1 */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  STUDY STREAK
                </span>
                <Clock className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                -- <span className="text-xs font-mono font-normal text-brand-muted">Days</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                Starts on your first study session
              </span>
            </div>

            {/* Metric 2 */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  DAILY TARGETS
                </span>
                <Target className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                -- <span className="text-xs font-mono font-normal text-brand-muted">Active</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                No tasks set for today
              </span>
            </div>

            {/* Metric 3 */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  SUBMISSIONS
                </span>
                <CheckCircle2 className="w-4 h-4 text-brand-navy stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                -- <span className="text-xs font-mono font-normal text-brand-muted">Sets</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                No submissions yet
              </span>
            </div>

            {/* Metric 4 */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  MENTOR STATUS
                </span>
                <Users className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-sm sm:text-base text-brand-navy truncate">
                {loadingMentors ? 'Checking...' : mentors.length > 0 ? mentors[0].full_name : 'Self-Paced'}
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {mentors.length > 0 ? 'Mentor Assigned' : 'Self-Paced Track'}
              </span>
            </div>
          </div>
        </section>

        {/* Primary Content Grid: Today's Focus & Upcoming Tasks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Today's Focus Placeholder */}
          <section
            id="focus"
            aria-labelledby="focus-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                  <h2 id="focus-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Today's Study Focus
                  </h2>
                </div>
                <Badge variant="muted" size="sm">NO ACTIVE FOCUS</Badge>
              </div>

              {/* Explicit Empty State Card */}
              <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-teal-light rounded-none mx-auto flex items-center justify-center">
                  <Target className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    No Focus Goal Set For Today
                  </h3>
                  <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                    Your daily focus block will define the primary topic you study today. You can select topics and set study timers once your subjects are loaded.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Daily Study Routine</span>
              <span className="font-bold text-brand-dark">Focus Session</span>
            </div>
          </section>

          {/* Upcoming Tasks Placeholder */}
          <section
            id="tasks"
            aria-labelledby="tasks-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <ListTodo className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  <h2 id="tasks-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Upcoming Tasks &amp; Queue
                  </h2>
                </div>
                <Badge variant="muted" size="sm">0 TASKS</Badge>
              </div>

              {/* Explicit Empty State Card */}
              <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light rounded-none mx-auto flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    Your Task Queue Is Empty
                  </h3>
                  <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                    Tasks scheduled by you or assigned by your mentor will appear here in order of priority.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Study Tasks</span>
              <span className="font-bold text-brand-dark">Assignment Queue</span>
            </div>
          </section>

        </div>

        {/* Mentorship Status Section */}
        <section
          id="mentorship"
          aria-labelledby="mentorship-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="mentorship-title" className="font-heading font-extrabold text-base text-brand-navy">
                Your Mentor
              </h2>
            </div>
            <Badge variant={mentors.length > 0 ? 'teal' : 'paper'} size="sm">
              {loadingMentors ? 'CHECKING...' : mentors.length > 0 ? 'MENTOR ASSIGNED' : 'SELF-PACED'}
            </Badge>
          </div>

          {loadingMentors ? (
            <div className="p-4 text-center font-mono text-xs text-brand-muted">
              Checking assigned mentor status...
            </div>
          ) : mentors.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-brand-dark font-sans leading-relaxed">
                You have an assigned mentor. Your mentor can review your submissions, answer your questions, and share feedback on your work:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {mentors.map((mentor) => (
                  <div
                    key={mentor.id}
                    className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between"
                  >
                    <div>
                      <h3 className="font-heading font-bold text-sm text-brand-navy">
                        {mentor.full_name}
                      </h3>
                      <p className="font-mono text-[11px] text-brand-muted mt-0.5">
                        {mentor.email}
                      </p>
                    </div>
                    <Badge variant="gold" size="sm">MENTOR</Badge>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Self-Paced Study Track
                </span>
              </div>
              <p className="text-xs text-brand-dark/85 font-sans leading-relaxed">
                You are currently studying independently. When a mentor is paired with your account, their feedback, problem sets, and study guidance will appear here automatically.
              </p>
            </div>
          )}
        </section>

        {/* Quick Links Section */}
        <section aria-labelledby="quick-links-title" className="space-y-3">
          <h2 id="quick-links-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
            <Compass className="w-4 h-4 text-brand-navy stroke-[2.5]" />
            Quick Links
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <Link
              to="/how-it-works"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                    STUDY GUIDE
                  </span>
                  <ArrowRight className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  The 7-Step Study Cycle
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Review the Plan → Study → Practice → Submit cycle.
                </p>
              </div>
            </Link>

            <Link
              to="/about"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                    ABOUT
                  </span>
                  <FileText className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  About PoraPlan
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Learn why we built PoraPlan and how it helps students.
                </p>
              </div>
            </Link>

            <div className="p-4 border-2 border-brand-dark bg-brand-gold-light/40 shadow-brutal flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-dark">
                    PRIVACY
                  </span>
                  <Sparkles className="w-4 h-4 text-brand-gold" />
                </div>
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  Private &amp; Protected
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Your study notes and submissions are strictly private.
                </p>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
