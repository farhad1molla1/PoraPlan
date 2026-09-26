import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, User, Award, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { APP_CONFIG } from '../lib/constants';

export const SignupPage: React.FC = () => {
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="w-full min-h-[calc(100vh-120px)] flex items-center justify-center py-6 sm:py-10 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern">
      <div className="w-full max-w-4xl space-y-3">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            Return to Home
          </Link>
          <span className="font-mono text-[10px] text-brand-muted uppercase">
            PP-REGISTRY // 01
          </span>
        </div>

        {/* 2-Column Split Neo-Brutalist Card */}
        <div className="border-2 border-brand-dark shadow-brutal bg-brand-paper grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          
          {/* Brand & Visual Column (Desktop Left, Mobile Top) */}
          <div className="md:col-span-5 bg-brand-navy text-brand-bg p-5 sm:p-7 flex flex-col justify-between border-b-2 md:border-b-0 md:border-r-2 border-brand-dark relative">
            <div>
              {/* Brand Logo & Mark */}
              <div className="flex items-center gap-2.5 mb-4">
                <div className="h-9 w-9 p-0.5 bg-brand-paper border-2 border-brand-dark flex items-center justify-center shrink-0 shadow-brutal-xs">
                  <img
                    src="/poraplan-logo.png"
                    alt="PoraPlan Logo"
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      if (!target.src.includes('assets')) {
                        target.src = '/assets/poraplan-logo.png';
                      }
                    }}
                  />
                </div>
                <div>
                  <h2 className="font-heading font-extrabold text-lg text-brand-bg leading-tight">
                    {APP_CONFIG.name}
                  </h2>
                  <span className="text-[10px] font-mono text-brand-gold uppercase tracking-wider block">
                    Study &amp; Mentorship
                  </span>
                </div>
              </div>

              {/* Headline Statement */}
              <h3 className="font-heading font-extrabold text-lg text-brand-gold mt-2">
                Start Your PoraPlan Journey
              </h3>
              <p className="mt-1.5 text-xs text-brand-bg/80 leading-relaxed font-sans">
                Move away from chaotic study schedules. Join the foundation cohort to participate in structured daily learning cycles.
              </p>

              {/* Roles Breakdown Box */}
              <div className="mt-4 p-2.5 border border-brand-bg/25 bg-black/25 text-xs font-mono space-y-2.5">
                <div>
                  <span className="text-[10px] text-brand-teal font-bold uppercase tracking-wider block">
                    FOR STUDENTS:
                  </span>
                  <p className="text-[11px] text-brand-bg/85 font-sans mt-0.5">
                    Structured roadmaps, defined daily problem sets, and prompt review from mentors.
                  </p>
                </div>
                <div className="pt-2 border-t border-brand-bg/15">
                  <span className="text-[10px] text-brand-gold font-bold uppercase tracking-wider block">
                    FOR MENTORS:
                  </span>
                  <p className="text-[11px] text-brand-bg/85 font-sans mt-0.5">
                    Evaluate genuine student submissions, identify errors, and guide conceptual development.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-brand-bg/20 text-[10px] font-mono text-brand-bg/60">
              STATUS: Foundation Enrolment Active
            </div>
          </div>

          {/* Form Column (Desktop Right, Mobile Bottom) */}
          <div className="md:col-span-7 bg-brand-paper p-5 sm:p-7 flex flex-col justify-between">
            <div>
              {/* Header Stamp */}
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2.5 mb-3.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-navy">
                  NEW CADRE ENROLLMENT
                </span>
                <Badge variant="gold" size="sm">FOUNDATION COHORT</Badge>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy mb-1">
                Begin Your Registration
              </h1>
              <p className="text-xs text-brand-dark/75 font-sans mb-3.5">
                Select your academic cadre and reserve your place in the upcoming cohort.
              </p>

              {/* Phase 0 Notice */}
              <div className="mb-3.5 p-2.5 border-2 border-brand-dark bg-brand-gold-light text-xs font-mono flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-brand-dark shrink-0 mt-0.5 stroke-[2.5]" />
                <div>
                  <span className="font-bold text-brand-dark block text-[11px]">PHASE 0 ARCHITECTURAL PREVIEW</span>
                  <span className="text-brand-dark/80 font-sans text-[11px]">
                    Backend account creation will connect with Supabase in Phase 1.
                  </span>
                </div>
              </div>

              {submitted && (
                <div className="mb-3.5 p-2.5 border-2 border-brand-dark bg-brand-teal-light text-xs font-mono text-brand-dark">
                  <strong>Registration captured in preview mode.</strong> Active authentication will be connected in Phase 1.
                </div>
              )}

              {/* Accessible Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                
                {/* Tactile Role Selector */}
                <div>
                  <label className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1.5">
                    Select Your Academic Role
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRole('student')}
                      className={`p-2.5 border-2 border-brand-dark flex items-center justify-center gap-1.5 text-xs font-mono font-bold transition-all ${
                        role === 'student'
                          ? 'bg-brand-navy text-white shadow-brutal-xs -translate-x-0.5 -translate-y-0.5'
                          : 'bg-brand-paper-tint text-brand-dark hover:bg-brand-paper'
                      }`}
                    >
                      <User className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Student</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('mentor')}
                      className={`p-2.5 border-2 border-brand-dark flex items-center justify-center gap-1.5 text-xs font-mono font-bold transition-all ${
                        role === 'mentor'
                          ? 'bg-brand-teal text-white shadow-brutal-xs -translate-x-0.5 -translate-y-0.5'
                          : 'bg-brand-paper-tint text-brand-dark hover:bg-brand-paper'
                      }`}
                    >
                      <Award className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Mentor</span>
                    </button>
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label
                    htmlFor="signup-name"
                    className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1"
                  >
                    Full Name
                  </label>
                  <input
                    id="signup-name"
                    name="fullName"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Alex Mercer"
                    className="w-full px-3 py-2 bg-brand-bg border-2 border-brand-dark text-xs sm:text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                  />
                </div>

                {/* Academic Email Address */}
                <div>
                  <label
                    htmlFor="signup-email"
                    className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1"
                  >
                    Academic Email Address
                  </label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.mercer@university.edu"
                    className="w-full px-3 py-2 bg-brand-bg border-2 border-brand-dark text-xs sm:text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                  />
                </div>

                {/* Target Field / Course */}
                <div>
                  <label
                    htmlFor="signup-focus"
                    className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1"
                  >
                    {role === 'student' ? 'Target Syllabus / Exam Focus' : 'Area of Mentorship Expertise'}
                  </label>
                  <input
                    id="signup-focus"
                    name="focusArea"
                    type="text"
                    required
                    value={focusArea}
                    onChange={(e) => setFocusArea(e.target.value)}
                    placeholder={role === 'student' ? 'e.g. Higher Secondary Physics or Calculus' : 'e.g. Applied Mathematics, Physics'}
                    className="w-full px-3 py-2 bg-brand-bg border-2 border-brand-dark text-xs sm:text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                  />
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    size="md"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />}
                  >
                    Enroll in Foundation Cohort
                  </Button>
                </div>
              </form>
            </div>

            {/* Bottom Login Link */}
            <div className="mt-5 pt-3 border-t-2 border-brand-dark/20 text-center text-xs">
              <span className="text-brand-dark/80 font-sans">Already enrolled in PoraPlan? </span>
              <Link
                to="/login"
                className="font-bold text-brand-navy font-mono underline hover:text-brand-teal ml-1"
              >
                Sign In to Portal →
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
