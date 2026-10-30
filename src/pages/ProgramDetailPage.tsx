import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProgramWithFullDetails, getProgramCategoryLabel } from '../lib/programs';
import type { ProgramWithCurriculumAndCohorts } from '../types/database';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  Clock,
  Laptop,
  CheckCircle2,
  BookOpen,
  Users,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  ArrowLeft,
  Mail,
} from 'lucide-react';

export const ProgramDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();

  const [program, setProgram] = useState<ProgramWithCurriculumAndCohorts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

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
          // If draft or archived, only allow if not public or handle notice
          if (res.program.publication_status !== 'published') {
            setError('This program is currently not published for public view.');
          } else {
            setProgram(res.program);
            // Default expand first section
            if (res.program.curriculum.length > 0) {
              setExpandedSections({ [res.program.curriculum[0].id]: true });
            }
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

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  if (loading) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center p-6 academic-grid-pattern">
        <div className="p-8 border-3 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
          <h2 className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING PROGRAM DETAILS
          </h2>
          <p className="font-mono text-xs text-brand-muted">
            Retrieving curriculum roadmap and cohort dates...
          </p>
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="w-full min-h-[70vh] flex flex-col items-center justify-center p-6 academic-grid-pattern">
        <div className="p-8 border-3 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-md space-y-4">
          <AlertCircle className="w-10 h-10 text-red-600 mx-auto stroke-[2]" />
          <h2 className="font-heading font-extrabold text-lg text-brand-navy">
            Program Unavailable
          </h2>
          <p className="font-sans text-xs text-brand-dark/80">
            {error || 'The requested program could not be found or is not currently public.'}
          </p>
          <Button
            to="/programs"
            variant="primary"
            size="sm"
            leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Back to Programs Catalog
          </Button>
        </div>
      </div>
    );
  }

  const isAcademic = program.category === 'academic_mentorship';
  const isOpen = program.enrollment_status === 'open';

  return (
    <div className="w-full py-8 sm:py-12 px-4 sm:px-6 lg:px-8 academic-grid-pattern min-h-screen">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 font-mono text-xs text-brand-muted">
          <Link to="/programs" className="hover:text-brand-navy underline flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            All Programs
          </Link>
          <span>/</span>
          <span className="text-brand-dark font-bold truncate">{program.name}</span>
        </div>

        {/* Program Header Card */}
        <div className="p-6 sm:p-8 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand-dark pb-4">
            <Badge variant={isAcademic ? 'gold' : 'teal'} size="md">
              {getProgramCategoryLabel(program.category)}
            </Badge>

            {isOpen ? (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-emerald-800 px-3 py-1 border-2 border-emerald-700 bg-emerald-50 shadow-brutal-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
                Enrollment Open
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-red-800 px-3 py-1 border-2 border-red-700 bg-red-50 shadow-brutal-xs">
                Enrollment Closed
              </span>
            )}
          </div>

          <div className="space-y-3">
            <h1 className="font-heading font-black text-2xl sm:text-4xl text-brand-navy tracking-tight leading-snug">
              {program.name}
            </h1>
            <p className="font-sans text-sm sm:text-base text-brand-dark/90 leading-relaxed max-w-4xl">
              {program.short_description}
            </p>
          </div>

          {/* Quick Specifications Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            {program.duration && (
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-0.5 shadow-brutal-xs">
                <span className="font-mono text-[10px] uppercase text-brand-muted block font-bold">
                  Program Duration
                </span>
                <span className="font-sans font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-teal stroke-[2.5]" />
                  {program.duration}
                </span>
              </div>
            )}

            {program.delivery_mode && (
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-0.5 shadow-brutal-xs">
                <span className="font-mono text-[10px] uppercase text-brand-muted block font-bold">
                  Delivery Mode
                </span>
                <span className="font-sans font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                  <Laptop className="w-3.5 h-3.5 text-brand-navy stroke-[2.5]" />
                  {program.delivery_mode}
                </span>
              </div>
            )}

            <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-0.5 shadow-brutal-xs">
              <span className="font-mono text-[10px] uppercase text-brand-muted block font-bold">
                Available Cohorts
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-gold stroke-[2.5]" />
                {program.cohorts.length} Active / Planned
              </span>
            </div>
          </div>
        </div>

        {/* Full Overview & Objectives */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Description */}
            {program.description && (
              <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
                <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  Program Overview
                </h2>
                <div className="font-sans text-xs sm:text-sm text-brand-dark/85 leading-relaxed space-y-3 whitespace-pre-line">
                  {program.description}
                </div>
              </div>
            )}

            {/* Curriculum Roadmap */}
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
              <div className="border-b-2 border-brand-dark pb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                    <Layers className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                    Curriculum Structure &amp; Learning Modules
                  </h2>
                  <p className="font-sans text-xs text-brand-dark/70 mt-0.5">
                    Structured roadmap organized into systematic learning blocks.
                  </p>
                </div>
                <span className="font-mono text-xs font-bold text-brand-muted">
                  {program.curriculum.length} Phases
                </span>
              </div>

              {program.curriculum.length === 0 ? (
                <p className="text-xs font-mono text-brand-muted italic p-4 text-center">
                  Curriculum topics are being finalized for upcoming cohorts.
                </p>
              ) : (
                <div className="space-y-3 pt-2">
                  {program.curriculum.map((section, idx) => {
                    const isExpanded = Boolean(expandedSections[section.id]);
                    return (
                      <div
                        key={section.id}
                        className="border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs overflow-hidden"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          className="w-full p-4 flex items-center justify-between text-left hover:bg-brand-paper transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-none bg-brand-navy text-white font-mono font-bold text-xs flex items-center justify-center shrink-0 border border-brand-dark">
                              {idx + 1}
                            </span>
                            <div>
                              <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy">
                                {section.title}
                              </h3>
                              {section.description && (
                                <p className="font-sans text-xs text-brand-dark/70 mt-0.5">
                                  {section.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="font-mono text-[10px] text-brand-muted hidden sm:inline">
                              {section.topics.length} topics
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-brand-dark" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-brand-dark" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 pt-1 border-t border-brand-dark/20 bg-brand-paper space-y-2.5">
                            {section.topics.length === 0 ? (
                              <span className="font-mono text-xs text-brand-muted italic">
                                Topics will be assigned based on cohort syllabus requirements.
                              </span>
                            ) : (
                              <ul className="space-y-2">
                                {section.topics.map((topic, tIdx) => (
                                  <li
                                    key={topic.id}
                                    className="p-2.5 border border-brand-dark/30 bg-brand-paper-tint flex items-start gap-2.5 text-xs"
                                  >
                                    <span className="font-mono text-[10px] font-bold text-brand-teal mt-0.5 shrink-0">
                                      {idx + 1}.{tIdx + 1}
                                    </span>
                                    <div className="space-y-0.5">
                                      <p className="font-sans font-bold text-brand-navy">
                                        {topic.title}
                                      </p>
                                      {topic.description && (
                                        <p className="font-sans text-[11px] text-brand-dark/75">
                                          {topic.description}
                                        </p>
                                      )}
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Planned Cohorts */}
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
              <div className="border-b-2 border-brand-dark pb-3">
                <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                  Program Cohorts &amp; Schedules
                </h2>
                <p className="font-sans text-xs text-brand-dark/70 mt-0.5">
                  Academic batches and sprint cohorts associated with this program.
                </p>
              </div>

              {program.cohorts.length === 0 ? (
                <p className="text-xs font-mono text-brand-muted italic p-3 text-center">
                  No upcoming cohorts scheduled yet. Check back soon.
                </p>
              ) : (
                <div className="space-y-3">
                  {program.cohorts.map((cohort) => (
                    <div
                      key={cohort.id}
                      className="p-4 border-2 border-brand-dark bg-brand-paper-tint shadow-brutal-xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-brand-teal px-2 py-0.5 border border-brand-dark bg-brand-paper">
                          {cohort.code}
                        </span>
                        <Badge
                          variant={cohort.status === 'active' ? 'teal' : cohort.status === 'planned' ? 'gold' : 'paper'}
                          size="sm"
                        >
                          {cohort.status.toUpperCase()}
                        </Badge>
                      </div>

                      <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy">
                        {cohort.name}
                      </h3>

                      {cohort.description && (
                        <p className="font-sans text-xs text-brand-dark/80">
                          {cohort.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-[11px] text-brand-muted border-t border-brand-dark/15">
                        {cohort.start_date && (
                          <span>
                            Start: <strong className="text-brand-dark">{cohort.start_date}</strong>
                          </span>
                        )}
                        {cohort.end_date && (
                          <span>
                            End: <strong className="text-brand-dark">{cohort.end_date}</strong>
                          </span>
                        )}
                        {cohort.capacity && (
                          <span>
                            Capacity: <strong className="text-brand-dark">{cohort.capacity} scholars</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Prerequisites & Enrollment Notice */}
          <div className="space-y-6">
            {/* Enrollment Callout Card */}
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
              <div className="border-b-2 border-brand-dark pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  Status
                </span>
                <h3 className="font-heading font-extrabold text-base text-brand-navy">
                  Enrollment Desk
                </h3>
              </div>

              {isOpen ? (
                <div className="space-y-3">
                  <div className="p-3 border-2 border-emerald-600 bg-emerald-50 text-emerald-950 font-sans text-xs leading-relaxed space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 stroke-[2.5]" />
                      Enrollment Currently Open
                    </p>
                    <p className="text-[11px]">
                      Applications for the upcoming cohort are being reviewed. Formal online application submission will be activated in the next registration cycle.
                    </p>
                  </div>
                  <Button
                    to="/contact"
                    variant="primary"
                    size="md"
                    fullWidth
                    leftIcon={<Mail className="w-3.5 h-3.5" />}
                  >
                    Inquire With Mentors
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 border-2 border-red-600 bg-red-50 text-red-950 font-sans text-xs leading-relaxed space-y-1">
                    <p className="font-bold">Enrollment Closed</p>
                    <p className="text-[11px]">
                      This program is not accepting new scholars currently. Upcoming cohorts will be announced on the announcements desk.
                    </p>
                  </div>
                  <Button
                    to="/programs"
                    variant="outline"
                    size="md"
                    fullWidth
                  >
                    Explore Other Programs
                  </Button>
                </div>
              )}
            </div>

            {/* Target Audience & Prerequisites */}
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
              <h3 className="font-heading font-extrabold text-base text-brand-navy border-b-2 border-brand-dark pb-2">
                Eligibility &amp; Target Audience
              </h3>

              {program.target_audience && (
                <div className="space-y-1 font-sans text-xs">
                  <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
                    Who Is This For?
                  </span>
                  <p className="text-brand-dark/85 leading-relaxed">
                    {program.target_audience}
                  </p>
                </div>
              )}

              {program.prerequisites && (
                <div className="space-y-1 font-sans text-xs border-t border-brand-dark/20 pt-3">
                  <span className="font-mono text-[10px] uppercase text-brand-muted font-bold block">
                    Prerequisites &amp; Requirements
                  </span>
                  <p className="text-brand-dark/85 leading-relaxed">
                    {program.prerequisites}
                  </p>
                </div>
              )}
            </div>

            {/* Learning Objectives List */}
            {program.learning_objectives && program.learning_objectives.length > 0 && (
              <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-3">
                <h3 className="font-heading font-extrabold text-base text-brand-navy border-b-2 border-brand-dark pb-2">
                  Learning Objectives
                </h3>
                <ul className="space-y-2 font-sans text-xs text-brand-dark/85">
                  {program.learning_objectives.map((obj, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
                      <span>{obj}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
