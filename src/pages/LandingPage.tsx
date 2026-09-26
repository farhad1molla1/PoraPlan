import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  RotateCw,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { APP_CONFIG, WORKFLOW_STEPS } from '../lib/constants';

export const LandingPage: React.FC = () => {
  // PoraPlan Core Organization Matrix items
  const organizeItems = [
    {
      label: 'What to study',
      code: 'ORG-01',
      desc: 'Granular syllabus breakdown replacing broad, overwhelming course subjects.',
    },
    {
      label: 'Where to study from',
      code: 'ORG-02',
      desc: 'Curated reference materials and specific textbook chapters to prevent resource overload.',
    },
    {
      label: 'How to study',
      code: 'ORG-03',
      desc: 'Focused study blocks that pair theoretical reading immediately with recall exercises.',
    },
    {
      label: 'When to study',
      code: 'ORG-04',
      desc: 'Structured daily queues matched to realistic deadlines, removing decision fatigue.',
    },
    {
      label: 'How to practice',
      code: 'ORG-05',
      desc: 'Targeted problem sets calibrated to the exact difficulty of target exams.',
    },
    {
      label: 'How to submit',
      code: 'ORG-06',
      desc: 'Disciplined submission records that ensure daily work is completed on time.',
    },
    {
      label: 'How to review',
      code: 'ORG-07',
      desc: 'Detailed mentor audits identifying logical gaps, conceptual errors, and inaccuracies.',
    },
    {
      label: 'How to track progress',
      code: 'ORG-08',
      desc: 'Continuous syllabus mastery metrics verified by completed submissions.',
    },
  ];

  return (
    <div className="w-full overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative border-b-2 border-brand-dark bg-brand-bg academic-grid-pattern pt-8 pb-12 sm:pt-14 sm:pb-20">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Hero Left Content */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="navy" size="sm">SYSTEM DIRECTIVE</Badge>
                <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wider text-brand-muted font-bold">
                  // {APP_CONFIG.version}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl md:text-5xl font-extrabold text-brand-navy tracking-tight leading-[1.15]">
                You study. <br />
                <span className="inline-block bg-brand-gold px-2 py-0.5 border-2 border-brand-dark shadow-brutal-xs sm:shadow-brutal-sm mt-1 text-brand-dark">
                  We organize how,
                </span>{' '}
                what and when.
              </h1>

              <p className="text-xs sm:text-base text-brand-dark/85 leading-relaxed font-sans max-w-xl">
                {APP_CONFIG.name} is a personal study assistance &amp; mentorship system.
                We eliminate timetable chaos and study isolation with a disciplined daily execution loop.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-1">
                <Button
                  to="/how-it-works"
                  variant="primary"
                  size="md"
                  rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                >
                  Explore The Process
                </Button>
                <Button
                  to="/signup"
                  variant="outline"
                  size="md"
                >
                  Enroll In Foundation Cohort
                </Button>
              </div>

              {/* Academic Highlights */}
              <div className="pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5 border-t-2 border-brand-dark/20 text-[11px] font-mono">
                <div className="flex items-center gap-2 p-2 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
                  <span className="font-bold text-brand-teal">01 //</span>
                  <span className="font-sans font-medium text-brand-dark">Syllabus Breakdown</span>
                </div>
                <div className="flex items-center gap-2 p-2 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
                  <span className="font-bold text-brand-teal">02 //</span>
                  <span className="font-sans font-medium text-brand-dark">Deliberate Practice</span>
                </div>
                <div className="flex items-center gap-2 p-2 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs">
                  <span className="font-bold text-brand-teal">03 //</span>
                  <span className="font-sans font-medium text-brand-dark">Mentor Evaluations</span>
                </div>
              </div>
            </div>

            {/* Hero Right Visual: Retro Academic Study Docket Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md">
                {/* Decorative background offset frame */}
                <div className="absolute inset-0 bg-brand-navy translate-x-2 translate-y-2 sm:translate-x-3 sm:translate-y-3 border-2 border-brand-dark"></div>

                <div className="relative bg-brand-paper border-2 border-brand-dark p-4 sm:p-5 shadow-brutal-sm sm:shadow-brutal">
                  {/* Top Header Stamp */}
                  <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 p-0.5 bg-brand-paper border border-brand-dark flex items-center justify-center shrink-0">
                        <img
                          src="/poraplan-logo.png"
                          alt="PoraPlan"
                          className="h-full w-full object-contain"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('assets')) {
                              target.src = '/assets/poraplan-logo.png';
                            }
                          }}
                        />
                      </div>
                      <span className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-brand-navy">
                        STUDY DOCKET // PP-01
                      </span>
                    </div>
                    <Badge variant="teal" size="sm">ACTIVE CYCLE</Badge>
                  </div>

                  {/* Docket Content Items */}
                  <div className="space-y-3">
                    <div className="p-2.5 sm:p-3 border-2 border-brand-dark bg-brand-paper-tint">
                      <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono text-brand-muted">
                        <span>COURSE MODULE</span>
                        <span>WEEK 04 / 16</span>
                      </div>
                      <h3 className="font-heading font-bold text-xs sm:text-sm text-brand-navy mt-1">
                        Higher Mathematics &amp; Vector Calculus
                      </h3>
                      <div className="mt-2 w-full bg-brand-bg h-2.5 border border-brand-dark overflow-hidden flex">
                        <div className="bg-brand-teal h-full w-[65%] border-r border-brand-dark"></div>
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] font-mono text-brand-dark/70">
                        <span>Target: Ch. 04 Problem Set</span>
                        <span>Milestone 04</span>
                      </div>
                    </div>

                    {/* Today's Structured Tasks */}
                    <div className="space-y-1.5">
                      <span className="font-mono text-[11px] uppercase font-bold tracking-wider text-brand-dark flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-brand-navy" />
                        Today's Scheduled Block
                      </span>

                      <div className="p-2 border-2 border-brand-dark bg-brand-gold-light flex items-start gap-2">
                        <div className="w-4 h-4 bg-brand-gold border border-brand-dark flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-0.5">
                          1
                        </div>
                        <div className="text-[11px] sm:text-xs">
                          <p className="font-bold text-brand-navy">Study Session (45m)</p>
                          <p className="text-brand-dark/80 font-sans">Linear Independence &amp; Basis Vector Proofs</p>
                        </div>
                      </div>

                      <div className="p-2 border-2 border-brand-dark bg-brand-paper flex items-start gap-2">
                        <div className="w-4 h-4 bg-brand-teal border border-brand-dark text-white flex items-center justify-center font-mono text-[9px] font-bold shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="text-[11px] sm:text-xs">
                          <p className="font-bold text-brand-navy">Practice &amp; Submit Set</p>
                          <p className="text-brand-dark/80 font-sans">Submit 5 practice derivations for Mentor Review</p>
                        </div>
                      </div>
                    </div>

                    {/* Mentor Feedback Note */}
                    <div className="p-2.5 border-2 border-brand-dark bg-brand-teal-light text-[11px] sm:text-xs">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-brand-dark mb-0.5">
                        <FileCheck className="w-3 h-3 text-brand-teal" />
                        <span>MENTOR EVALUATION NOTE</span>
                      </div>
                      <p className="text-brand-dark/90 italic font-sans">
                        "Good rigor on Problem 3. Pay closer attention to basis vector independence in Question 5."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. THE PROBLEM COMMUNICATED SIMPLY */}
      <section className="py-10 sm:py-16 border-b-2 border-brand-dark bg-brand-paper">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <SectionHeading
            badge="DIAGNOSTIC"
            eyebrow="// CORE FRICTION"
            title="Why Typical Study Schedules Break Down"
            description="Traditional timetables tell you when to sit down, but leave you guessing what to do next. Isolated studying leads to passive reading and unnoticed mistakes."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <Card
              variant="default"
              headerBar={<span>THE TYPICAL SCENARIO</span>}
              shadow="md"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 border-2 border-brand-dark bg-red-100 text-brand-dark shrink-0">
                  <AlertCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-brand-navy mb-1">
                    Unstructured Effort
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/80 leading-relaxed font-sans">
                    A blank calendar block says "Study Physics 4 PM–7 PM". Without a specific topic breakdown, primary reference material, or defined practice exercises, most of the session is lost to decision fatigue and distraction.
                  </p>
                </div>
              </div>
            </Card>

            <Card
              variant="default"
              headerBar={<span>THE PORAPLAN APPROACH</span>}
              shadow="md"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 border-2 border-brand-dark bg-brand-teal-light text-brand-teal shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold font-heading text-brand-navy mb-1">
                    Organized Execution Loop
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/80 leading-relaxed font-sans">
                    You receive an actionable docket: exactly which chapter to read, which reference questions to solve, where to submit your work, and when your mentor will review your solutions.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. WHAT PORAPLAN ORGANIZES (ACADEMIC LEDGER) */}
      <section className="py-10 sm:py-16 border-b-2 border-brand-dark bg-brand-bg academic-grid-pattern">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <SectionHeading
            badge="SYSTEM LEDGER"
            eyebrow="// STUDY ARCHITECTURE"
            title="What PoraPlan Organizes"
            description="We systematically structure eight foundational components of academic study so you can focus entirely on comprehension."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {organizeItems.map((item) => (
              <div
                key={item.code}
                className="bg-brand-paper border-2 border-brand-dark p-3.5 shadow-brutal-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b-2 border-brand-dark pb-1.5 mb-2">
                    <span className="font-mono text-[10px] text-brand-muted font-bold">
                      {item.code}
                    </span>
                    <span className="font-mono text-[9px] px-1.5 py-0.5 border border-brand-dark bg-brand-paper-tint text-brand-dark font-bold">
                      ORGANIZED
                    </span>
                  </div>
                  <h3 className="font-heading font-bold text-sm text-brand-navy mb-1">
                    {item.label}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-brand-dark/80 font-sans leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. THE PORAPLAN WORKFLOW: ACADEMIC PROCESS BOARD / STUDY DOCKET */}
      <section className="py-10 sm:py-16 md:py-20 border-b-2 border-brand-dark bg-brand-paper">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8">
          <SectionHeading
            badge="PROCESS BOARD"
            eyebrow="// CANONICAL CYCLE"
            title="The 7-Stage Study Workflow"
            description="Every subject milestone moves through this disciplined, repeatable progression from planning through verified progress."
            align="left"
          />

          {/* Academic Process Board Sheet Container */}
          <div className="border-2 border-brand-dark bg-brand-bg shadow-brutal p-4 sm:p-6 relative">
            {/* Header Stamp of Process Board */}
            <div className="border-b-2 border-brand-dark pb-3 mb-5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-brand-gold border border-brand-dark"></span>
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-navy">
                  STUDY DOCKET PROCESS BOARD // SPECIFICATION STD-07
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-brand-muted">
                <span>CADENCE: DAILY &amp; WEEKLY</span>
                <span>•</span>
                <span className="text-brand-teal font-bold flex items-center gap-1">
                  <RotateCw className="w-3 h-3" /> CYCLICAL EXECUTION
                </span>
              </div>
            </div>

            {/* Workflow Progression Sheet */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 sm:gap-2.5">
              {WORKFLOW_STEPS.map((step, idx) => (
                <div
                  key={step.code}
                  className="bg-brand-paper border-2 border-brand-dark p-3 shadow-brutal-xs flex flex-col justify-between"
                >
                  <div>
                    {/* Index Stamp */}
                    <div className="flex items-center justify-between border-b border-brand-dark/20 pb-1 mb-2">
                      <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 bg-brand-navy text-brand-bg">
                        {step.stepNumber}
                      </span>
                      <span className="font-mono text-[9px] text-brand-muted font-bold">
                        {step.code}
                      </span>
                    </div>

                    {/* Step Title */}
                    <h3 className="font-heading font-extrabold text-sm sm:text-base text-brand-navy mb-1">
                      {step.name}
                    </h3>

                    {/* Short Description */}
                    <p className="text-[11px] text-brand-dark/85 font-sans leading-relaxed">
                      {step.shortDesc}
                    </p>
                  </div>

                  {/* Flow Arrow for Desktop */}
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <div className="hidden lg:flex items-center justify-end pt-2 mt-2 border-t border-brand-dark/15 text-brand-muted">
                      <span className="text-[9px] font-mono mr-1">THEN</span>
                      <ArrowRight className="w-3 h-3 stroke-[2]" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Bottom Canonical Cycle Summary Strip */}
            <div className="mt-5 p-3 border-2 border-brand-dark bg-brand-navy text-brand-bg flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <span className="font-mono text-[10px] sm:text-xs text-brand-gold uppercase tracking-wider font-bold shrink-0">
                CANONICAL CYCLE:
              </span>
              <p className="font-mono text-[11px] sm:text-xs tracking-tight font-bold">
                Plan <span className="text-brand-gold">→</span> Study <span className="text-brand-gold">→</span> Practice <span className="text-brand-gold">→</span> Submit <span className="text-brand-gold">→</span> Review <span className="text-brand-gold">→</span> Feedback <span className="text-brand-gold">→</span> Progress
              </p>
              <Link
                to="/how-it-works"
                className="text-xs font-mono font-bold text-brand-teal hover:text-white underline underline-offset-4 shrink-0"
              >
                Detailed Walkthrough →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. GROUNDED CLOSING CTA */}
      <section className="py-10 sm:py-16 bg-brand-gold border-b-2 border-brand-dark">
        <div className="max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 text-center space-y-4 sm:space-y-5">
          <div className="inline-flex items-center gap-1.5 border-2 border-brand-dark bg-brand-paper px-2.5 py-1 text-[11px] font-mono font-bold uppercase shadow-brutal-xs">
            <span>FOUNDATION PHASE ADMISSION</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            Stop guessing what to study next.
          </h2>

          <p className="text-xs sm:text-sm md:text-base text-brand-dark max-w-xl mx-auto font-sans leading-relaxed">
            PoraPlan provides the structure, the daily milestones, and the mentorship channel to ensure consistent academic follow-through.
          </p>

          <div className="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              to="/signup"
              variant="dark"
              size="md"
              className="w-full sm:w-auto"
            >
              Enroll In Foundation Cohort
            </Button>
            <Button
              to="/about"
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
            >
              Learn More About PoraPlan
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
