import React from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  BookOpen,
  PenTool,
  Send,
  ClipboardCheck,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  FileText,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { APP_CONFIG, WORKFLOW_STEPS } from '../lib/constants';

export const LandingPage: React.FC = () => {
  const getWorkflowIcon = (name: string) => {
    switch (name) {
      case 'calendar':
        return <Calendar className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      case 'book-open':
        return <BookOpen className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      case 'pen-tool':
        return <PenTool className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      case 'send':
        return <Send className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      case 'clipboard-check':
        return <ClipboardCheck className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      case 'message-square':
        return <MessageSquare className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      case 'trending-up':
        return <TrendingUp className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
      default:
        return <BookOpen className="w-5 h-5 text-brand-dark stroke-[2.5]" />;
    }
  };

  return (
    <div className="w-full overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative border-b-2 border-brand-dark bg-brand-bg academic-grid-pattern pt-12 pb-16 sm:pt-16 sm:pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Hero Left Content */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="navy">PLATFORM DIRECTIVE</Badge>
                <span className="font-mono text-xs uppercase tracking-wider text-brand-muted font-bold">
                  // {APP_CONFIG.version}
                </span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-brand-navy tracking-tight leading-[1.1]">
                You study. <br />
                <span className="inline-block bg-brand-gold px-2 py-0.5 border-2 border-brand-dark shadow-brutal-sm mt-1 text-brand-dark">
                  We organize how,
                </span>{' '}
                what and when.
              </h1>

              <p className="text-base sm:text-xl text-brand-dark/90 leading-relaxed font-sans max-w-xl">
                {APP_CONFIG.name} is a structured personal study assistance and mentorship platform.
                Replace chaotic timetables with an accountable study execution loop.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Button
                  to="/how-it-works"
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-5 h-5 stroke-[2.5]" />}
                >
                  Explore The Workflow
                </Button>
                <Button
                  to="/signup"
                  variant="outline"
                  size="lg"
                >
                  Join PoraPlan
                </Button>
              </div>

              {/* Academic Highlights */}
              <div className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t-2 border-brand-dark/20 text-xs font-mono">
                <div className="flex items-center gap-2 p-2 border border-brand-dark/20 bg-brand-paper shadow-brutal-xs">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 stroke-[2.5]" />
                  <span>Syllabus Breakdown</span>
                </div>
                <div className="flex items-center gap-2 p-2 border border-brand-dark/20 bg-brand-paper shadow-brutal-xs">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 stroke-[2.5]" />
                  <span>Mentor Reviews</span>
                </div>
                <div className="flex items-center gap-2 p-2 border border-brand-dark/20 bg-brand-paper shadow-brutal-xs">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal shrink-0 stroke-[2.5]" />
                  <span>Verified Milestones</span>
                </div>
              </div>
            </div>

            {/* Hero Right Visual: Retro Academic Study Docket Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md">
                {/* Decorative background offset frame */}
                <div className="absolute inset-0 bg-brand-navy translate-x-3 translate-y-3 border-2 border-brand-dark"></div>

                <div className="relative bg-brand-paper border-2 border-brand-dark p-5 sm:p-6 shadow-brutal">
                  {/* Top Header Stamp */}
                  <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3 mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-brand-gold border border-brand-dark"></div>
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-navy">
                        STUDY DOCKET #01
                      </span>
                    </div>
                    <Badge variant="teal" size="sm">ACTIVE CYCLE</Badge>
                  </div>

                  {/* Docket Content Items */}
                  <div className="space-y-4">
                    <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint">
                      <div className="flex items-center justify-between text-xs font-mono text-brand-muted">
                        <span>COURSE ROADMAP</span>
                        <span>WEEK 04 / 16</span>
                      </div>
                      <h3 className="font-heading font-bold text-base text-brand-navy mt-1">
                        Engineering Mathematics &amp; Discrete Analysis
                      </h3>
                      <div className="mt-2 w-full bg-brand-bg h-3 border border-brand-dark overflow-hidden flex">
                        <div className="bg-brand-teal h-full w-[65%] border-r border-brand-dark"></div>
                      </div>
                      <div className="mt-1 flex justify-between text-[11px] font-mono text-brand-dark/70">
                        <span>Progress: 65%</span>
                        <span>Target: Ch. 07 Review</span>
                      </div>
                    </div>

                    {/* Today's Structured Tasks */}
                    <div className="space-y-2">
                      <span className="font-mono text-xs uppercase font-bold tracking-wider text-brand-dark flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-brand-navy" />
                        Today's Study Plan
                      </span>

                      <div className="p-2.5 border-2 border-brand-dark bg-brand-gold-light flex items-start gap-2.5">
                        <div className="w-5 h-5 bg-brand-gold border border-brand-dark flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                          1
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-brand-navy">Study Session (60m)</p>
                          <p className="text-brand-dark/80 font-sans">Linear Transformation proofs &amp; kernel dimensions</p>
                        </div>
                      </div>

                      <div className="p-2.5 border-2 border-brand-dark bg-brand-paper flex items-start gap-2.5">
                        <div className="w-5 h-5 bg-brand-teal border border-brand-dark text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-brand-navy">Practice &amp; Submit Problem Set</p>
                          <p className="text-brand-dark/80 font-sans">Exercise 4.2: Submit 5 questions for Mentor Review</p>
                        </div>
                      </div>
                    </div>

                    {/* Mentor Feedback Note */}
                    <div className="p-3 border-2 border-brand-dark bg-brand-teal-light text-xs">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-brand-dark mb-1">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
                        <span>MENTOR FEEDBACK NOTE</span>
                      </div>
                      <p className="text-brand-dark/90 italic font-sans text-xs">
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

      {/* 2. SHORT EXPLANATION OF PORAPLAN */}
      <section className="py-16 sm:py-20 border-b-2 border-brand-dark bg-brand-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="PLATFORM PRINCIPLE"
            eyebrow="// WHY PORAPLAN"
            title="Studying is hard. Organizing the journey shouldn't be."
            description="Most students fail not from lack of ambition, but from fragmented schedules, ambiguous targets, and studying in isolation without feedback."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1: The Problem */}
            <Card
              variant="default"
              headerBar={<span>DIAGNOSTIC // 01</span>}
              shadow="md"
            >
              <div className="w-10 h-10 bg-brand-gold-light border-2 border-brand-dark flex items-center justify-center mb-4 shadow-brutal-xs">
                <FileText className="w-5 h-5 text-brand-dark" />
              </div>
              <h3 className="text-xl font-bold font-heading text-brand-navy mb-2">
                Unclear Daily Milestones
              </h3>
              <p className="text-sm text-brand-dark/80 leading-relaxed font-sans">
                Students often know their exams or target deadlines, but struggle to know exactly what to study on a Tuesday morning at 10 AM. PoraPlan translates broad syllabi into daily actionable targets.
              </p>
            </Card>

            {/* Column 2: The Structure */}
            <Card
              variant="default"
              headerBar={<span>SOLUTION // 02</span>}
              shadow="md"
            >
              <div className="w-10 h-10 bg-brand-teal-light border-2 border-brand-dark flex items-center justify-center mb-4 shadow-brutal-xs">
                <Compass className="w-5 h-5 text-brand-dark" />
              </div>
              <h3 className="text-xl font-bold font-heading text-brand-navy mb-2">
                Disciplined Execution Loops
              </h3>
              <p className="text-sm text-brand-dark/80 leading-relaxed font-sans">
                Learning requires more than passive reading. PoraPlan enforces a cyclical rhythm: Plan, Study, Practice, and Submit, keeping daily work accountable and intentional.
              </p>
            </Card>

            {/* Column 3: The Mentorship */}
            <Card
              variant="default"
              headerBar={<span>ACCOUNTABILITY // 03</span>}
              shadow="md"
            >
              <div className="w-10 h-10 bg-brand-navy-light border-2 border-brand-dark flex items-center justify-center mb-4 shadow-brutal-xs">
                <ClipboardCheck className="w-5 h-5 text-brand-dark" />
              </div>
              <h3 className="text-xl font-bold font-heading text-brand-navy mb-2">
                Mentorship &amp; Feedback
              </h3>
              <p className="text-sm text-brand-dark/80 leading-relaxed font-sans">
                Submissions don't disappear into a void. Mentors review submitted practice sets, identify fundamental errors, and return targeted feedback before bad study habits compound.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. CORE WORKFLOW: Plan → Study → Practice → Submit → Review → Feedback → Progress */}
      <section className="py-16 sm:py-24 border-b-2 border-brand-dark bg-brand-bg academic-grid-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="THE PORAPLAN ENGINE"
            eyebrow="// 7-STEP PROGRESSION"
            title="The Core Learning Workflow"
            description="From initial roadmap planning to verified subject mastery, every study cycle advances through seven rigorous steps."
            align="left"
          />

          {/* Workflow Sequence Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div
                key={step.code}
                className="group relative flex flex-col bg-brand-paper border-2 border-brand-dark p-4 shadow-brutal transition-all duration-150 hover:-translate-y-1 hover:shadow-brutal-lg"
              >
                {/* Step Index Badge & Code */}
                <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2 mb-3">
                  <span className="font-mono text-xs font-black px-1.5 py-0.5 bg-brand-gold border border-brand-dark text-brand-dark">
                    {step.stepNumber}
                  </span>
                  <span className="font-mono text-[10px] text-brand-muted font-bold">
                    {step.code}
                  </span>
                </div>

                {/* Step Icon */}
                <div className="w-9 h-9 border-2 border-brand-dark bg-brand-bg flex items-center justify-center mb-3 shadow-brutal-xs group-hover:bg-brand-teal group-hover:text-white transition-colors">
                  {getWorkflowIcon(step.iconName)}
                </div>

                {/* Step Name */}
                <h3 className="font-heading font-extrabold text-lg text-brand-navy mb-1.5">
                  {step.name}
                </h3>

                {/* Step Description */}
                <p className="text-xs text-brand-dark/85 font-sans leading-relaxed flex-1">
                  {step.shortDesc}
                </p>

                {/* Bottom Sequence Arrow for Desktop */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="hidden lg:flex items-center justify-end pt-3 mt-3 border-t border-brand-dark/20 text-brand-navy">
                    <span className="text-[10px] font-mono text-brand-muted uppercase mr-1">Next</span>
                    <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Linear Workflow Summary Ribbon */}
          <div className="mt-8 p-4 border-2 border-brand-dark bg-brand-navy text-brand-bg shadow-brutal-sm">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="font-mono text-xs text-brand-gold uppercase tracking-wider font-bold">
                CANONICAL CYCLE:
              </span>
              <p className="font-mono text-xs sm:text-sm text-center tracking-wide font-bold">
                Plan <span className="text-brand-gold">→</span> Study <span className="text-brand-gold">→</span> Practice <span className="text-brand-gold">→</span> Submit <span className="text-brand-gold">→</span> Review <span className="text-brand-gold">→</span> Feedback <span className="text-brand-gold">→</span> Progress
              </p>
              <Link
                to="/how-it-works"
                className="text-xs font-mono font-bold text-brand-teal hover:text-white underline underline-offset-4"
              >
                Read Specification →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 4. SIMPLE CLOSING CTA */}
      <section className="py-16 sm:py-20 bg-brand-gold border-b-2 border-brand-dark">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-2 border-2 border-brand-dark bg-brand-paper px-3 py-1 text-xs font-mono font-bold uppercase shadow-brutal-xs">
            <span>READY TO ORGANIZE YOUR STUDIES?</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-navy tracking-tight">
            Stop guessing what to study next.
          </h2>

          <p className="text-base sm:text-lg text-brand-dark max-w-2xl mx-auto font-sans">
            PoraPlan provides the structure, the milestones, and the mentorship channel to ensure consistent academic follow-through.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              to="/signup"
              variant="dark"
              size="lg"
              className="w-full sm:w-auto"
            >
              Get Started Now
            </Button>
            <Button
              to="/about"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              Learn More About Us
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
