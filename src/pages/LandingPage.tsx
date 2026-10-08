import React from 'react';
import {
  ArrowRight,
  Clock,
  CheckCircle2,
  Calendar,
  BookOpen,
  Send,
  MessageSquare,
  HelpCircle,
  TrendingUp,
  Mail,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { SectionHeading } from '../components/common/SectionHeading';

export const LandingPage: React.FC = () => {
  // Simple, student-friendly feature cards
  const studentBenefits = [
    {
      title: 'A clear plan',
      highlight: 'Know what to study and when.',
      desc: 'Break your syllabus into manageable daily targets so you never have to guess what comes next.',
      icon: <Calendar className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badgeColor: 'gold' as const,
    },
    {
      title: 'Useful resources',
      highlight: 'Get the right materials without searching everywhere.',
      desc: 'Access curated notes and targeted textbook problems linked directly to each day’s topic.',
      icon: <BookOpen className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badgeColor: 'teal' as const,
    },
    {
      title: 'Practice & submit',
      highlight: 'Work on tasks and turn them in.',
      desc: 'Test your understanding by solving problem sets and submitting your work on schedule.',
      icon: <Send className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badgeColor: 'navy' as const,
    },
    {
      title: 'Helpful feedback',
      highlight: 'Know what you did well and what needs work.',
      desc: 'Get personal corrections and guidance from your mentor on every assignment you submit.',
      icon: <MessageSquare className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badgeColor: 'teal' as const,
    },
    {
      title: "Ask when you're stuck",
      highlight: 'Send questions and get help.',
      desc: 'Never stay blocked on a concept. Ask your mentor questions and get clear explanations.',
      icon: <HelpCircle className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badgeColor: 'gold' as const,
    },
    {
      title: 'See your progress',
      highlight: "Know what's done, what's pending, and what's next.",
      desc: 'Track completed chapters across your syllabus so you feel prepared and confident before exams.',
      icon: <TrendingUp className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badgeColor: 'navy' as const,
    },
  ];

  // 5-step visual study routine
  const routineSteps = [
    {
      step: '01',
      name: 'Plan',
      desc: 'Check your daily topics and targets.',
    },
    {
      step: '02',
      name: 'Study',
      desc: 'Read the notes with clear focus.',
    },
    {
      step: '03',
      name: 'Submit',
      desc: 'Solve exercises and turn them in.',
    },
    {
      step: '04',
      name: 'Feedback',
      desc: 'Get mentor advice on errors.',
    },
    {
      step: '05',
      name: 'Progress',
      desc: 'Master the chapter and move on.',
    },
  ];

  return (
    <div className="w-full overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative border-b-2 border-brand-dark bg-brand-bg academic-grid-pattern pt-8 pb-12 sm:pt-16 sm:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Hero Left Content */}
            <div className="lg:col-span-7 space-y-4 sm:space-y-6">
              <div className="inline-flex items-center gap-2 border-2 border-brand-dark bg-brand-paper px-2.5 py-1 text-xs font-mono font-bold uppercase shadow-brutal-xs">
                <span className="w-2 h-2 rounded-full bg-brand-teal"></span>
                <span>PERSONAL STUDY ASSISTANCE</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-brand-navy tracking-tight leading-[1.12]">
                You study. <br />
                <span className="inline-block bg-brand-gold px-2.5 sm:px-3 py-0.5 border-2 border-brand-dark shadow-brutal-sm mt-1.5 text-brand-dark">
                  We organize how,
                </span>{' '}
                what and when.
              </h1>

              <p className="text-base sm:text-lg md:text-xl text-brand-dark/85 leading-relaxed font-sans max-w-xl">
                A simple study system for students who want to know what to study, what to do next, and how they're progressing.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <Button
                  to="/login"
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
                >
                  Log In to Workspace
                </Button>
                <Button
                  to="/how-it-works"
                  variant="outline"
                  size="lg"
                >
                  How It Works
                </Button>
              </div>

              {/* 3 Quick Value Points */}
              <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm font-mono text-brand-dark/80">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                  Clear daily plan
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                  Practice tasks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                  Mentor feedback
                </span>
              </div>
            </div>

            {/* Hero Right Visual: Authentic Study Docket Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md">
                {/* Decorative background frame */}
                <div className="absolute inset-0 bg-brand-navy translate-x-2.5 translate-y-2.5 sm:translate-x-3.5 sm:translate-y-3.5 border-2 border-brand-dark"></div>

                <div className="relative bg-brand-paper border-2 border-brand-dark p-4 sm:p-6 shadow-brutal">
                  {/* Top Header */}
                  <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3 mb-4">
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
                      <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-navy">
                        TODAY'S STUDY DOCKET
                      </span>
                    </div>
                    <Badge variant="teal" size="sm">ACTIVE</Badge>
                  </div>

                  {/* Docket Items */}
                  <div className="space-y-3.5">
                    {/* Subject Pill */}
                    <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint">
                      <span className="text-[10px] font-mono text-brand-muted uppercase font-bold tracking-wider">
                        CURRENT SUBJECT
                      </span>
                      <h3 className="font-heading font-bold text-sm sm:text-base text-brand-navy mt-0.5">
                        Physics • Vector Mechanics
                      </h3>
                      <p className="text-xs text-brand-dark/75 mt-1 font-sans">
                        Chapter 4 • Milestone 2 of 6 completed
                      </p>
                    </div>

                    {/* Today's Tasks */}
                    <div className="space-y-2">
                      <span className="font-mono text-xs uppercase font-bold tracking-wider text-brand-dark flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-brand-navy" />
                        Today's Tasks
                      </span>

                      <div className="p-2.5 border-2 border-brand-dark bg-brand-gold-light flex items-start gap-2.5">
                        <div className="w-5 h-5 bg-brand-gold border border-brand-dark flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                          1
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-brand-navy">Read Topic Summary (30m)</p>
                          <p className="text-brand-dark/80 font-sans">Core laws &amp; formula derivation</p>
                        </div>
                      </div>

                      <div className="p-2.5 border-2 border-brand-dark bg-brand-paper flex items-start gap-2.5">
                        <div className="w-5 h-5 bg-brand-teal border border-brand-dark text-white flex items-center justify-center font-mono text-[10px] font-bold shrink-0 mt-0.5">
                          2
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-brand-navy">Solve &amp; Submit 4 Problems</p>
                          <p className="text-brand-dark/80 font-sans">Submit work for mentor check</p>
                        </div>
                      </div>
                    </div>

                    {/* Mentor Feedback Note */}
                    <div className="p-2.5 border-2 border-brand-dark bg-brand-teal-light text-xs">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-brand-dark mb-0.5">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-teal" />
                        <span>MENTOR FEEDBACK</span>
                      </div>
                      <p className="text-brand-dark/90 italic font-sans text-xs">
                        "Great work on Problem 2. Review the formula in Question 4 before moving on."
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. WHAT YOU GET (CLEAN & STUDENT-FRIENDLY) */}
      <section className="py-12 sm:py-16 md:py-20 border-b-2 border-brand-dark bg-brand-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="WHAT YOU GET"
            eyebrow="// SIMPLE STUDY SUPPORT"
            title="Everything you need to study with confidence"
            description="No complicated setups or confusing timetables. Just a clear daily plan that helps you get your work done."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {studentBenefits.map((benefit) => (
              <Card
                key={benefit.title}
                variant="default"
                shadow="sm"
                className="flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center mb-3 shadow-brutal-xs">
                    {benefit.icon}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold font-heading text-brand-navy mb-1">
                    {benefit.title}
                  </h3>
                  <p className="text-sm font-semibold text-brand-teal mb-2 font-sans">
                    {benefit.highlight}
                  </p>
                  <p className="text-sm text-brand-dark/80 leading-relaxed font-sans">
                    {benefit.desc}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* 3. THE 5-STEP STUDY ROUTINE (VISUAL PROCESS BOARD) */}
      <section className="py-12 sm:py-16 md:py-20 border-b-2 border-brand-dark bg-brand-bg academic-grid-pattern">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="THE ROUTINE"
            eyebrow="// HOW IT WORKS"
            title="How your study week works"
            description="A steady five-step rhythm that repeats for every chapter:"
            align="left"
          />

          {/* Process board */}
          <div className="border-2 border-brand-dark bg-brand-paper p-4 sm:p-6 shadow-brutal">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
              {routineSteps.map((item, idx) => (
                <div
                  key={item.step}
                  className="bg-brand-paper-tint border-2 border-brand-dark p-3.5 sm:p-4 shadow-brutal-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between border-b border-brand-dark/20 pb-1.5 mb-2">
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 bg-brand-navy text-brand-bg">
                        STEP {item.step}
                      </span>
                      {idx < routineSteps.length - 1 && (
                        <span className="hidden lg:inline font-mono text-[10px] text-brand-muted">
                          THEN →
                        </span>
                      )}
                    </div>
                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy mb-1">
                      {item.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-brand-dark/80 font-sans leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom summary strip */}
            <div className="mt-5 p-3 sm:p-4 border-2 border-brand-dark bg-brand-navy text-brand-bg flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <p className="font-mono text-xs sm:text-sm font-bold text-brand-bg">
                <span className="text-brand-gold uppercase tracking-wider mr-2">SIMPLE CYCLE:</span>
                Plan → Study → Submit → Feedback → Progress
              </p>
              <Button
                to="/how-it-works"
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. CONTACT SECTION */}
      <section id="contact" className="py-12 sm:py-16 border-b-2 border-brand-dark bg-brand-paper">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionHeading
            badge="CONTACT"
            eyebrow="// REACH OUT TO PORAPLAN"
            title="Have questions or need your PoraPlan ID?"
            description="Our mentorship team is available to assist you. New to PoraPlan? Your mentor will provide your PoraPlan ID."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-6">
            <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-9 h-9 border-2 border-brand-dark bg-brand-teal-light flex items-center justify-center">
                  <Mail className="w-4 h-4 text-brand-dark" />
                </div>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-teal block">Email</span>
                <h3 className="font-heading font-bold text-base text-brand-navy">Email Support</h3>
                <p className="text-xs text-brand-dark/80 font-sans">For general inquiries and onboarding questions.</p>
              </div>
              <div className="pt-3 border-t border-brand-dark/20 mt-3">
                <a href="mailto:poraplan.bd@gmail.com" className="font-mono text-xs font-bold text-brand-teal hover:underline break-all">
                  poraplan.bd@gmail.com
                </a>
              </div>
            </div>

            <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-9 h-9 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center">
                  <ExternalLink className="w-4 h-4 text-brand-dark" />
                </div>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-navy block">Facebook</span>
                <h3 className="font-heading font-bold text-base text-brand-navy">Official Page</h3>
                <p className="text-xs text-brand-dark/80 font-sans">Platform announcements and updates.</p>
              </div>
              <div className="pt-3 border-t border-brand-dark/20 mt-3">
                <a
                  href="https://www.facebook.com/profile.php?id=61593180002346"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs font-bold text-brand-navy hover:text-brand-teal hover:underline inline-flex items-center gap-1"
                >
                  <span>facebook.com/PoraPlan</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm flex flex-col justify-between">
              <div className="space-y-2">
                <div className="w-9 h-9 border-2 border-brand-dark bg-brand-gold-light flex items-center justify-center">
                  <MessageSquare className="w-4 h-4 text-brand-dark" />
                </div>
                <span className="font-mono text-[10px] uppercase font-bold text-brand-gold-dark block">WhatsApp</span>
                <h3 className="font-heading font-bold text-base text-brand-navy">Direct Chat</h3>
                <p className="text-xs text-brand-dark/80 font-sans">Quick communication for students.</p>
              </div>
              <div className="pt-3 border-t border-brand-dark/20 mt-3 font-mono text-xs font-bold text-brand-dark">
                @PoraPlan
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. STUDENT-FRIENDLY CLOSING CTA */}
      <section className="py-12 sm:py-16 md:py-20 bg-brand-gold border-b-2 border-brand-dark">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4 sm:space-y-6">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-brand-navy tracking-tight">
            Ready to study with a clear plan?
          </h2>

          <p className="text-base sm:text-lg md:text-xl text-brand-dark max-w-xl mx-auto font-sans leading-relaxed">
            Take the guesswork out of daily studying. If you have your PoraPlan ID from your mentor, log in below.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              to="/login"
              variant="dark"
              size="lg"
              className="w-full sm:w-auto"
              rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
            >
              Log in with PoraPlan ID
            </Button>
            <Button
              to="/how-it-works"
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
            >
              See How It Works
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};
