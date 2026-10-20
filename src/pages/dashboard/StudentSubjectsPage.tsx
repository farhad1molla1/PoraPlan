import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { getStudentSubjects } from '../../lib/subjects';
import { getAssignedMentors } from '../../lib/mentorship';
import type { Subject, Profile } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Users,
  Compass,
  ArrowLeft,
  Calendar,
} from 'lucide-react';

export const StudentSubjectsPage: React.FC = () => {
  const { user, profile } = useAuth();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mentors, setMentors] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentId = user?.id || '';

  const loadData = useCallback(() => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getStudentSubjects(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([subjectsRes, mentorsRes]) => {
        if (subjectsRes.error) {
          setError(subjectsRes.error.message);
        } else {
          setSubjects(subjectsRes.subjects);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to load study areas.';
        setError(msg);
        setLoading(false);
      });
  }, [studentId]);

  useEffect(() => {
    if (!studentId) return;
    let isMounted = true;

    Promise.all([
      getStudentSubjects(studentId),
      getAssignedMentors(studentId),
    ])
      .then(([subjectsRes, mentorsRes]) => {
        if (!isMounted) return;
        if (subjectsRes.error) {
          setError(subjectsRes.error.message);
        } else {
          setSubjects(subjectsRes.subjects);
        }
        setMentors(mentorsRes.mentors);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to load study areas.';
        setError(msg);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [studentId]);

  const assignedMentor = mentors.length > 0 ? mentors[0] : null;

  return (
    <div className="w-full py-5 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header Banner */}
        <section
          aria-labelledby="subjects-heading"
          className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-5 sm:p-7 shadow-brutal space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Link
                  to="/student/dashboard"
                  className="inline-flex items-center gap-1 font-mono text-xs uppercase font-bold text-brand-gold hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                  Dashboard
                </Link>
                <span className="text-brand-bg/50 font-mono text-xs">/</span>
                <span className="font-mono text-xs uppercase text-brand-teal font-bold tracking-wider">
                  STUDY AREAS
                </span>
              </div>

              <h1 id="subjects-heading" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg tracking-tight">
                My Study Areas &amp; Subjects
              </h1>

              <p className="text-xs sm:text-sm text-brand-bg/85 font-sans max-w-2xl leading-relaxed">
                Core academic courses organized for your mentorship study plan. Each study area anchors your daily tasks, practice exercises, and syllabus milestones.
              </p>
            </div>

            <div className="shrink-0">
              <Badge variant="teal" size="sm" className="font-mono">
                {subjects.length} {subjects.length === 1 ? 'SUBJECT' : 'SUBJECTS'} ENROLLED
              </Badge>
            </div>
          </div>

          {/* Quick Context Bar */}
          <div className="p-3 border-2 border-brand-dark bg-brand-paper text-brand-dark text-xs font-sans flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-brutal-xs">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-brand-teal shrink-0 stroke-[2.2]" />
              <span>
                <span className="font-bold text-brand-navy">Study Workflow Position:</span> Step 1: Plan &amp; Step 2: Study
              </span>
            </div>
            {assignedMentor && (
              <span className="font-mono text-[11px] text-brand-muted">
                Curated with Mentor: <strong className="text-brand-navy">{assignedMentor.full_name}</strong>
              </span>
            )}
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="p-8 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-brand-teal mx-auto" />
            <p className="font-heading font-bold text-sm text-brand-navy">
              Loading Your Study Areas...
            </p>
            <span className="font-mono text-xs text-brand-muted">
              Querying database records for {profile?.full_name || 'student'}
            </span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="p-4 border-2 border-brand-dark bg-red-50 text-red-900 shadow-brutal space-y-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
              <span>Unable to load study areas</span>
            </div>
            <p className="text-xs font-mono">{error}</p>
            <Button variant="outline" size="sm" onClick={loadData}>
              Try Again
            </Button>
          </div>
        )}

        {/* Content: List of Subjects */}
        {!loading && !error && subjects.length > 0 && (
          <section aria-label="Assigned Study Areas List" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 flex flex-col justify-between space-y-4 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {subject.code && (
                            <span className="font-mono text-[10px] font-extrabold uppercase px-2 py-0.5 border border-brand-dark bg-brand-paper-tint text-brand-navy shadow-brutal-xs">
                              {subject.code}
                            </span>
                          )}
                          <Badge variant={subject.status === 'active' ? 'teal' : 'muted'} size="sm">
                            {subject.status.toUpperCase()}
                          </Badge>
                        </div>
                        <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                          {subject.name}
                        </h2>
                      </div>

                      <div className="w-9 h-9 p-1 border-2 border-brand-dark bg-brand-teal-light flex items-center justify-center shrink-0 shadow-brutal-xs">
                        <BookOpen className="w-5 h-5 text-brand-navy stroke-[2.2]" />
                      </div>
                    </div>

                    <p className="text-xs text-brand-dark/85 font-sans leading-relaxed line-clamp-3">
                      {subject.description || 'Core syllabus study area for disciplined study sessions and problem practice.'}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-brand-dark/20 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-brand-muted">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{subject.created_at ? `Added ${new Date(subject.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Enrolled'}</span>
                    </div>

                    <Link
                      to={`/student/subjects/${subject.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-brand-dark bg-brand-navy text-brand-bg text-xs font-mono font-bold shadow-brutal-xs hover:bg-brand-dark transition-colors"
                    >
                      <span>Open Area</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Empty State */}
        {!loading && !error && subjects.length === 0 && (
          <section
            aria-label="No study areas assigned"
            className="p-6 sm:p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper shadow-brutal text-center space-y-4"
          >
            <div className="w-12 h-12 border-2 border-brand-dark bg-brand-teal-light mx-auto flex items-center justify-center shadow-brutal-xs">
              <BookOpen className="w-6 h-6 text-brand-teal stroke-[2.5]" />
            </div>

            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="font-heading font-extrabold text-lg text-brand-navy">
                No Study Areas Assigned Yet
              </h2>
              <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                In PoraPlan, your academic mentor organizes your course curriculum and configures your study areas (such as Physics, Higher Math, or Chemistry) to match your exact syllabus.
              </p>
            </div>

            {assignedMentor ? (
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint max-w-sm mx-auto text-left flex items-center gap-3">
                <Users className="w-5 h-5 text-brand-navy shrink-0" />
                <div className="text-xs font-sans">
                  <span className="font-bold text-brand-navy block">Assigned Mentor:</span>
                  <span className="text-brand-dark">{assignedMentor.full_name}</span>
                  <span className="block font-mono text-[10px] text-brand-muted">{assignedMentor.email}</span>
                </div>
              </div>
            ) : (
              <div className="p-3 border-2 border-brand-dark bg-brand-gold-light/40 max-w-sm mx-auto text-xs font-sans text-brand-dark">
                <span className="font-bold block mb-0.5">Self-Paced Track</span>
                Your account is currently awaiting mentor allocation. Once paired, your mentor will assign your curriculum study areas here.
              </div>
            )}

            <div className="pt-2">
              <Link to="/student/dashboard">
                <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </section>
        )}

        {/* Academic Guidance Note */}
        <section className="p-4 border-2 border-brand-dark bg-brand-paper-tint text-xs font-sans text-brand-dark space-y-1 shadow-brutal-xs">
          <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-brand-navy uppercase">
            <Sparkles className="w-3.5 h-3.5 text-brand-gold shrink-0 stroke-[2.5]" />
            <span>PoraPlan Curriculum Rule</span>
          </div>
          <p className="text-brand-dark/85 leading-relaxed">
            Every study area is bounded by structured chapter milestones. Avoid multitasking between unrelated subjects during single 50-minute study blocks.
          </p>
        </section>

      </div>
    </div>
  );
};
