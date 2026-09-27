import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedStudents } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import {
  Calendar,
  Users,
  FileCheck,
  Award,
  Sparkles,
  ShieldCheck,
  Clock,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

export const MentorDashboardPage: React.FC = () => {
  const { user, profile, role } = useAuth();
  const [students, setStudents] = useState<Profile[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(() => Boolean(user?.id));

  // Fetch assigned students for this mentor via RLS helper
  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    getAssignedStudents(user.id).then(({ students: assignedList }) => {
      if (isMounted) {
        setStudents(assignedList);
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

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Workspace Greeting Ribbon Header */}
        <section
          aria-labelledby="mentor-greeting"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-4"
        >
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                MENTOR SECTOR // SUPERVISION CONSOLE
              </span>
              <Badge variant="gold" size="sm">ACTIVE DOCKET</Badge>
              <span className="font-mono text-[10px] text-brand-bg/60 hidden sm:inline">
                // RLS ENFORCED
              </span>
            </div>

            <h1 id="mentor-greeting" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              Welcome, {mentorName}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono text-brand-bg/80">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                {currentDate}
              </span>
              <span>•</span>
              <span className="truncate max-w-[200px]">Account: {user?.email}</span>
              <span>•</span>
              <span className="uppercase text-brand-gold font-bold">{role || 'Mentor'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-mono font-bold shadow-brutal-xs flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-teal" />
              <span>Mentor-Student RLS Active</span>
            </div>
          </div>
        </section>

        {/* Metrics Row (Transparent Placeholders & Real DB Count) */}
        <section aria-labelledby="mentor-metrics-title" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="mentor-metrics-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
              <Award className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              Mentorship Oversight Summary
            </h2>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted bg-brand-paper border border-brand-dark px-2 py-0.5 shadow-brutal-xs">
              Live RLS Sync
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Metric 1: Real Student Count */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  ASSIGNED STUDENTS
                </span>
                <Users className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                {loadingStudents ? '--' : students.length} <span className="text-xs font-mono font-normal text-brand-muted">Students</span>
              </div>
              <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
                {students.length > 0 ? 'Active Roster' : 'Awaiting Pairings'}
              </span>
            </div>

            {/* Metric 2: Pending Reviews Placeholder */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  PENDING REVIEWS
                </span>
                <FileCheck className="w-4 h-4 text-brand-gold stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                0 <span className="text-xs font-mono font-normal text-brand-muted">Queue</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                Review queue clear
              </span>
            </div>

            {/* Metric 3: Upcoming Evaluations Placeholder */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  EVALUATIONS
                </span>
                <Calendar className="w-4 h-4 text-brand-navy stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-2xl text-brand-navy">
                0 <span className="text-xs font-mono font-normal text-brand-muted">Today</span>
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                No sessions scheduled
              </span>
            </div>

            {/* Metric 4: Platform Security Status */}
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                  SECURITY POLICY
                </span>
                <ShieldCheck className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              </div>
              <div className="font-heading font-extrabold text-base text-brand-navy truncate">
                Isolated
              </div>
              <span className="text-[10px] font-mono text-brand-muted mt-1">
                Zero data leakage
              </span>
            </div>
          </div>
        </section>

        {/* Student Roster Section (Real DB Query + Empty State) */}
        <section
          id="roster"
          aria-labelledby="roster-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-brand-navy stroke-[2.5]" />
              <h2 id="roster-title" className="font-heading font-extrabold text-base text-brand-navy">
                Assigned Student Roster
              </h2>
            </div>
            <Badge variant={students.length > 0 ? 'teal' : 'muted'} size="sm">
              {loadingStudents ? 'CHECKING...' : `${students.length} ENROLLED`}
            </Badge>
          </div>

          {loadingStudents ? (
            <div className="p-4 text-center font-mono text-xs text-brand-muted">
              Querying assigned students through Row Level Security...
            </div>
          ) : students.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-brand-dark font-sans">
                You have active mentorship oversight over the following student scholars:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {students.map((student) => (
                  <div
                    key={student.id}
                    className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between shadow-brutal-xs"
                  >
                    <div>
                      <h3 className="font-heading font-bold text-sm text-brand-navy">
                        {student.full_name}
                      </h3>
                      <p className="font-mono text-[11px] text-brand-muted mt-0.5">
                        {student.email}
                      </p>
                    </div>
                    <Badge variant="teal" size="sm">STUDENT</Badge>
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
                  You currently have 0 assigned students. In PoraPlan's secure architecture, students are paired with mentors via administrator pairing. Once paired, their dossiers and problem set submissions will appear here.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Dual Panels: Review Queue & Upcoming Evaluations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          
          {/* Pending Review Placeholder */}
          <section
            id="reviews"
            aria-labelledby="reviews-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  <h2 id="reviews-title" className="font-heading font-extrabold text-base text-brand-navy">
                    Submission Review Queue
                  </h2>
                </div>
                <Badge variant="muted" size="sm">QUEUE CLEAR</Badge>
              </div>

              <div className="p-5 border-2 border-dashed border-brand-dark/40 bg-brand-paper-tint text-center space-y-2.5 my-2">
                <div className="w-10 h-10 border-2 border-brand-dark bg-brand-gold-light rounded-none mx-auto flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy">
                    0 Submissions Awaiting Evaluation
                  </h3>
                  <p className="text-xs text-brand-muted font-sans mt-1 max-w-sm mx-auto leading-relaxed">
                    When assigned students complete and submit problem sets, assignments, or reflection logs, they will queue here for rubric-based grading and mentor feedback.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Rubric Engine</span>
              <span className="font-bold text-brand-dark">Phase 2 Docket</span>
            </div>
          </section>

          {/* Upcoming Evaluation Placeholder */}
          <section
            id="evaluations"
            aria-labelledby="evaluations-title"
            className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 flex flex-col justify-between"
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
                    Milestone evaluation checkpoints and weekly syncs will appear on your schedule as assigned students reach syllabus milestones.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between text-xs font-mono text-brand-muted">
              <span>Schedule Engine</span>
              <span className="font-bold text-brand-dark">Phase 2 Docket</span>
            </div>
          </section>

        </div>

        {/* Quick Actions & Navigation Section */}
        <section aria-labelledby="mentor-actions-title" className="space-y-3">
          <h2 id="mentor-actions-title" className="font-heading font-extrabold text-sm sm:text-base text-brand-navy flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-gold stroke-[2.5]" />
            Quick Actions &amp; Specifications
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                    ACTION DOCKET
                  </span>
                  <Badge variant="muted" size="sm">PHASE 2</Badge>
                </div>
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  Assign Problem Target
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Create structured study tasks and assign them to specific students.
                </p>
              </div>
            </div>

            <Link
              to="/how-it-works"
              className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                    METHODOLOGY
                  </span>
                  <ArrowRight className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  7-Step Mentorship Engine
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Review the evaluation rubric and review pipeline.
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
                    DOCUMENTATION
                  </span>
                  <ExternalLink className="w-4 h-4 text-brand-dark group-hover:text-brand-teal transition-colors" />
                </div>
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  System Specifications
                </h3>
                <p className="text-xs text-brand-muted mt-1 leading-relaxed">
                  Platform architecture, pedagogy, and design rules.
                </p>
              </div>
            </Link>
          </div>
        </section>

      </div>
    </div>
  );
};
