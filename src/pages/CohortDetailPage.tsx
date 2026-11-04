import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getCohortById, getPrograms } from '../lib/programs';
import type { Program, Cohort } from '../types/database';
import { ArrowLeft, Loader2, AlertCircle, Calendar } from 'lucide-react';

export const CohortDetailPage: React.FC = () => {
  const { programSlug, cohortId } = useParams<{ programSlug?: string; cohortId: string }>();
  const navigate = useNavigate();

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!cohortId) return;
      setLoading(true);
      setError(null);
      try {
        const [cohortRes, progRes] = await Promise.all([
          getCohortById(cohortId),
          getPrograms({ includeUnpublished: false }),
        ]);

        if (!isMounted) return;

        if (cohortRes.error || !cohortRes.cohort) {
          setError(cohortRes.error?.message || 'Cohort not found.');
        } else {
          // Verify cohort is published
          if (cohortRes.cohort.status === 'archived') {
            setError('This cohort is not currently available for public view.');
            return;
          }

          setCohort(cohortRes.cohort);

          // Find associated program
          const foundProg =
            progRes.programs.find(
              (p) =>
                p.id === cohortRes.cohort?.program_id ||
                (programSlug && p.slug === programSlug)
            ) || null;

          setProgram(foundProg);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Error loading cohort details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [cohortId, programSlug]);

  if (loading) {
    return (
      <div className="w-full py-16 px-4 bg-brand-bg min-h-[70vh] flex items-center justify-center">
        <div className="p-8 text-center bg-white border border-brand-dark/15 max-w-sm w-full space-y-3 shadow-sm">
          <Loader2 className="w-6 h-6 animate-spin text-brand-teal mx-auto" />
          <p className="font-heading font-bold text-xs uppercase tracking-wider text-brand-navy">
            Loading Cohort
          </p>
        </div>
      </div>
    );
  }

  if (error || !cohort) {
    return (
      <div className="w-full py-16 px-4 bg-brand-bg min-h-[70vh] flex items-center justify-center">
        <div className="p-8 text-center bg-white border border-red-300 max-w-md w-full space-y-4 shadow-sm">
          <AlertCircle className="w-8 h-8 text-red-600 mx-auto" />
          <h2 className="font-heading font-extrabold text-lg text-brand-navy">Cohort Unavailable</h2>
          <p className="font-sans text-xs text-brand-dark/75">{error || 'The requested cohort could not be found.'}</p>
          <div className="pt-2">
            <Link
              to={program ? `/programs/${program.slug}` : '/programs'}
              className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-teal hover:underline uppercase"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to {program ? program.name : 'Programs'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isAcademic = program ? program.category === 'academic_mentorship' : cohort.code.includes('CSE');
  const backDestination = program ? `/programs/${program.slug}` : '/programs';

  const contactDestination = program
    ? `/contact?program=${encodeURIComponent(program.name)}&cohort=${encodeURIComponent(cohort.name)}`
    : `/contact?cohort=${encodeURIComponent(cohort.name)}`;

  return (
    <div className="w-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-brand-bg min-h-[85vh]">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back Link */}
        <div>
          <Link
            to={backDestination}
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {program ? program.name : 'Programs'}
          </Link>
        </div>

        {/* Compact Cohort Details Card */}
        <div className="border border-brand-dark/20 bg-white shadow-sm overflow-hidden">
          {/* 1. Independent Cohort Thumbnail (16:9 ratio) */}
          <div className="w-full aspect-video bg-brand-paper-tint overflow-hidden border-b border-brand-dark/15">
            {cohort.cover_image_url ? (
              <img
                src={cohort.cover_image_url}
                alt={cohort.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-brand-muted bg-brand-paper">
                <span className="font-mono text-xs uppercase font-bold tracking-wider">
                  {isAcademic ? 'Academic Cohort' : 'Course Cohort'}
                </span>
                <span className="font-heading font-extrabold text-sm text-brand-navy mt-1">
                  {cohort.code}
                </span>
              </div>
            )}
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Parent & Cohort Header */}
            <div className="space-y-1">
              {program && (
                <span className="font-mono text-[11px] uppercase font-bold text-brand-teal tracking-wider block">
                  {program.name}
                </span>
              )}
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy leading-tight">
                {cohort.name}
              </h1>
            </div>

            {/* 2. Short description */}
            {cohort.description && (
              <p className="font-sans text-xs sm:text-sm text-brand-dark/80 leading-relaxed">
                {cohort.description}
              </p>
            )}

            {/* 3. Relevant academic batch / course information */}
            <div className="p-4 border border-brand-dark/15 bg-brand-paper-tint space-y-2">
              <span className="font-mono text-[11px] uppercase font-bold text-brand-navy block">
                {isAcademic ? 'Academic Intake Details' : 'Course Run Details'}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-sans text-brand-dark">
                <div>
                  <span className="font-mono font-bold text-brand-navy block">Cohort Code:</span>
                  <span className="font-mono font-bold text-brand-teal text-sm">{cohort.code}</span>
                </div>
                {(cohort.start_date || cohort.end_date) && (
                  <div>
                    <span className="font-mono font-bold text-brand-navy block">Schedule / Term:</span>
                    <span className="flex items-center gap-1 text-brand-dark/80 pt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                      {cohort.start_date || 'TBD'}
                      {cohort.end_date ? ` – ${cohort.end_date}` : ''}
                    </span>
                  </div>
                )}
                {cohort.capacity && (
                  <div>
                    <span className="font-mono font-bold text-brand-navy block">Cohort Capacity:</span>
                    <span>{cohort.capacity} Students</span>
                  </div>
                )}
                {program?.delivery_mode && (
                  <div>
                    <span className="font-mono font-bold text-brand-navy block">Delivery:</span>
                    <span>{program.delivery_mode}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 4. One clear CTA: Contact to Enroll */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate(contactDestination)}
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

