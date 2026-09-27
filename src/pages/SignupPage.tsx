import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, Mail, MessageSquare } from 'lucide-react';
import { Button } from '../components/common/Button';

export const SignupPage: React.FC = () => {
  return (
    <div className="w-full min-h-[calc(100vh-120px)] flex items-center justify-center py-8 sm:py-12 px-4 academic-grid-pattern">
      <div className="w-full max-w-md space-y-4">
        
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            Back to Home
          </Link>
        </div>

        {/* Informative Card */}
        <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-5">
          
          {/* Header with Official Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 p-0.5 bg-brand-paper border-2 border-brand-dark flex items-center justify-center shrink-0 shadow-brutal-xs">
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
              <h1 className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy leading-none">
                PoraPlan Accounts
              </h1>
              <p className="text-xs text-brand-dark/75 font-sans mt-1">
                Personal Study Assistance &amp; Mentorship
              </p>
            </div>
          </div>

          <div className="p-4 border-2 border-brand-dark bg-brand-paper-tint space-y-2 text-xs font-sans text-brand-dark leading-relaxed">
            <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-sm">
              <ShieldCheck className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              <span>Mentor-Assigned Access</span>
            </div>
            <p>
              PoraPlan does not have open public registration. Every student and mentor is issued a unique PoraPlan ID (such as <span className="font-mono font-bold">PP001</span>) directly by their mentor or administrator.
            </p>
            <p>
              This ensures every student gets dedicated, structured mentorship from day one.
            </p>
          </div>

          <div className="space-y-3 pt-1">
            <Button
              to="/login"
              variant="primary"
              size="md"
              fullWidth
              rightIcon={<ArrowRight className="w-4 h-4 stroke-[2.5]" />}
            >
              Log in with PoraPlan ID
            </Button>
          </div>

          {/* Contact Section */}
          <div className="pt-4 border-t border-brand-dark/20 space-y-2.5">
            <span className="font-mono text-xs uppercase font-bold text-brand-muted block">
              Need your PoraPlan ID?
            </span>
            <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
              If you haven't received your PoraPlan ID yet, ask your mentor or contact PoraPlan support:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <a
                href="mailto:poraplan.bd@gmail.com"
                className="p-2 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint flex items-center gap-1.5 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-brand-teal shrink-0" />
                <span className="truncate">poraplan.bd@gmail.com</span>
              </a>
              <a
                href="https://wa.me/message"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                <span>WhatsApp: @PoraPlan</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
