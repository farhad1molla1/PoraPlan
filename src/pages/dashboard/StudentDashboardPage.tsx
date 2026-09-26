import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  LogOut,
  CheckCircle2,
  Clock,
  Calendar,
  Flame,
  Award,
  ArrowRight,
  ListTodo,
  FileCheck,
  HelpCircle,
  FolderGit2,
} from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'queue' | 'subjects' | 'feedback'>('queue');
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(() => Boolean(user?.id));

  // Fetch assigned mentor pairings using RLS-compliant helper
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

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="w-full min-h-[calc(100vh-140px)] py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Workspace Ribbon Header */}
        <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                STUDENT SECTOR // WORKSPACE
              </span>
              <Badge variant="teal" size="sm">ACTIVE CYCLE</Badge>
              <span className="font-mono text-[10px] text-brand-bg/60">
                // SYNCED WITH SUPABASE RLS
              </span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              {profile?.full_name || 'Academic Scholar'}
            </h1>
            
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-brand-bg/80">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-gold" />
                {currentDate}
              </span>
              <span>•</span>
              <span>Account: {user?.email}</span>
              <span>•</span>
              <span className="uppercase text-brand-teal font-bold">{role}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              className="bg-brand-paper text-brand-dark hover:bg-brand-gold-light text-xs font-mono font-bold"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Quick Metrics Dossier */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          
          <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                ACTIVE STREAK
              </span>
              <Flame className="w-4 h-4 text-brand-gold stroke-[2.5]" />
            </div>
            <div className="font-heading font-extrabold text-2xl text-brand-navy">
              1 <span className="text-xs font-mono font-normal text-brand-muted">Day</span>
            </div>
            <span className="text-[10px] font-mono text-brand-teal font-bold mt-1">
              Active Study Habit
            </span>
          </div>

          <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                DAILY QUEUE
              </span>
              <ListTodo className="w-4 h-4 text-brand-teal stroke-[2.5]" />
            </div>
            <div className="font-heading font-extrabold text-2xl text-brand-navy">
              3 <span className="text-xs font-mono font-normal text-brand-muted">Targets</span>
            </div>
            <span className="text-[10px] font-mono text-brand-dark/70 mt-1">
              1 Completed Today
            </span>
          </div>

          <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                SUBMISSIONS
              </span>
              <FileCheck className="w-4 h-4 text-brand-navy stroke-[2.5]" />
            </div>
            <div className="font-heading font-extrabold text-2xl text-brand-navy">
              0 <span className="text-xs font-mono font-normal text-brand-muted">Pending</span>
            </div>
            <span className="text-[10px] font-mono text-brand-dark/70 mt-1">
              All sets reviewed
            </span>
          </div>

          <div className="p-4 border-2 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted">
                MENTOR STATUS
              </span>
              <Award className="w-4 h-4 text-brand-gold-dark stroke-[2.5]" />
            </div>
            <div className="font-heading font-extrabold text-base text-brand-navy truncate">
              {loadingMentors ? 'Checking...' : mentors.length > 0 ? mentors[0].full_name : 'Unassigned'}
            </div>
            <span className="text-[10px] font-mono text-brand-muted mt-1">
              {mentors.length > 0 ? 'Assigned & Active' : 'Self-Paced Track'}
            </span>
          </div>

        </div>

        {/* Assigned Mentor Advisory Banner */}
        {mentors.length === 0 && !loadingMentors && (
          <div className="border-2 border-brand-dark bg-brand-teal-light/60 p-4 shadow-brutal-xs flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
            <div className="space-y-0.5 text-xs font-sans">
              <span className="font-bold text-brand-dark font-mono text-[11px] block uppercase tracking-wider">
                ACADEMIC MENTORSHIP STATUS // OPEN QUEUE
              </span>
              <p className="text-brand-dark/85 leading-relaxed">
                You are currently operating in your independent study docket. Once an academic mentor is paired with your profile, their tailored problem sets and evaluations will appear here automatically.
              </p>
            </div>
          </div>
        )}

        {/* Tabbed Study Engine Console */}
        <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal overflow-hidden">
          
          {/* Tab Navigation */}
          <div className="flex border-b-2 border-brand-dark bg-brand-paper-tint overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('queue')}
              className={`px-4 sm:px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all border-r-2 border-brand-dark flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'queue'
                  ? 'bg-brand-paper text-brand-navy border-b-2 border-b-brand-paper -mb-[2px]'
                  : 'text-brand-muted hover:text-brand-dark hover:bg-brand-paper/50'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
              Today's Study Queue
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('subjects')}
              className={`px-4 sm:px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all border-r-2 border-brand-dark flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'subjects'
                  ? 'bg-brand-paper text-brand-navy border-b-2 border-b-brand-paper -mb-[2px]'
                  : 'text-brand-muted hover:text-brand-dark hover:bg-brand-paper/50'
              }`}
            >
              <FolderGit2 className="w-3.5 h-3.5 stroke-[2.5]" />
              Syllabus &amp; Subjects
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('feedback')}
              className={`px-4 sm:px-6 py-3 font-mono text-xs font-bold uppercase tracking-wider transition-all border-r-2 border-brand-dark flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'feedback'
                  ? 'bg-brand-paper text-brand-navy border-b-2 border-b-brand-paper -mb-[2px]'
                  : 'text-brand-muted hover:text-brand-dark hover:bg-brand-paper/50'
              }`}
            >
              <Award className="w-3.5 h-3.5 stroke-[2.5]" />
              Mentor Feedback
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="p-5 sm:p-7">
            
            {activeTab === 'queue' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                  <div>
                    <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                      Daily Study Workflow Docket
                    </h2>
                    <p className="text-xs text-brand-muted font-mono mt-0.5">
                      Canonical 7-Step Cycle: Plan → Study → Practice → Submit
                    </p>
                  </div>
                  <Badge variant="gold" size="sm">CYCLE 01</Badge>
                </div>

                {/* Sample Structured Study Objectives */}
                <div className="space-y-2.5 pt-1">
                  
                  <div className="p-3.5 border-2 border-brand-dark bg-brand-bg flex items-center justify-between gap-3 shadow-brutal-xs">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-none border-2 border-brand-dark bg-brand-teal text-white flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-dark">
                            01 // Review Mechanics Formulas
                          </span>
                          <span className="px-1.5 py-0.2 bg-brand-teal-light text-brand-dark text-[10px] font-mono border border-brand-dark">
                            COMPLETED
                          </span>
                        </div>
                        <p className="text-xs text-brand-dark/70 font-sans mt-0.5">
                          Kinematics equations, rotational motion, and angular acceleration principles.
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-brand-muted hidden sm:inline-block">
                      45m
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper flex items-center justify-between gap-3 shadow-brutal-xs">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-none border-2 border-brand-dark bg-brand-paper-tint text-brand-muted flex items-center justify-center shrink-0 mt-0.5">
                        <Clock className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-dark">
                            02 // Solve Calculus Problem Set A
                          </span>
                          <span className="px-1.5 py-0.2 bg-brand-gold-light text-brand-dark text-[10px] font-mono border border-brand-dark">
                            IN PROGRESS
                          </span>
                        </div>
                        <p className="text-xs text-brand-dark/70 font-sans mt-0.5">
                          Integration by parts and trigonometric substitution drills (Questions 1 to 12).
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-brand-muted hidden sm:inline-block">
                      60m
                    </span>
                  </div>

                  <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between gap-3 shadow-brutal-xs opacity-80">
                    <div className="flex items-start gap-3">
                      <div className="h-6 w-6 rounded-none border-2 border-brand-dark bg-brand-paper text-brand-muted flex items-center justify-center shrink-0 mt-0.5">
                        <ListTodo className="w-4 h-4 stroke-[2]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-brand-dark">
                            03 // Submit Practice Work For Review
                          </span>
                          <span className="px-1.5 py-0.2 bg-brand-paper text-brand-muted text-[10px] font-mono border border-brand-dark">
                            QUEUED
                          </span>
                        </div>
                        <p className="text-xs text-brand-dark/70 font-sans mt-0.5">
                          Upload handwritten solutions to portal for mentor evaluation and error correction.
                        </p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-brand-muted hidden sm:inline-block">
                      15m
                    </span>
                  </div>

                </div>

                <div className="p-3 bg-brand-paper-tint border-2 border-brand-dark text-xs font-mono flex items-center justify-between mt-4">
                  <span className="text-brand-dark/80">
                    Daily task database schema connects in upcoming milestone.
                  </span>
                  <span className="text-brand-teal font-bold uppercase text-[11px]">
                    Phase 2 Core Pipeline
                  </span>
                </div>
              </div>
            )}

            {activeTab === 'subjects' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                  <div>
                    <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                      Syllabus &amp; Focus Sectors
                    </h2>
                    <p className="text-xs text-brand-muted font-mono mt-0.5">
                      Enrolled academic disciplines and milestone benchmarks
                    </p>
                  </div>
                  <Badge variant="teal" size="sm">ACTIVE TRACK</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                  
                  <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                        Applied Physics
                      </span>
                      <span className="text-[10px] font-mono font-bold text-brand-teal">
                        45% COMPLETED
                      </span>
                    </div>
                    <div className="w-full bg-brand-paper-tint h-2 border border-brand-dark overflow-hidden">
                      <div className="bg-brand-teal h-full w-[45%]" />
                    </div>
                    <p className="text-xs text-brand-dark/75 font-sans">
                      Current Chapter: Rotational Dynamics &amp; Harmonic Motion.
                    </p>
                  </div>

                  <div className="p-4 border-2 border-brand-dark bg-brand-bg shadow-brutal-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                        Higher Mathematics
                      </span>
                      <span className="text-[10px] font-mono font-bold text-brand-gold-dark">
                        30% COMPLETED
                      </span>
                    </div>
                    <div className="w-full bg-brand-paper-tint h-2 border border-brand-dark overflow-hidden">
                      <div className="bg-brand-gold h-full w-[30%]" />
                    </div>
                    <p className="text-xs text-brand-dark/75 font-sans">
                      Current Chapter: Definite Integrals and Differential Equations.
                    </p>
                  </div>

                </div>
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
                  <div>
                    <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                      Mentor Corrections &amp; Guidance
                    </h2>
                    <p className="text-xs text-brand-muted font-mono mt-0.5">
                      Direct feedback on practice sets and conceptual guidance
                    </p>
                  </div>
                  <Badge variant="navy" size="sm" className="bg-brand-paper text-brand-dark">
                    EVALUATION
                  </Badge>
                </div>

                {mentors.length > 0 ? (
                  <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-2">
                    <span className="font-mono text-xs font-bold uppercase text-brand-navy block">
                      Assigned Mentor: {mentors[0].full_name} ({mentors[0].email})
                    </span>
                    <p className="text-xs text-brand-dark font-sans leading-relaxed">
                      Your submissions will be reviewed directly by {mentors[0].full_name}. Feedback reports and line-by-line problem set corrections will be logged in this section.
                    </p>
                  </div>
                ) : (
                  <div className="p-6 border-2 border-brand-dark bg-brand-paper-tint text-center space-y-2">
                    <Award className="w-8 h-8 text-brand-muted mx-auto stroke-[1.5]" />
                    <h3 className="font-heading font-bold text-sm text-brand-navy">
                      No Mentor Assigned Yet
                    </h3>
                    <p className="text-xs text-brand-dark/70 font-sans max-w-md mx-auto">
                      Once a mentor is paired with your academic account via the admin console, your review queue and corrective notes will display here.
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

        {/* Phase Roadmap Footer Dossier */}
        <div className="border-2 border-brand-dark bg-brand-paper p-4 shadow-brutal-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-brand-gold font-bold">NEXT ARCHITECTURAL STEP:</span>
            <span className="text-brand-dark/80">Subjects &amp; Study Plans Database Engine</span>
          </div>
          <div className="flex items-center gap-1.5 text-brand-teal font-bold">
            <span>Review Specifications</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </div>

      </div>
    </div>
  );
};
