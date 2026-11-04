import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPrograms, getCohorts } from '../lib/programs';
import type { Program, Cohort } from '../types/database';
import { AlertCircle, Loader2 } from 'lucide-react';

export const ProgramsPage: React.FC = () => {
  const navigate = useNavigate();
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
    const programCohorts = cohorts.filter(
      (c) => c.program_id === program.id && c.status !== 'archived'
    );
    const activeCohort =
      programCohorts.find((c) => c.status === 'active') || programCohorts[0];

    return (
      <div
        key={program.id}
        onClick={() => navigate(`/programs/${program.slug}`)}
        className="border border-brand-dark/20 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        {/* 1. Admin-uploaded thumbnail (16:9 ratio, object-cover) */}
        <div className="w-full aspect-video bg-brand-paper-tint overflow-hidden border-b border-brand-dark/15">
          {program.cover_image_url ? (
            <img
              src={program.cover_image_url}
              alt={program.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-brand-muted bg-brand-paper">
              <span className="font-mono text-xs uppercase font-bold tracking-wider">
                {isAcademic ? 'Academic Program' : 'Upskilling Program'}
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            {/* 2. Program/offering title */}
            <h3 className="font-heading font-extrabold text-lg text-brand-navy leading-snug">
              {program.name}
            </h3>

            {/* 3. Short description, ideally one or two lines */}
            <p className="font-sans text-xs sm:text-sm text-brand-dark/75 line-clamp-2 leading-relaxed">
              {program.short_description}
            </p>

            {/* 4. Relevant batch/cohort/course information */}
            {activeCohort && (
              <div className="pt-2 text-xs font-sans text-brand-dark/80 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-brand-navy">
                  {isAcademic ? 'Batch / Cohort:' : 'Course Session:'}
                </span>
                <span className="font-medium text-brand-dark">
                  {activeCohort.name}
                </span>
                {activeCohort.code && (
                  <span className="font-mono text-[10px] px-1.5 py-0.5 border border-brand-dark/20 bg-brand-paper font-semibold text-brand-teal">
                    {activeCohort.code}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 5. One clear CTA: Contact to Enroll */}
          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/contact?program=${encodeURIComponent(program.name)}`);
              }}
              className="w-full py-2.5 px-4 bg-brand-teal hover:bg-brand-teal-hover text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors text-center shadow-sm"
            >
              Contact to Enroll
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-brand-bg min-h-[85vh]">
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Simple Page Header */}
        <div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy tracking-tight">
            Programs
          </h1>
          <p className="font-sans text-xs sm:text-sm text-brand-dark/75 mt-1">
            Academic study assistance and skill development offerings.
          </p>
        </div>

        {/* Loading & Error States */}
        {loading && (
          <div className="p-12 text-center bg-white border border-brand-dark/15 max-w-sm mx-auto space-y-3 shadow-sm">
            <Loader2 className="w-6 h-6 animate-spin text-brand-teal mx-auto" />
            <p className="font-heading font-bold text-xs uppercase tracking-wider text-brand-navy">
              Loading Programs
            </p>
          </div>
        )}

        {error && (
          <div className="p-4 border border-red-300 bg-red-50 text-red-950 flex items-center gap-3 max-w-xl mx-auto text-xs">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-10">
            {/* Section 1: Academic Programs (Hidden if no published offerings) */}
            {academicPrograms.length > 0 && (
              <section className="space-y-4">
                <h2 className="font-heading font-bold text-lg sm:text-xl text-brand-navy border-b border-brand-dark/15 pb-2">
                  Academic Programs
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {academicPrograms.map(renderProgramCard)}
                </div>
              </section>
            )}

            {/* Section 2: Upskilling Programs (Hidden if no published offerings) */}
            {upskillingPrograms.length > 0 && (
              <section className="space-y-4">
                <h2 className="font-heading font-bold text-lg sm:text-xl text-brand-navy border-b border-brand-dark/15 pb-2">
                  Upskilling Programs
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {upskillingPrograms.map(renderProgramCard)}
                </div>
              </section>
            )}

            {/* Empty State when no offerings exist in either category */}
            {academicPrograms.length === 0 && upskillingPrograms.length === 0 && (
              <div className="p-10 text-center bg-white border border-brand-dark/15 max-w-md mx-auto space-y-2 shadow-sm">
                <h3 className="font-heading font-bold text-sm text-brand-navy">
                  No Programs Available
                </h3>
                <p className="font-sans text-xs text-brand-dark/70">
                  There are currently no published programs available for public enrollment.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
