import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getProgramWithFullDetails } from '../lib/programs';
import type { ProgramWithCurriculumAndCohorts, Cohort } from '../types/database';
import { ArrowLeft, Loader2, AlertCircle, Calendar, ArrowRight } from 'lucide-react';

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
        setError(err instanceof Error ? err.message : 'Error loading program details.');
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
  const publishedCohorts = (program.cohorts || []).filter((c) => c.publication_status === 'published');

  const renderCohortCard = (cohort: Cohort) => {
    return (
      <div
        key={cohort.id}
        onClick={() => navigate(`/programs/${program.slug}/cohorts/${cohort.id}`)}
        className="border border-brand-dark/20 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between overflow-hidden"
      >
        {/* 1. Admin-uploaded Cohort thumbnail (independent, 16:9 ratio) */}
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
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center text-brand-muted bg-brand-paper">
              <span className="font-mono text-xs uppercase font-bold tracking-wider">
                {isAcademic ? 'Academic Cohort' : 'Course Cohort'}
              </span>
              <span className="font-heading font-extrabold text-sm text-brand-navy mt-1">
                {cohort.code}
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            {/* 2. Cohort name */}
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy leading-snug">
              {cohort.name}
            </h3>

            {/* 3. Short description */}
            {cohort.description && (
              <p className="font-sans text-xs sm:text-sm text-brand-dark/75 line-clamp-2 leading-relaxed">
                {cohort.description}
              </p>
            )}

            {/* 4. Relevant batch/course information */}
            <div className="pt-2 text-xs font-sans text-brand-dark/80 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold text-brand-navy">Code:</span>
                <span className="font-mono text-[11px] font-bold text-brand-teal px-1.5 py-0.2 bg-brand-paper border border-brand-dark/20">
                  {cohort.code}
                </span>
              </div>
              {(cohort.start_date || cohort.end_date) && (
                <div className="flex items-center gap-1 font-mono text-[11px] text-brand-muted">
                  <Calendar className="w-3.5 h-3.5 text-brand-muted shrink-0" />
                  <span>
                    {cohort.start_date || 'TBD'}
                    {cohort.end_date ? ` – ${cohort.end_date}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 5. Simple action to view the Cohort */}
          <div className="pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/programs/${program.slug}/cohorts/${cohort.id}`);
              }}
              className="w-full py-2.5 px-4 bg-brand-teal hover:bg-brand-teal-hover text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors text-center shadow-sm flex items-center justify-center gap-1.5"
            >
              <span>View Cohort</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 bg-brand-bg min-h-[85vh]">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Back Link */}
        <div>
          <Link
            to="/programs"
            className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Programs
          </Link>
        </div>

        {/* Program Header Overview Card */}
        <div className="border border-brand-dark/20 bg-white shadow-sm overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3">
            {/* Program Thumbnail */}
            <div className="md:col-span-1 aspect-video md:aspect-auto bg-brand-paper-tint overflow-hidden border-b md:border-b-0 md:border-r border-brand-dark/15">
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
                <div className="w-full h-full min-h-[160px] flex flex-col items-center justify-center p-6 text-center text-brand-muted bg-brand-paper">
                  <span className="font-mono text-xs uppercase font-bold tracking-wider">
                    {isAcademic ? 'Academic Program' : 'Upskilling Program'}
                  </span>
                </div>
              )}
            </div>

            {/* Program Info */}
            <div className="md:col-span-2 p-6 sm:p-8 space-y-3 flex flex-col justify-center">
              <span className="font-mono text-[11px] uppercase font-bold text-brand-teal tracking-wider block">
                {isAcademic ? 'Academic Program' : 'Upskilling Program'}
              </span>
              <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-brand-navy leading-tight">
                {program.name}
              </h1>
              <p className="font-sans text-xs sm:text-sm text-brand-dark/80 leading-relaxed">
                {program.short_description || program.description}
              </p>
            </div>
          </div>
        </div>

        {/* Cohort Listing Section */}
        <div className="space-y-4">
          <div className="border-b border-brand-dark/15 pb-2">
            <h2 className="font-heading font-bold text-lg sm:text-xl text-brand-navy">
              {isAcademic ? 'Available Academic Cohorts' : 'Available Course Cohorts'}
            </h2>
            <p className="font-sans text-xs text-brand-dark/70 mt-0.5">
              Select a cohort or batch to review details and enrollment contact information.
            </p>
          </div>

          {publishedCohorts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {publishedCohorts.map(renderCohortCard)}
            </div>
          ) : (
            <div className="p-8 text-center bg-white border border-brand-dark/15 max-w-md mx-auto space-y-2 shadow-sm">
              <h3 className="font-heading font-bold text-sm text-brand-navy">
                No Cohorts Currently Available
              </h3>
              <p className="font-sans text-xs text-brand-dark/70">
                New cohorts for this program will be announced soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
