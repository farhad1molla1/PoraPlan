import React, { useState, useEffect } from 'react';
import { getPrograms, getCohorts } from '../lib/programs';
import type { Program, Cohort } from '../types/database';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  GraduationCap,
  Zap,
  ArrowRight,
  BookOpen,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';

export const ProgramsPage: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [programsRes, cohortsRes] = await Promise.all([
          getPrograms({ includeUnpublished: false }), // Public visitors only see published programs
          getCohorts(),
        ]);

        if (!isMounted) return;

        if (programsRes.error) {
          setError(programsRes.error.message);
        } else {
          setPrograms(programsRes.programs);
          setCohorts(cohortsRes.cohorts);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load programs');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const academicPrograms = programs.filter(
    (p) => p.category === 'academic_mentorship'
  );
  const upskillingPrograms = programs.filter(
    (p) => p.category === 'skillsprint'
  );

  const renderProgramCard = (program: Program) => {
    const isAcademic = program.category === 'academic_mentorship';
    const isOpen = program.enrollment_status === 'open';
    const programCohorts = cohorts.filter(
      (c) => c.program_id === program.id && c.status !== 'archived'
    );
    const activeCohort =
      programCohorts.find((c) => c.status === 'active') || programCohorts[0];

    return (
      <div
        key={program.id}
        className="border-3 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between hover:-translate-x-1 hover:-translate-y-1 transition-transform"
      >
        {/* Program Thumbnail or Restrained Placeholder */}
        {program.cover_image_url ? (
          <div className="w-full h-44 sm:h-48 border-b-2 border-brand-dark bg-brand-paper-tint overflow-hidden">
            <img
              src={program.cover_image_url}
              alt={program.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="w-full h-36 border-b-2 border-brand-dark bg-brand-paper-tint flex flex-col items-center justify-center p-4 text-center space-y-2">
            <div className="p-2.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
              {isAcademic ? (
                <GraduationCap className="w-5 h-5 text-brand-gold stroke-[2.5]" />
              ) : (
                <Zap className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              )}
            </div>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted tracking-wider">
              {isAcademic ? 'Academic Program' : 'Upskilling Program'}
            </span>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Status & Category Badges */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-dark/20 pb-2.5">
              <Badge variant={isAcademic ? 'gold' : 'teal'} size="sm">
                {isAcademic ? 'Academic Program' : 'Upskilling Program'}
              </Badge>

              {isOpen ? (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-emerald-800 px-2 py-0.5 border border-emerald-700 bg-emerald-50 shadow-brutal-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
                  Enrollment Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-brand-muted px-2 py-0.5 border border-brand-dark/30 bg-brand-paper-tint">
                  Enrollment Closed
                </span>
              )}
            </div>

            {/* Program Title */}
            <h3 className="font-heading font-black text-lg sm:text-xl text-brand-navy leading-snug">
              {program.name}
            </h3>

            {/* Short Description */}
            <p className="font-sans text-xs sm:text-sm text-brand-dark/80 leading-relaxed">
              {program.short_description}
            </p>

            {/* Relevant Cohort / Batch / Semester info */}
            {activeCohort && (
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  {isAcademic ? 'Target Academic Batch' : 'Active Cohort'}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="font-sans text-xs font-bold text-brand-navy">
                    {activeCohort.name}
                  </span>
                  {activeCohort.code && (
                    <span className="font-mono text-[10px] font-bold text-brand-teal px-1.5 py-0.2 bg-white border border-brand-dark/30">
                      {activeCohort.code}
                    </span>
                  )}
                </div>
                {activeCohort.start_date && (
                  <span className="font-mono text-[10px] text-brand-muted flex items-center gap-1 pt-0.5">
                    <Calendar className="w-3 h-3 text-brand-muted" />
                    Term: {activeCohort.start_date}
                    {activeCohort.end_date ? ` – ${activeCohort.end_date}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Card Action Footer */}
          <div className="pt-4 border-t-2 border-brand-dark flex items-center justify-between gap-3 mt-4">
            <span className="font-mono text-[11px] text-brand-muted">
              {program.duration ||
                (programCohorts.length > 0
                  ? `${programCohorts.length} Cohort${programCohorts.length > 1 ? 's' : ''}`
                  : 'Term Mentorship')}
            </span>
            <Button
              to={`/programs/${program.slug}`}
              variant="primary"
              size="sm"
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              View Details
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full py-10 sm:py-16 px-4 sm:px-6 lg:px-8 academic-grid-pattern min-h-[85vh]">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Page Header */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs font-mono text-xs uppercase font-bold text-brand-navy">
            <GraduationCap className="w-4 h-4 text-brand-gold stroke-[2.5]" />
            Program Catalog
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-5xl text-brand-navy tracking-tight leading-tight">
            Academic &amp; Upskilling Programs
          </h1>
          <p className="font-sans text-sm sm:text-base text-brand-dark/80 leading-relaxed">
            Explore structured academic semester mentorship and practical developer skill sprints.
          </p>
        </div>

        {/* Loading & Error States */}
        {loading && (
          <div className="p-12 text-center border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-md mx-auto space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
            <p className="font-heading font-extrabold text-sm text-brand-navy">
              LOADING PROGRAMS
            </p>
            <p className="font-mono text-xs text-brand-muted">
              Fetching available learning programs and cohorts...
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 border-2 border-brand-dark bg-red-50 text-red-950 flex items-center gap-3 shadow-brutal max-w-2xl mx-auto">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 stroke-[2.5]" />
            <span className="font-sans text-xs sm:text-sm font-semibold">{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-14">
            {/* Section 1: Academic Programs */}
            <section className="space-y-6">
              <div className="border-b-3 border-brand-dark pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-brand-navy">
                    <GraduationCap className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                    <h2 className="font-heading font-black text-xl sm:text-2xl tracking-tight">
                      Academic Programs
                    </h2>
                  </div>
                  <p className="font-sans text-xs sm:text-sm text-brand-dark/75 mt-1">
                    Structured semester syllabus planning, daily routine organization, and dedicated mentor supervision.
                  </p>
                </div>
                <span className="font-mono text-xs text-brand-muted">
                  {academicPrograms.length} {academicPrograms.length === 1 ? 'Program' : 'Programs'} Available
                </span>
              </div>

              {academicPrograms.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper text-center space-y-1">
                  <BookOpen className="w-8 h-8 text-brand-muted mx-auto stroke-[1.5]" />
                  <p className="font-heading font-bold text-sm text-brand-navy">
                    No Academic Programs Available
                  </p>
                  <p className="font-sans text-xs text-brand-muted">
                    No academic programs are currently open for public viewing.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  {academicPrograms.map(renderProgramCard)}
                </div>
              )}
            </section>

            {/* Section 2: Upskilling Programs */}
            <section className="space-y-6">
              <div className="border-b-3 border-brand-dark pb-3 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 text-brand-navy">
                    <Zap className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                    <h2 className="font-heading font-black text-xl sm:text-2xl tracking-tight">
                      Upskilling Programs
                    </h2>
                  </div>
                  <p className="font-sans text-xs sm:text-sm text-brand-dark/75 mt-1">
                    Hands-on skill sprints focused on practical developer workflows and industry readiness.
                  </p>
                </div>
                <span className="font-mono text-xs text-brand-muted">
                  {upskillingPrograms.length} {upskillingPrograms.length === 1 ? 'Program' : 'Programs'} Available
                </span>
              </div>

              {upskillingPrograms.length === 0 ? (
                <div className="p-8 border-2 border-dashed border-brand-dark/40 bg-brand-paper text-center space-y-1">
                  <Zap className="w-8 h-8 text-brand-muted mx-auto stroke-[1.5]" />
                  <p className="font-heading font-bold text-sm text-brand-navy">
                    No Upskilling Programs Available
                  </p>
                  <p className="font-sans text-xs text-brand-muted">
                    No upskilling programs are currently open for public viewing.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                  {upskillingPrograms.map(renderProgramCard)}
                </div>
              )}
            </section>
          </div>
        )}

        {/* Bottom Contact to Enroll Assistance Banner */}
        <div className="p-6 sm:p-8 border-3 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
              Ready to enroll or have questions about cohort placement?
            </h3>
            <p className="font-sans text-xs sm:text-sm text-brand-dark/80 leading-relaxed">
              PoraPlan coordinators review your university syllabus, department schedule, and learning goals to assign you to the right cohort.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button to="/how-it-works" variant="outline" size="md">
              How It Works
            </Button>
            <Button to="/contact" variant="primary" size="md" rightIcon={<ArrowRight className="w-4 h-4" />}>
              Contact to Enroll
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
