import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  getApplications,
  getApplicationStatusBadgeVariant,
} from '../../lib/applications';
import type { ProgramApplicationWithMeta } from '../../types/database';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Users,
  Compass,
  ArrowRight,
  Loader2,
} from 'lucide-react';

export const MyApplicationsPage: React.FC = () => {
  const { user, role } = useAuth();
  const userId = user?.id || '';

  const [applications, setApplications] = useState<ProgramApplicationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isStudent = role === 'student';
  const isMentor = role === 'mentor';

  useEffect(() => {
    let isMounted = true;
    async function loadUserApps() {
      if (!userId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getApplications({ applicantId: userId });
        if (!isMounted) return;
        if (res.error) {
          setError(res.error.message);
        } else {
          setApplications(res.applications);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load applications');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadUserApps();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-brand-dark pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs uppercase tracking-wider text-brand-muted">
              ADMISSIONS DESK
            </span>
            <span className="text-brand-muted">•</span>
            <span className="font-mono text-xs uppercase tracking-wider text-brand-teal font-bold">
              {isStudent ? 'STUDENT INTAKE' : 'FACULTY INTAKE'}
            </span>
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            My Program Applications
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-muted mt-0.5">
            Track your admission status, cohort assignments, and program enrollment records.
          </p>
        </div>

        <Button
          to="/programs"
          variant="primary"
          size="sm"
          rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
        >
          Explore All Programs
        </Button>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-3.5 border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-3 shadow-brutal-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 stroke-[2.5]" />
          <span className="font-sans text-xs sm:text-sm font-semibold">{error}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="p-10 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
          <p className="font-mono text-xs text-brand-muted">Retrieving your application history...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && applications.length === 0 && (
        <div className="p-10 sm:p-14 border-3 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 bg-brand-paper-tint border-2 border-brand-dark flex items-center justify-center mx-auto shadow-brutal-xs">
            <FileText className="w-6 h-6 text-brand-muted" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading font-extrabold text-lg text-brand-navy">
              No Applications Submitted
            </h2>
            <p className="font-sans text-xs text-brand-dark/75 leading-relaxed">
              You haven't submitted any program or cohort applications yet. Browse published programs to find academic mentorship or skill sprints matching your study goals.
            </p>
          </div>
          <Button to="/programs" variant="primary" size="md">
            Browse PoraPlan Programs
          </Button>
        </div>
      )}

      {/* Applications Cards List */}
      {!loading && !error && applications.length > 0 && (
        <div className="space-y-4">
          {applications.map((app) => {
            const isApproved = app.status === 'approved';
            const isPending = app.status === 'pending';
            const isUnderReview = app.status === 'under_review';
            const isRejected = app.status === 'rejected';

            return (
              <div
                key={app.id}
                className="p-5 sm:p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4"
              >
                {/* Card Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={app.program?.category === 'academic_mentorship' ? 'gold' : 'teal'}
                      size="sm"
                    >
                      {app.program?.category === 'academic_mentorship' ? 'Academic Mentorship' : 'SkillSprint'}
                    </Badge>

                    <Badge
                      variant={getApplicationStatusBadgeVariant(app.status)}
                      size="sm"
                    >
                      {app.status.toUpperCase()}
                    </Badge>

                    {app.cohort && (
                      <span className="font-mono text-xs font-bold text-brand-teal px-2 py-0.5 border border-brand-dark bg-brand-paper-tint">
                        {app.cohort.code}
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-xs text-brand-muted">
                    Submitted: {new Date(app.submitted_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Program & Cohort Titles */}
                <div className="space-y-1">
                  <Link
                    to={app.program?.slug ? `/programs/${app.program.slug}` : '#'}
                    className="font-heading font-black text-xl text-brand-navy hover:text-brand-teal transition-colors"
                  >
                    {app.program?.name || 'Program Offering'}
                  </Link>

                  {app.cohort && (
                    <p className="font-sans text-xs text-brand-dark font-medium flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-gold stroke-[2.2]" />
                      Target Intake: <strong>{app.cohort.name}</strong>
                    </p>
                  )}
                </div>

                {/* Submitted Motivation / Study Goals */}
                {app.application_message && (
                  <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint text-xs font-sans space-y-1">
                    <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                      Your Motivation Statement
                    </span>
                    <p className="text-brand-dark/90 leading-relaxed italic">
                      "{app.application_message}"
                    </p>
                  </div>
                )}

                {/* Status Specific Outcome Callouts */}
                {isApproved && isStudent && (
                  <div className="p-4 border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-sans text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-brutal-xs">
                    <div className="space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                        Active Enrollment Confirmed
                      </p>
                      <p className="text-[11px] text-emerald-900">
                        You have been admitted to this cohort. Your study roadmap, syllabus modules, and daily tasks are ready in your workspace.
                      </p>
                    </div>

                    <Button
                      to="/student/tasks"
                      variant="primary"
                      size="sm"
                      leftIcon={<Compass className="w-3.5 h-3.5" />}
                      className="shrink-0"
                    >
                      Go to Study Tasks
                    </Button>
                  </div>
                )}

                {isApproved && isMentor && (
                  <div className="p-4 border-2 border-brand-teal bg-teal-50 text-teal-950 font-sans text-xs flex items-center gap-2 shadow-brutal-xs">
                    <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.5] shrink-0" />
                    <div>
                      <p className="font-bold text-xs">Mentor Eligibility Approved</p>
                      <p className="text-[11px] text-teal-900 mt-0.5">
                        Your academic credentials have been verified. PoraPlan administration will coordinate student cohort assignment in the upcoming assignment round.
                      </p>
                    </div>
                  </div>
                )}

                {isUnderReview && (
                  <div className="p-3 border-2 border-brand-gold bg-amber-50 text-amber-950 font-sans text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700 stroke-[2.5] shrink-0" />
                    <span>
                      Admissions review in progress. Our academic coordinators are evaluating intake capacity and matching mentors.
                    </span>
                  </div>
                )}

                {isPending && (
                  <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint text-brand-dark font-sans text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-muted shrink-0" />
                    <span>
                      Queued for administrative review. You will receive an in-app notification when a decision is recorded.
                    </span>
                  </div>
                )}

                {isRejected && (
                  <div className="p-3 border-2 border-red-600 bg-red-50 text-red-950 font-sans text-xs space-y-1">
                    <p className="font-bold text-xs">Application Not Accepted</p>
                    <p className="text-[11px] text-red-900">
                      We were unable to accommodate your application for this specific cohort intake. Please consider applying for future batches or alternative SkillSprints.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
