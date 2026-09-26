import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Compass, ShieldCheck, Target, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';
import { APP_CONFIG } from '../lib/constants';

export const AboutPage: React.FC = () => {
  return (
    <div className="w-full pb-20">
      {/* Header Banner */}
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
            <Badge variant="navy" size="sm">ABOUT</Badge>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
            About {APP_CONFIG.name}
          </h1>
          <p className="mt-2.5 text-xs sm:text-base text-brand-dark/85 max-w-2xl font-sans">
            We believe that structured daily routines, honest evaluation, and personalized mentorship beat chaotic cramming every time.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 pt-8 sm:pt-12 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Mission & Background */}
          <div className="lg:col-span-8 space-y-8">
            <Card
              variant="paper"
              headerBar={<span>FOUNDATIONAL THESIS // REF 01</span>}
            >
              <h2 className="text-2xl font-bold font-heading text-brand-navy mb-4">
                The Study Problem
              </h2>
              <div className="space-y-4 text-sm sm:text-base text-brand-dark/85 leading-relaxed font-sans">
                <p>
                  Every semester, millions of students start with the best intentions: bold study schedules, pristine notebooks, and grand academic goals. Within three weeks, the timetable breaks down, backlogs accumulate, and panic replaces disciplined learning.
                </p>
                <p>
                  The culprit is rarely motivation. It is the absence of a reliable execution system. Traditional study tools are either rigid spreadsheets or superficial flashcards that fail to bridge long-term syllabus targets with today's immediate session.
                </p>
                <p className="p-4 border-l-4 border-brand-gold bg-brand-gold-light font-mono text-xs sm:text-sm text-brand-dark">
                  "{APP_CONFIG.tagline}" — Our core commitment to separating the cognitive burden of organizing your roadmap from the deep mental focus required to master the material.
                </p>
              </div>
            </Card>

            {/* Core Values */}
            <div>
              <SectionHeading
                badge="VALUES"
                eyebrow="// GUIDING PRINCIPLES"
                title="What Governs PoraPlan"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm">
                  <div className="w-8 h-8 bg-brand-gold border-2 border-brand-dark flex items-center justify-center mb-3">
                    <Target className="w-4 h-4 text-brand-dark stroke-[2.5]" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-brand-navy mb-1">
                    Deliberate Practice
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    Passive reading creates the illusion of competence. We prioritize active problem sets, question submissions, and genuine recall.
                  </p>
                </div>

                <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm">
                  <div className="w-8 h-8 bg-brand-teal border-2 border-brand-dark flex items-center justify-center mb-3 text-white">
                    <Compass className="w-4 h-4 text-white stroke-[2.5]" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-brand-navy mb-1">
                    Objective Direction
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    Every task connects directly to a syllabus milestone. You always know where you are and where you are headed next.
                  </p>
                </div>

                <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm">
                  <div className="w-8 h-8 bg-brand-navy border-2 border-brand-dark flex items-center justify-center mb-3 text-brand-gold">
                    <BookOpen className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-brand-navy mb-1">
                    Academic Integrity
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    Mentorship isn't about giving away answers. It's about diagnosing where thinking went astray and guiding students to the correct logic.
                  </p>
                </div>

                <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm">
                  <div className="w-8 h-8 bg-brand-paper-tint border-2 border-brand-dark flex items-center justify-center mb-3">
                    <ShieldCheck className="w-4 h-4 text-brand-dark stroke-[2.5]" />
                  </div>
                  <h3 className="font-heading font-bold text-base text-brand-navy mb-1">
                    Consistent Accountability
                  </h3>
                  <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
                    Small, verifiable daily completions build unstoppable momentum over a 16-week academic cycle.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar / Meta Dossier */}
          <div className="lg:col-span-4 space-y-6">
            <Card
              variant="navy"
              headerBar={<span className="text-brand-gold">SYSTEM SPECIFICATION</span>}
              shadow="md"
            >
              <h3 className="font-heading font-bold text-lg text-white mb-3">
                Platform Blueprint
              </h3>
              <div className="space-y-3 text-xs font-mono">
                <div className="flex justify-between border-b border-brand-bg/20 pb-2">
                  <span className="text-brand-bg/70">ARCHITECTURE:</span>
                  <span className="text-brand-gold font-bold">Mobile PWA + Web</span>
                </div>
                <div className="flex justify-between border-b border-brand-bg/20 pb-2">
                  <span className="text-brand-bg/70">MILESTONE:</span>
                  <span className="text-white font-bold">Phase 0 (Foundation)</span>
                </div>
                <div className="flex justify-between border-b border-brand-bg/20 pb-2">
                  <span className="text-brand-bg/70">DESIGN SYSTEM:</span>
                  <span className="text-white font-bold">Neo-Brutalist Academic</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-brand-bg/70">STACK:</span>
                  <span className="text-brand-teal font-bold">React + Vite + TS + Tailwind</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-brand-bg/20">
                <Button
                  to="/signup"
                  variant="primary"
                  fullWidth
                  rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                >
                  Join PoraPlan
                </Button>
              </div>
            </Card>
          </div>

        </div>
      </section>
    </div>
  );
};
