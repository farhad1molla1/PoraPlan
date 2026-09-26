import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Info, KeyRound, Mail, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { APP_CONFIG } from '../lib/constants';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
            PP-GATEWAY // 01
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
                    Study Assistance
                  </span>
                </div>
              </div>

              {/* Tagline Statement */}
              <p className="font-heading font-bold text-base text-brand-gold mt-2">
                "You study. We organize how, what and when."
              </p>
              <p className="mt-1.5 text-xs text-brand-bg/80 leading-relaxed font-sans">
                Access your daily study queue, track milestone problem sets, and review mentor corrections.
              </p>

              {/* Compact Workflow Graphic */}
              <div className="mt-4 p-2.5 border border-brand-bg/25 bg-black/25 text-xs font-mono">
                <span className="text-[10px] text-brand-gold font-bold uppercase tracking-wider block mb-1">
                  DAILY PROCESS LOOP
                </span>
                <div className="space-y-1 text-[11px] text-brand-bg/85 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-brand-gold font-bold">01 //</span>
                    <span>Plan Daily Roadmap</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-gold font-bold">02 //</span>
                    <span>Focused Study &amp; Practice</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-gold font-bold">03 //</span>
                    <span>Submit For Mentor Review</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-brand-gold font-bold">04 //</span>
                    <span>Apply Feedback &amp; Advance</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-brand-bg/20 text-[10px] font-mono text-brand-bg/60">
              STATUS: Phase 0 Foundation Gateway
            </div>
          </div>

          {/* Form Column (Desktop Right, Mobile Bottom) */}
          <div className="md:col-span-7 bg-brand-paper p-5 sm:p-7 flex flex-col justify-between">
            <div>
              {/* Header Stamp */}
              <div className="flex items-center justify-between border-b-2 border-brand-dark pb-2.5 mb-3.5">
                <span className="font-mono text-xs font-bold uppercase tracking-wider text-brand-navy">
                  PORTAL ACCESS GATEWAY
                </span>
                <Badge variant="teal" size="sm">STUDENT &amp; MENTOR</Badge>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy mb-1">
                Sign In to Your Workspace
              </h1>
              <p className="text-xs text-brand-dark/75 font-sans mb-3.5">
                Enter your registered credentials to open your active study cycle.
              </p>

              {/* Phase 0 Preview Notice */}
              <div className="mb-4 p-2.5 border-2 border-brand-dark bg-brand-teal-light text-xs font-mono flex items-start gap-2">
                <Info className="w-3.5 h-3.5 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
                <div>
                  <span className="font-bold text-brand-dark block text-[11px]">PHASE 0 ARCHITECTURAL PREVIEW</span>
                  <span className="text-brand-dark/80 font-sans text-[11px]">
                    Authentication backend connects with Supabase in Phase 1.
                  </span>
                </div>
              </div>

              {submitted && (
                <div className="mb-3.5 p-2.5 border-2 border-brand-dark bg-brand-gold-light text-xs font-mono text-brand-dark">
                  <strong>Form captured in preview mode.</strong> Active authentication will be connected in Phase 1.
                </div>
              )}

              {/* Accessible Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1"
                  >
                    Academic Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@university.edu"
                      className="w-full px-3 py-2 bg-brand-bg border-2 border-brand-dark text-xs sm:text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                    />
                    <Mail className="w-3.5 h-3.5 text-brand-muted absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark"
                    >
                      Password
                    </label>
                    <span className="text-[10px] font-mono text-brand-muted">
                      Case-sensitive
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-3 py-2 bg-brand-bg border-2 border-brand-dark text-xs sm:text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                    />
                    <KeyRound className="w-3.5 h-3.5 text-brand-muted absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    size="md"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />}
                  >
                    Sign In
                  </Button>
                </div>
              </form>
            </div>

            {/* Bottom Enrolment Link */}
            <div className="mt-5 pt-3 border-t-2 border-brand-dark/20 text-center text-xs">
              <span className="text-brand-dark/80 font-sans">New to {APP_CONFIG.name}? </span>
              <Link
                to="/signup"
                className="font-bold text-brand-navy font-mono underline hover:text-brand-teal ml-1"
              >
                Create your account →
              </Link>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
