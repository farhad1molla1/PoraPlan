import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ShieldCheck, Mail, MessageSquare, AlertCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';

export const SignupPage: React.FC = () => {
  const [poraplanId, setPoraplanId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [personalEmail, setPersonalEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { signInWithPoraPlanId, connectEmail } = useAuth();
  const navigate = useNavigate();

  const handleActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanId = poraplanId.trim();
    if (!cleanId) {
      setErrorMessage('Please enter your PoraPlan ID (e.g. PP001).');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter the initial temporary password provided by your mentor.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Authenticate & activate with PoraPlan ID + temporary password
      const { error, role: loggedInRole } = await signInWithPoraPlanId(cleanId, password);

      if (error) {
        setErrorMessage(error.message || 'Unable to activate account. Please verify your ID and password.');
        setIsSubmitting(false);
        return;
      }

      // 2. Optionally connect personal email immediately if provided
      if (personalEmail.trim()) {
        try {
          await connectEmail(personalEmail.trim());
        } catch {
          // Non-blocking if email connection fails; user can connect inside dashboard
        }
      }

      // 3. Navigate to appropriate workspace
      const targetRole = loggedInRole || 'student';
      if (targetRole === 'mentor') {
        navigate('/mentor/dashboard');
      } else if (targetRole === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to complete activation. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Activation Card */}
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
                Activate Account
              </h1>
              <p className="text-xs text-brand-dark/75 font-sans mt-1">
                For pre-registered students and mentors
              </p>
            </div>
          </div>

          {/* Feedback Alert */}
          {errorMessage && (
            <div className="p-3 border-2 border-brand-dark bg-red-50 text-xs font-sans text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5 stroke-[2.5]" />
              <span className="leading-relaxed">{errorMessage}</span>
            </div>
          )}

          {/* Controlled Activation Notice */}
          <div className="p-3.5 border-2 border-brand-dark bg-brand-paper-tint space-y-1.5 text-xs font-sans text-brand-dark leading-relaxed">
            <div className="flex items-center gap-2 text-brand-navy font-heading font-bold text-xs uppercase">
              <ShieldCheck className="w-4 h-4 text-brand-teal stroke-[2.5]" />
              <span>Mentor-Assigned Access</span>
            </div>
            <p className="text-[11px] text-brand-dark/85">
              Enter the unique PoraPlan ID and temporary password provided by your mentor to activate your workspace.
            </p>
          </div>

          {/* Activation Form */}
          <form onSubmit={handleActivation} className="space-y-3.5">
            <div>
              <label
                htmlFor="activation-id"
                className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1"
              >
                PoraPlan ID
              </label>
              <input
                id="activation-id"
                type="text"
                required
                autoCapitalize="characters"
                autoComplete="username"
                value={poraplanId}
                onChange={(e) => setPoraplanId(e.target.value.toUpperCase())}
                placeholder="e.g. PP001 or PPM001"
                className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
              />
            </div>

            <div>
              <label
                htmlFor="activation-password"
                className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1"
              >
                Initial Password
              </label>
              <div className="relative">
                <input
                  id="activation-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your initial password"
                  className="w-full px-3 py-2 pr-10 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-brand-muted hover:text-brand-dark focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 stroke-[2.2]" />
                  ) : (
                    <Eye className="w-4 h-4 stroke-[2.2]" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="activation-email"
                className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1"
              >
                Personal Email <span className="font-sans text-brand-muted text-[11px] lowercase font-normal">(optional)</span>
              </label>
              <input
                id="activation-email"
                type="email"
                autoComplete="email"
                value={personalEmail}
                onChange={(e) => setPersonalEmail(e.target.value)}
                placeholder="student@example.com"
                className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
              />
              <span className="text-[10px] text-brand-muted mt-1 block font-sans">
                Connect your email now to enable password recovery and Google sign-in.
              </span>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                disabled={isSubmitting}
                rightIcon={!isSubmitting ? <ArrowRight className="w-4 h-4 stroke-[2.5]" /> : undefined}
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Activating...
                  </span>
                ) : (
                  'Activate Workspace'
                )}
              </Button>
            </div>
          </form>

          {/* Already Activated Link */}
          <div className="pt-2 text-center">
            <p className="text-xs text-brand-dark font-sans">
              Already activated?{' '}
              <Link to="/login" className="font-bold text-brand-teal hover:underline">
                Log in here
              </Link>
            </p>
          </div>

          {/* Contact Section */}
          <div className="pt-4 border-t border-brand-dark/20 space-y-2">
            <span className="font-mono text-[11px] uppercase font-bold text-brand-muted block">
              Need your PoraPlan ID?
            </span>
            <p className="text-xs text-brand-dark/80 font-sans leading-relaxed">
              New to PoraPlan? Your mentor will provide your PoraPlan ID. If you haven't received yours yet, contact support:
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
                href="https://www.facebook.com/profile.php?id=61593180002346"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 border border-brand-dark bg-brand-paper hover:bg-brand-paper-tint flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                <span className="truncate">Facebook: PoraPlan</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
