import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getProgramWithFullDetails } from '../lib/programs';
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
  ArrowRight,
  GraduationCap,
  Zap,
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
          if (res.program.publication_status !== 'published') {
            setError('This program is currently not published for public view.');
          } else {
            setProgram(res.program);
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

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className="w-full py-20 px-4 flex items-center justify-center academic-grid-pattern min-h-[70vh]">
        <div className="p-10 border-3 border-brand-dark bg-brand-paper shadow-brutal text-center space-y-3 max-w-sm">
          <Loader2 className="w-8 h-8 animate-spin text-brand-teal mx-auto" />
          <p className="font-heading font-extrabold text-sm text-brand-navy">
            LOADING PROGRAM DETAILS
          </p>
          <p className="font-mono text-xs text-brand-muted">
            Fetching curriculum roadmap and scheduled cohorts...
          </p>
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="w-full py-16 px-4 academic-grid-pattern min-h-[70vh]">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4">
            <div className="flex items-center gap-3 text-red-700">
              <AlertCircle className="w-6 h-6 shrink-0 stroke-[2.5]" />
              <h2 className="font-heading font-black text-xl">Program Unavailable</h2>
            </div>
            <p className="font-sans text-sm text-brand-dark/80 leading-relaxed">
              {error || 'The requested program could not be loaded.'}
            </p>
            <div className="pt-2">
              <Button
                to="/programs"
                variant="outline"
                size="sm"
                leftIcon={<ArrowLeft className="w-4 h-4" />}
              >
                Return to Program Catalog
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isAcademic = program.category === 'academic_mentorship';
  const isOpen = program.enrollment_status === 'open';
  const activeCohorts = program.cohorts.filter((c) => c.status !== 'archived');

  return (
    <div className="w-full py-10 sm:py-14 px-4 sm:px-6 lg:px-8 academic-grid-pattern min-h-[85vh]">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          <Link
            to="/programs"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            Back to Programs
          </Link>
          <span className="text-brand-muted font-mono text-xs">/</span>
          <Badge variant={isAcademic ? 'gold' : 'teal'} size="sm">
            {isAcademic ? 'Academic Program' : 'Upskilling Program'}
          </Badge>
        </div>

        {/* Hero Card */}
        <div className="border-3 border-brand-dark bg-brand-paper shadow-brutal overflow-hidden">
          {/* Cover image or restrained placeholder */}
          {program.cover_image_url ? (
            <div className="w-full h-56 sm:h-72 border-b-2 border-brand-dark bg-brand-paper-tint overflow-hidden">
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
            <div className="w-full h-32 sm:h-40 border-b-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between px-6 sm:px-10">
              <div className="flex items-center gap-3">
                <div className="p-3 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
                  {isAcademic ? (
                    <GraduationCap className="w-6 h-6 text-brand-gold stroke-[2.5]" />
                  ) : (
                    <Zap className="w-6 h-6 text-brand-teal stroke-[2.5]" />
                  )}
                </div>
                <div>
                  <span className="font-mono text-xs font-bold text-brand-muted uppercase tracking-wider block">
                    {isAcademic ? 'Academic Mentorship Track' : 'SkillSprint Track'}
                  </span>
                  <span className="font-heading font-extrabold text-sm sm:text-base text-brand-navy">
                    {isAcademic ? 'Curriculum & Semester Coordination' : 'Hands-on Skill Development'}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand-dark pb-4">
              <Badge variant={isAcademic ? 'gold' : 'teal'} size="md">
                {isAcademic ? 'Academic Program' : 'Upskilling Program'}
              </Badge>

              {isOpen ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-emerald-800 px-3 py-1 border-2 border-emerald-700 bg-emerald-50 shadow-brutal-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
                  Enrollment Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-muted px-3 py-1 border-2 border-brand-dark/30 bg-brand-paper-tint">
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
                  Scheduled Cohorts
                </span>
                <span className="font-mono font-bold text-xs sm:text-sm text-brand-dark flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-brand-gold stroke-[2.5]" />
                  {activeCohorts.length} Active / Planned
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Overview / Detailed Description */}
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
                          className="w-full p-4 text-left flex items-center justify-between gap-3 hover:bg-brand-paper transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 h-6 border border-brand-dark bg-brand-navy text-white flex items-center justify-center font-mono text-xs font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <div>
                              <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy">
                                {section.title}
                              </h3>
                              {section.description && (
                                <p className="font-sans text-xs text-brand-dark/70 line-clamp-1 mt-0.5">
                                  {section.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-xs text-brand-muted hidden sm:inline-block">
                              {section.topics.length} {section.topics.length === 1 ? 'Topic' : 'Topics'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-brand-dark stroke-[2.5]" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-brand-dark stroke-[2.5]" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="p-4 border-t-2 border-brand-dark bg-white space-y-3">
                            {section.topics.length === 0 ? (
                              <p className="font-mono text-xs text-brand-muted italic">
                                Topics for this module will be posted before cohort start.
                              </p>
                            ) : (
                              <ul className="space-y-2.5 font-sans text-xs">
                                {section.topics.map((topic) => (
                                  <li key={topic.id} className="flex items-start gap-2.5">
                                    <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
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

            {/* Scheduled Cohorts */}
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

              {activeCohorts.length === 0 ? (
                <p className="text-xs font-mono text-brand-muted italic p-3 text-center">
                  No upcoming cohorts scheduled yet. Check back soon.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeCohorts.map((cohort) => (
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

            {/* Target Audience & Prerequisites */}
            {(program.target_audience || program.prerequisites) && (
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
            )}
          </div>

          {/* Right Column: Admissions & Contact to Enroll */}
          <div className="space-y-6">
            <div className="p-6 border-3 border-brand-dark bg-brand-paper shadow-brutal space-y-4 sticky top-20">
              <div className="border-b-2 border-brand-dark pb-3">
                <span className="font-mono text-[10px] uppercase font-bold text-brand-muted block">
                  ADMISSIONS &amp; ENROLLMENT
                </span>
                <h3 className="font-heading font-extrabold text-base text-brand-navy">
                  Contact to Enroll
                </h3>
              </div>

              <div className="space-y-3 font-sans text-xs text-brand-dark/85 leading-relaxed">
                <p>
                  Enrollment in PoraPlan programs is handled directly by our academic team. 
                  Reach out with your academic details to request cohort placement.
                </p>
                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint font-mono text-[11px] text-brand-dark space-y-1">
                  <span className="font-bold text-brand-navy block uppercase text-[10px]">What to prepare:</span>
                  <p>Your university, department, batch, and current semester details.</p>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="space-y-2.5 pt-2">
                <Button
                  to="/contact"
                  variant="primary"
                  size="md"
                  fullWidth
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Contact to Enroll
                </Button>

                <a
                  href={`mailto:poraplan.bd@gmail.com?subject=Enrollment%20Inquiry:%20${encodeURIComponent(program.name)}`}
                  className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 px-3 border-2 border-brand-dark bg-white font-mono text-xs font-bold text-brand-dark hover:bg-brand-paper-tint transition-colors shadow-brutal-xs"
                >
                  <Mail className="w-3.5 h-3.5 text-brand-teal" />
                  <span>Email poraplan.bd@gmail.com</span>
                </a>
              </div>

              <div className="pt-3 border-t border-brand-dark/20 font-sans text-[11px] text-brand-muted text-center">
                Actual enrollment and mentor assignment are completed through official PoraPlan coordination.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
