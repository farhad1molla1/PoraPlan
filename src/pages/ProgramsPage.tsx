import React, { useState, useEffect } from 'react';
import { getPrograms, getProgramCategoryLabel, getCohorts } from '../lib/programs';
import type { Program, Cohort, ProgramCategory } from '../types/database';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  GraduationCap,
  Zap,
  Clock,
  Laptop,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  Users,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export const ProgramsPage: React.FC = () => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProgramCategory>('all');

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

  const filteredPrograms = programs.filter((p) => {
    if (selectedCategory === 'all') return true;
    return p.category === selectedCategory;
  });

  return (
    <div className="w-full py-10 sm:py-16 px-4 sm:px-6 lg:px-8 academic-grid-pattern min-h-[85vh]">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-paper border-2 border-brand-dark shadow-brutal-xs font-mono text-xs uppercase font-bold text-brand-navy">
            <GraduationCap className="w-4 h-4 text-brand-gold stroke-[2.5]" />
            Program Catalog
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-5xl text-brand-navy tracking-tight leading-tight">
            Structured Mentorship &amp; Skill Sprints
          </h1>
          <p className="font-sans text-sm sm:text-base text-brand-dark/80 leading-relaxed">
            Whether you need daily semester syllabus planning or practical developer skill sprints, 
            PoraPlan organizes what to study, when to practice, and how to stay consistent.
          </p>

          {/* Category Filter Pills */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark transition-all shadow-brutal-xs ${
                selectedCategory === 'all'
                  ? 'bg-brand-navy text-white -translate-x-0.5 -translate-y-0.5'
                  : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
              }`}
            >
              All Programs ({programs.length})
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('academic_mentorship')}
              className={`px-4 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark transition-all shadow-brutal-xs flex items-center gap-1.5 ${
                selectedCategory === 'academic_mentorship'
                  ? 'bg-brand-gold text-brand-dark -translate-x-0.5 -translate-y-0.5'
                  : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 stroke-[2.2]" />
              Academic Mentorship
            </button>
            <button
              type="button"
              onClick={() => setSelectedCategory('skillsprint')}
              className={`px-4 py-1.5 font-mono text-xs font-bold border-2 border-brand-dark transition-all shadow-brutal-xs flex items-center gap-1.5 ${
                selectedCategory === 'skillsprint'
                  ? 'bg-brand-teal text-white -translate-x-0.5 -translate-y-0.5'
                  : 'bg-brand-paper text-brand-dark hover:bg-brand-paper-tint'
              }`}
            >
              <Zap className="w-3.5 h-3.5 stroke-[2.2]" />
              SkillSprint
            </button>
          </div>
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

        {/* Programs Grid */}
        {!loading && !error && filteredPrograms.length === 0 && (
          <div className="p-12 text-center border-2 border-brand-dark bg-brand-paper shadow-brutal max-w-lg mx-auto space-y-3">
            <BookOpen className="w-10 h-10 text-brand-muted mx-auto stroke-[1.5]" />
            <h3 className="font-heading font-extrabold text-base text-brand-navy">
              No Programs Found
            </h3>
            <p className="font-sans text-xs text-brand-muted">
              No published programs match the selected filter at this time.
            </p>
          </div>
        )}

        {!loading && !error && filteredPrograms.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            {filteredPrograms.map((program) => {
              const isAcademic = program.category === 'academic_mentorship';
              const isOpen = program.enrollment_status === 'open';
              const programCohorts = cohorts.filter((c) => c.program_id === program.id && c.status !== 'archived');
              const activeCohort = programCohorts.find((c) => c.status === 'active') || programCohorts[0];

              return (
                <div
                  key={program.id}
                  className="border-3 border-brand-dark bg-brand-paper shadow-brutal flex flex-col justify-between hover:-translate-x-1 hover:-translate-y-1 transition-transform"
                >
                  <div className="p-6 sm:p-7 space-y-5">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-brand-dark pb-3">
                      <Badge variant={isAcademic ? 'gold' : 'teal'} size="sm">
                        {getProgramCategoryLabel(program.category)}
                      </Badge>

                      {isOpen ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-emerald-800 px-2 py-0.5 border border-emerald-700 bg-emerald-50 shadow-brutal-xs">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
                          Enrollment Open
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold text-red-800 px-2 py-0.5 border border-red-700 bg-red-50 shadow-brutal-xs">
                          Enrollment Closed
                        </span>
                      )}
                    </div>

                    {/* Program Title & Overview */}
                    <div className="space-y-2">
                      <h2 className="font-heading font-black text-xl sm:text-2xl text-brand-navy leading-snug">
                        {program.name}
                      </h2>
                      <p className="font-sans text-xs sm:text-sm text-brand-dark/80 leading-relaxed">
                        {program.short_description}
                      </p>
                    </div>

                    {/* Metadata Coordinates */}
                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                      {program.duration && (
                        <div className="p-2 border border-brand-dark bg-brand-paper-tint flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-brand-navy shrink-0" />
                          <span className="truncate">{program.duration}</span>
                        </div>
                      )}
                      {program.delivery_mode && (
                        <div className="p-2 border border-brand-dark bg-brand-paper-tint flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-brand-navy shrink-0" />
                          <span className="truncate">{program.delivery_mode}</span>
                        </div>
                      )}
                    </div>

                    {/* Learning Objectives Preview */}
                    {program.learning_objectives && program.learning_objectives.length > 0 && (
                      <div className="space-y-1.5 border-t border-brand-dark/20 pt-3">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-brand-muted block font-bold">
                          What You Will Achieve
                        </span>
                        <ul className="space-y-1 font-sans text-xs text-brand-dark/90">
                          {program.learning_objectives.slice(0, 3).map((obj, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
                              <span>{obj}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Cohort Notice */}
                    {activeCohort && (
                      <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] uppercase font-bold text-brand-muted flex items-center gap-1">
                            <Users className="w-3 h-3 text-brand-dark" />
                            Current Cohort
                          </span>
                          <span className="font-mono text-[10px] font-bold text-brand-teal">
                            {activeCohort.code}
                          </span>
                        </div>
                        <p className="font-sans text-xs font-bold text-brand-navy">
                          {activeCohort.name}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-4 sm:p-5 border-t-2 border-brand-dark bg-brand-paper-tint flex items-center justify-between">
                    <div className="font-mono text-[11px] text-brand-muted">
                      {programCohorts.length} {programCohorts.length === 1 ? 'Cohort' : 'Cohorts'} Planned
                    </div>

                    <Button
                      to={`/programs/${program.slug}`}
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      View Curriculum
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bottom Banner Explaining Service Workflow */}
        <div className="p-6 sm:p-8 border-3 border-brand-dark bg-brand-paper shadow-brutal flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
              Need personalized syllabus planning for your specific university course?
            </h3>
            <p className="font-sans text-xs sm:text-sm text-brand-dark/80 leading-relaxed">
              PoraPlan mentors analyze your university slides, exam patterns, and daily schedule to build custom study blocks.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              to="/how-it-works"
              variant="outline"
              size="md"
            >
              How It Works
            </Button>
            <Button
              to="/contact"
              variant="secondary"
              size="md"
            >
              Contact Mentors
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
