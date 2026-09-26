import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserPlus, ArrowLeft, Info, User, Award } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
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
    <div className="w-full min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 academic-grid-pattern">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Navigation link */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Return to Home
          </Link>
          <Badge variant="teal" size="sm">REGISTRATION DESK</Badge>
        </div>

        {/* Signup Box */}
        <Card
          variant="paper"
          shadow="lg"
          headerBar={
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-brand-navy">NEW CADRE ENROLLMENT</span>
              <span className="text-[10px] text-brand-muted font-mono">{APP_CONFIG.codePrefix}-REG</span>
            </div>
          }
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-brand-gold border-2 border-brand-dark flex items-center justify-center mx-auto mb-3 shadow-brutal-xs">
              <UserPlus className="w-6 h-6 text-brand-dark stroke-[2.5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-navy">
              Join {APP_CONFIG.name}
            </h1>
            <p className="text-xs sm:text-sm text-brand-dark/75 mt-1 font-sans">
              Create your account to start organized study cycles or guide students as a mentor.
            </p>
          </div>

          {/* Phase 0 Notice */}
          <div className="mb-6 p-3 border-2 border-brand-dark bg-brand-gold-light text-xs font-mono flex items-start gap-2.5">
            <Info className="w-4 h-4 text-brand-dark shrink-0 mt-0.5 stroke-[2.5]" />
            <div>
              <p className="font-bold text-brand-dark">PHASE 0 ARCHITECTURAL PREVIEW</p>
              <p className="text-brand-dark/80 font-sans mt-0.5">
                Backend account creation will be connected with Supabase in future milestones.
              </p>
            </div>
          </div>

          {submitted && (
            <div className="mb-4 p-3 border-2 border-brand-dark bg-brand-teal-light text-xs font-mono text-brand-dark">
              <strong>Registration captured in preview mode.</strong> Active authentication will be connected in Phase 1.
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Role Selection Tabs */}
            <div>
              <label className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-2">
                Select Your Academic Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`p-3 border-2 border-brand-dark flex items-center justify-center gap-2 text-xs font-mono font-bold transition-all ${
                    role === 'student'
                      ? 'bg-brand-navy text-white shadow-brutal-xs -translate-x-0.5 -translate-y-0.5'
                      : 'bg-brand-paper-tint text-brand-dark hover:bg-brand-paper'
                  }`}
                >
                  <User className="w-4 h-4 stroke-[2.5]" />
                  <span>Student</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('mentor')}
                  className={`p-3 border-2 border-brand-dark flex items-center justify-center gap-2 text-xs font-mono font-bold transition-all ${
                    role === 'mentor'
                      ? 'bg-brand-teal text-white shadow-brutal-xs -translate-x-0.5 -translate-y-0.5'
                      : 'bg-brand-paper-tint text-brand-dark hover:bg-brand-paper'
                  }`}
                >
                  <Award className="w-4 h-4 stroke-[2.5]" />
                  <span>Mentor</span>
                </button>
              </div>
            </div>

            {/* Full Name */}
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1.5"
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
                className="w-full px-3.5 py-2.5 bg-brand-bg border-2 border-brand-dark text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
              />
            </div>

            {/* Email Address */}
            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1.5"
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
                className="w-full px-3.5 py-2.5 bg-brand-bg border-2 border-brand-dark text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
              />
            </div>

            {/* Target Field / Course */}
            <div>
              <label
                htmlFor="signup-focus"
                className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1.5"
              >
                {role === 'student' ? 'Primary Course / Target Exam' : 'Area of Academic Expertise'}
              </label>
              <input
                id="signup-focus"
                name="focusArea"
                type="text"
                required
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder={role === 'student' ? 'e.g. Higher Secondary Physics or CS Finals' : 'e.g. Applied Mathematics, Physics'}
                className="w-full px-3.5 py-2.5 bg-brand-bg border-2 border-brand-dark text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
              />
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="md"
              >
                Complete Registration (Preview)
              </Button>
            </div>
          </form>

          {/* Footer inside card */}
          <div className="mt-6 pt-4 border-t-2 border-brand-dark/20 text-center text-xs">
            <span className="text-brand-dark/80 font-sans">Already enrolled in PoraPlan? </span>
            <Link
              to="/login"
              className="font-bold text-brand-navy font-mono underline hover:text-brand-teal ml-1"
            >
              Sign In →
            </Link>
          </div>
        </Card>

      </div>
    </div>
  );
};
