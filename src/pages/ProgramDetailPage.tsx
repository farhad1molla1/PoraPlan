import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProgramWithFullDetails } from '../lib/programs';
import type { ProgramWithCurriculumAndCohorts } from '../types/database';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

export const ProgramDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [program, setProgram] = useState<ProgramWithCurriculumAndCohorts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadProgram() {
      if (!slug) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getProgramWithFullDetails(slug);
        if (!isMounted) return;

        if (res.error || !res.program) {
          setError(res.error?.message || 'Program not found.');
        } else {
          if (res.program.publication_status !== 'published') {
            setError('This program is currently not published for public view.');
          } else {
            setProgram(res.program);
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Error loading program details');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadProgram();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="w-full py-16 px-4 bg-brand-bg min-h-[70vh] flex items-center justify-center">
        <div className="p-8 text-center bg-white border border-brand-dark/15 max-w-sm w-full space-y-3 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-brand-teal mx-auto" />
          <p className="font-heading font-bold text-xs uppercase tracking-wider text-brand-navy">
            Loading Program
          </p>
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="w-full py-16 px-4 bg-brand-bg min-h-[70vh] flex items-center justify-center">
        <div className="p-8 text-center bg-white border border-red-300 max-w-md w-full space-y-4 shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="font-heading font-extrabold text-lg text-brand-navy">Program Unavailable</h2>
          <p className="font-sans text-xs text-brand-dark/75">{error || 'The requested program could not be found.'}</p>
          <div className="pt-2">
            <Link
              to="/programs"
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-teal hover:underline uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Programs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAcademic = program.category === 'academic_mentorship';
  const activeCohorts = (program.cohorts || []).filter((c) => c.status !== 'archived');
  const activeCohort = activeCohorts.find((c) => c.status === 'active') || activeCohorts[0];

  return (
    <div className="w-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-brand-bg min-h-[85vh]">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* 1. Back to Programs */}
        <div>
          <Link
            to="/programs"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Programs
          </Link>
        </div>

        {/* Compact Offering Card */}
        <div className="border border-brand-dark/20 bg-white shadow-sm overflow-hidden">
          {/* 2. Program thumbnail (16:9 ratio) */}
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
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-brand-muted bg-brand-paper">
                <span className="font-mono text-xs uppercase font-bold tracking-wider">
                  {isAcademic ? 'Academic Program' : 'Upskilling Program'}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* 3. Program title */}
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase font-bold text-brand-teal tracking-wider block">
                {isAcademic ? 'Academic Program Offering' : 'Upskilling Program Offering'}
              </span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy leading-tight">
                {program.name}
              </h1>
            </div>

            {/* 4. Short description / overview */}
            <div className="space-y-3 text-sm text-brand-dark/85 font-sans leading-relaxed">
              <p>{program.description || program.short_description}</p>
            </div>

            {/* Program details: Duration & Delivery Mode (if present in actual record) */}
            {(program.duration || program.delivery_mode) && (
              <div className="flex flex-wrap items-center gap-4 text-xs font-sans text-brand-dark/80 pt-1">
                {program.duration && (
                  <div>
                    <span className="font-mono font-bold text-brand-navy">Duration: </span>
                    <span>{program.duration}</span>
                  </div>
                )}
                {program.delivery_mode && (
                  <div>
                    <span className="font-mono font-bold text-brand-navy">Delivery: </span>
                    <span>{program.delivery_mode}</span>
                  </div>
                )}
              </div>
            )}

            {/* Focus areas / objectives (if present in actual record) */}
            {program.learning_objectives && program.learning_objectives.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-brand-dark/10">
                <span className="font-mono text-xs uppercase font-bold text-brand-navy block">
                  Focus Areas
                </span>
                <ul className="space-y-1.5 text-xs sm:text-sm font-sans text-brand-dark/85 list-disc list-inside">
                  {program.learning_objectives.map((obj, idx) => (
                    <li key={idx}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 5. Relevant batch/cohort/course information */}
            {activeCohort && (
              <div className="p-4 border border-brand-dark/15 bg-brand-paper-tint space-y-1.5">
                <span className="font-mono text-[11px] uppercase font-bold text-brand-navy block">
                  {isAcademic ? 'Target Academic Batch / Cohort' : 'Course Session / Cohort'}
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-heading font-bold text-sm text-brand-navy">
                    {activeCohort.name}
                  </span>
                  {activeCohort.code && (
                    <span className="font-mono text-xs px-2 py-0.5 border border-brand-dark/20 bg-white font-bold text-brand-teal">
                      {activeCohort.code}
                    </span>
                  )}
                </div>
                {activeCohort.start_date && (
                  <span className="font-mono text-xs text-brand-dark/70 block">
                    Term: {activeCohort.start_date}
                    {activeCohort.end_date ? ` – ${activeCohort.end_date}` : ''}
                  </span>
                )}
              </div>
            )}

            {/* 6. One Contact to Enroll button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(`/contact?program=${encodeURIComponent(program.name)}`)}
                className="w-full sm:w-auto px-8 py-3 bg-brand-teal hover:bg-brand-teal-hover text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors text-center shadow-sm"
              >
                Contact to Enroll
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
