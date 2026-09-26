import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, User, Award } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { WORKFLOW_STEPS } from '../lib/constants';

export const HowItWorksPage: React.FC = () => {
  return (
    <div className="w-full pb-20">
      {/* Top Banner / Breadcrumb */}
      <section className="bg-brand-paper border-b-2 border-brand-dark py-8 sm:py-12 academic-grid-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-4">
            <Link
              to="/"
              className="inline-flex items-center gap-1 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal"
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              Back to Home
            </Link>
            <span className="text-brand-muted font-mono text-xs">/</span>
            <Badge variant="teal" size="sm">SPECIFICATION</Badge>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
            How PoraPlan Works
          </h1>
          <p className="mt-2.5 text-xs sm:text-base text-brand-dark/85 max-w-2xl font-sans">
            A step-by-step breakdown of how our 7-stage learning engine transforms long-range academic syllabi into consistent, daily mastery.
          </p>
        </div>
      </section>

      {/* Two Roles Overview: Student vs Mentor */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-6">
        <SectionHeading
          badge="DUAL ARCHITECTURE"
          eyebrow="// TWO COOPERATIVE ROLES"
          title="Designed for Student Focus &amp; Mentor Oversight"
          description="PoraPlan coordinates the workflow between the student executing daily tasks and the mentor validating academic standards."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* Student Role Card */}
          <Card
            variant="default"
            headerBar={
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-brand-teal stroke-[2.5]" />
                <span className="font-bold">THE STUDENT WORKSPACE</span>
              </div>
            }
          >
            <h3 className="text-base sm:text-lg font-bold font-heading text-brand-navy mb-1.5">
              Autonomous Daily Execution
            </h3>
            <p className="text-xs sm:text-sm text-brand-dark/80 mb-3 font-sans leading-relaxed">
              Students receive a clear daily queue of study topics and problem sets, eliminating decision fatigue and procrastination.
            </p>
            <ul className="space-y-1.5 text-[11px] sm:text-xs font-mono text-brand-dark">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0 stroke-[2.5]" />
                <span>Follow customized topic roadmaps</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0 stroke-[2.5]" />
                <span>Submit daily practice tasks and solutions</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-teal shrink-0 stroke-[2.5]" />
                <span>Implement corrections based on mentor feedback</span>
              </li>
            </ul>
          </Card>

          {/* Mentor Role Card */}
          <Card
            variant="default"
            headerBar={
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-brand-gold stroke-[2.5]" />
                <span className="font-bold">THE MENTOR DISPATCH</span>
              </div>
            }
          >
            <h3 className="text-base sm:text-lg font-bold font-heading text-brand-navy mb-1.5">
              Targeted Quality Evaluation
            </h3>
            <p className="text-xs sm:text-sm text-brand-dark/80 mb-3 font-sans leading-relaxed">
              Mentors don't just lecture; they evaluate actual practice submissions, clarify conceptual hurdles, and ensure pace alignment.
            </p>
            <ul className="space-y-1.5 text-[11px] sm:text-xs font-mono text-brand-dark">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold shrink-0 stroke-[2.5]" />
                <span>Verify assignment accuracy and approach</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold shrink-0 stroke-[2.5]" />
                <span>Deliver clear, constructive feedback</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-brand-gold shrink-0 stroke-[2.5]" />
                <span>Calibrate target milestone pacing</span>
              </li>
            </ul>
          </Card>
        </div>

        {/* Detailed 7-Step Walkthrough */}
        <div className="space-y-4 sm:space-y-6">
          <div className="border-b-2 border-brand-dark pb-3">
            <h2 className="text-xl sm:text-2xl font-bold font-heading text-brand-navy">
              Detailed Workflow Walkthrough
            </h2>
            <p className="text-[11px] sm:text-xs font-mono text-brand-muted mt-0.5">
              // CANONICAL 7-STEP PROTOCOL
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {WORKFLOW_STEPS.map((step) => (
              <div
                key={step.code}
                className="bg-brand-paper border-2 border-brand-dark p-3.5 sm:p-5 shadow-brutal-xs sm:shadow-brutal-sm flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-navy border-2 border-brand-dark text-brand-gold flex items-center justify-center font-mono font-bold text-sm sm:text-base shrink-0 shadow-brutal-xs">
                    {step.stepNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] sm:text-xs font-bold text-brand-teal uppercase">
                        [{step.code}]
                      </span>
                      <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
                        {step.name}
                      </h3>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-brand-dark/90 mt-0.5">
                      {step.shortDesc}
                    </p>
                    <p className="text-[11px] sm:text-xs text-brand-dark/75 mt-0.5 font-sans">
                      {step.detail}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 self-start md:self-center">
                  <Badge variant="paper" size="sm">
                    STAGE {step.stepNumber}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 sm:mt-14 p-5 sm:p-7 bg-brand-navy text-white border-2 border-brand-dark shadow-brutal flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <div>
            <h3 className="font-heading font-extrabold text-xl sm:text-2xl text-brand-bg">
              Ready to start your study plan?
            </h3>
            <p className="text-xs sm:text-sm text-brand-bg/85 font-sans mt-0.5">
              Join the foundation cohort and begin your structured learning cycle.
            </p>
          </div>
          <Button
            to="/signup"
            variant="primary"
            size="md"
            rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
          >
            Join Foundation Cohort
          </Button>
        </div>
      </section>
    </div>
  );
};
