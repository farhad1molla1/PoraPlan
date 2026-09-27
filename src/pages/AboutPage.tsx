import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  BookOpen,
  ListTodo,
  FileCheck,
  Users,
  HelpCircle,
  MessageSquare,
  TrendingUp,
  Award,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { APP_CONFIG } from '../lib/constants';

export const AboutPage: React.FC = () => {
  const whatYouGet = [
    {
      title: 'A clear study plan',
      desc: 'Know exactly what to study each day, broken down from your syllabus into manageable steps.',
      icon: <Calendar className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Plan',
    },
    {
      title: 'Useful study resources',
      desc: 'Targeted readings and practice questions matched to each topic so you don’t waste hours searching.',
      icon: <BookOpen className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Material',
    },
    {
      title: 'Daily study tasks',
      desc: 'Bite-sized goals for each study session so you always know what to start with.',
      icon: <ListTodo className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Tasks',
    },
    {
      title: 'Practice & assignments',
      desc: 'Problem sets and exercises that test whether you truly understand the concepts.',
      icon: <FileCheck className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Practice',
    },
    {
      title: 'Mentor guidance',
      desc: 'Advice and direction from an academic mentor who helps you stay on track.',
      icon: <Users className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Mentor',
    },
    {
      title: 'Doubt clarification',
      desc: 'Ask questions when you hit a wall and get clear answers before confusion piles up.',
      icon: <HelpCircle className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Support',
    },
    {
      title: 'Feedback on your work',
      desc: 'Personal review on your submissions so you know what you did well and what to fix.',
      icon: <MessageSquare className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Review',
    },
    {
      title: 'Progress tracking',
      desc: 'A straightforward view of what’s finished, what’s coming next, and where you stand.',
      icon: <TrendingUp className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Progress',
    },
    {
      title: 'Exam preparation',
      desc: 'Built-in revision cycles and practice checkpoints to keep you confident before exams.',
      icon: <Award className="w-5 h-5 text-brand-dark stroke-[2.2]" />,
      badge: 'Exams',
    },
  ];

  return (
    <div className="w-full pb-16 sm:pb-20">
      {/* Top Banner / Breadcrumb */}
      <section className="bg-brand-paper border-b-2 border-brand-dark py-8 sm:py-12 academic-grid-pattern">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-3">
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

          <h1 className="text-3xl sm:text-5xl font-extrabold text-brand-navy tracking-tight">
            About {APP_CONFIG.name}
          </h1>
          <p className="mt-2 text-base sm:text-lg text-brand-dark/85 font-sans max-w-2xl leading-relaxed">
            Personal study assistance and mentorship for students who want a clear, organized way to study.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-10 sm:space-y-14">
        
        {/* Section 1: What is PoraPlan? */}
        <section aria-labelledby="what-is-poraplan" className="space-y-4">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-4">
            <Badge variant="teal" size="sm">WHAT IS PORAPLAN?</Badge>
            
            <h2 id="what-is-poraplan" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-navy">
              A study system designed around how students actually learn
            </h2>
            
            <p className="text-sm sm:text-base text-brand-dark/90 leading-relaxed font-sans">
              PoraPlan is a personal study assistance and mentorship system for students. You bring your syllabus, study materials, goals, and available study hours. We help organize what to study, what resources to use, how to approach each topic, and what to do next.
            </p>

            <div className="p-4 border-l-4 border-brand-gold bg-brand-gold-light font-mono text-xs sm:text-sm text-brand-dark space-y-1">
              <span className="font-bold block uppercase text-brand-navy">Our core principle:</span>
              <p>"{APP_CONFIG.tagline}"</p>
            </div>
          </div>
        </section>

        {/* Section 2: Why does PoraPlan exist? */}
        <section aria-labelledby="why-it-exists" className="space-y-4">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-4">
            <Badge variant="gold" size="sm">WHY WE BUILT THIS</Badge>
            
            <h2 id="why-it-exists" className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy">
              Students shouldn't have to figure everything out alone
            </h2>
            
            <div className="space-y-3 text-sm sm:text-base text-brand-dark/85 font-sans leading-relaxed">
              <p>
                Every semester starts with good intentions: clean notebooks, ambitious timetables, and big goals. But within a few weeks, timetables fall apart, topics pile up, and panic takes over.
              </p>
              <p>
                The issue is rarely lack of effort. Most students just lack an organized routine. When you have to spend mental energy deciding what chapter to read, which practice questions to do, and whether you're behind, studying feels overwhelming.
              </p>
              <p>
                PoraPlan removes that stress. We organize your roadmap so you can sit down and focus entirely on learning.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3: What does a student actually get? (9 Clean Items) */}
        <section aria-labelledby="what-you-get" className="space-y-6">
          <div>
            <Badge variant="navy" size="sm">WHAT YOU GET</Badge>
            <h2 id="what-you-get" className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-navy mt-1.5">
              Everything in one clear, simple routine
            </h2>
            <p className="text-sm text-brand-dark/80 font-sans mt-1">
              No complicated spreadsheets or gimmicks. Just practical tools that help you finish your syllabus.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatYouGet.map((item) => (
              <div
                key={item.title}
                className="p-5 border-2 border-brand-dark bg-brand-paper shadow-brutal-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 border-2 border-brand-dark bg-brand-paper-tint flex items-center justify-center shadow-brutal-xs">
                      {item.icon}
                    </div>
                    <span className="font-mono text-[10px] uppercase font-bold text-brand-muted px-2 py-0.5 border border-brand-dark/30">
                      {item.badge}
                    </span>
                  </div>

                  <h3 className="font-heading font-bold text-base text-brand-navy mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-dark/80 font-sans leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: How does it help during your week? */}
        <section aria-labelledby="how-it-helps" className="space-y-4">
          <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg shadow-brutal p-6 sm:p-8 space-y-4">
            <span className="font-mono text-xs uppercase font-bold text-brand-gold tracking-wider block">
              YOUR WEEKLY RHYTHM
            </span>
            <h2 id="how-it-helps" className="text-xl sm:text-2xl font-extrabold font-heading text-brand-bg">
              How studying with PoraPlan feels
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 border-2 border-brand-dark bg-brand-paper text-brand-dark space-y-1.5 shadow-brutal-xs">
                <span className="font-mono text-xs font-bold text-brand-teal">01 / MORNING</span>
                <h3 className="font-heading font-bold text-sm text-brand-navy">Check today's task</h3>
                <p className="text-xs text-brand-dark/80 font-sans">
                  Open your dashboard and immediately see what topic to cover today. No guessing.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-paper text-brand-dark space-y-1.5 shadow-brutal-xs">
                <span className="font-mono text-xs font-bold text-brand-gold">02 / STUDY &amp; SUBMIT</span>
                <h3 className="font-heading font-bold text-sm text-brand-navy">Do the work</h3>
                <p className="text-xs text-brand-dark/80 font-sans">
                  Study the notes, solve the problem set, and upload your answers for your mentor to check.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-paper text-brand-dark space-y-1.5 shadow-brutal-xs">
                <span className="font-mono text-xs font-bold text-brand-teal">03 / FEEDBACK</span>
                <h3 className="font-heading font-bold text-sm text-brand-navy">Review &amp; advance</h3>
                <p className="text-xs text-brand-dark/80 font-sans">
                  Read your mentor's comments, fix mistakes, and move to the next chapter with confidence.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 5: How mentor support works */}
        <section aria-labelledby="mentor-support" className="space-y-4">
          <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-4">
            <Badge variant="teal" size="sm">MENTOR SUPPORT</Badge>
            
            <h2 id="mentor-support" className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy">
              How mentor support works
            </h2>

            <p className="text-sm sm:text-base text-brand-dark/90 leading-relaxed font-sans">
              Mentorship at PoraPlan is focused on real academic guidance, not generic motivation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-1.5 shadow-brutal-xs">
                <h3 className="font-heading font-bold text-sm text-brand-navy">Checking your work</h3>
                <p className="text-xs sm:text-sm text-brand-dark/80 font-sans leading-relaxed">
                  Your mentor reviews each assignment and practice submission you turn in, pointing out exact calculation steps or conceptual gaps.
                </p>
              </div>

              <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-1.5 shadow-brutal-xs">
                <h3 className="font-heading font-bold text-sm text-brand-navy">Clear doubt resolution</h3>
                <p className="text-xs sm:text-sm text-brand-dark/80 font-sans leading-relaxed">
                  When you get stuck on a topic, you don't stay stranded. Ask your mentor directly and receive simple, focused explanations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Section 6: Closing CTA */}
        <section className="text-center p-8 sm:p-10 border-2 border-brand-dark bg-brand-gold shadow-brutal space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy font-heading">
            Start studying with a clear plan today
          </h2>
          <p className="text-sm sm:text-base text-brand-dark max-w-lg mx-auto font-sans leading-relaxed">
            Have your PoraPlan ID ready? Log in to your workspace or contact your mentor.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              to="/login"
              variant="dark"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
            >
              Log In to Workspace
            </Button>
            <Button
              to="/how-it-works"
              variant="outline"
              size="md"
            >
              See How It Works
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
};
