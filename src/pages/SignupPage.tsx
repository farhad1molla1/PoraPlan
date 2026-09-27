import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, CheckCircle2, User, Award } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/database';

const GoogleIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.03h3.88c2.27-2.09 3.66-5.17 3.66-9.12z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.03c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29c-.25-.72-.38-1.49-.38-2.29s.13-1.57.38-2.29V6.57H1.27C.46 8.19 0 10.03 0 12s.46 3.81 1.27 5.43l4.01-3.14z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.57l4.01 3.14c.95-2.83 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

export const SignupPage: React.FC = () => {
  const [role, setRole] = useState<'student' | 'mentor'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const { signUp, signInWithGoogle, user, role: currentRole } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to respective role workspace
  useEffect(() => {
    if (user && currentRole) {
      if (currentRole === 'mentor') {
        navigate('/mentor/dashboard', { replace: true });
      } else if (currentRole === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [user, currentRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error, role: createdRole } = await signUp(
        email,
        password,
        fullName || (role === 'mentor' ? 'Academic Mentor' : 'Student Scholar'),
        role as UserRole
      );

      if (error) {
        setErrorMessage(error.message || 'Registration could not be completed.');
        setIsSubmitting(false);
        return;
      }

      setSuccessNotice('Account created! Opening your workspace...');
      setTimeout(() => {
        const target = createdRole === 'mentor' ? '/mentor/dashboard' : '/student/dashboard';
        navigate(target);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during sign up.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsGoogleLoading(true);

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setErrorMessage(error.message || 'Google sign-in could not be initiated.');
        setIsGoogleLoading(false);
      }
      // Redirects to Google OAuth
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setErrorMessage(msg);
      setIsGoogleLoading(false);
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

        {/* Minimal Auth Card */}
        <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8">
          
          {/* Header with Logo */}
          <div className="flex items-center gap-3 mb-5">
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
                Create your PoraPlan account
              </h1>
              <p className="text-xs text-brand-dark/75 font-sans mt-1">
                Organize your study plan and daily tasks
              </p>
            </div>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div className="mb-4 p-3 border-2 border-brand-dark bg-red-50 text-xs font-sans text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5 stroke-[2.5]" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successNotice && (
            <div className="mb-4 p-3 border-2 border-brand-dark bg-emerald-50 text-xs font-sans text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 stroke-[2.5]" />
              <span>{successNotice}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Account Type Selector */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1.5">
                I am joining as a
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`p-2 border-2 border-brand-dark text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all ${
                    role === 'student'
                      ? 'bg-brand-teal text-white shadow-brutal-xs'
                      : 'bg-brand-paper hover:bg-brand-paper-tint text-brand-dark'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Student</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRole('mentor')}
                  className={`p-2 border-2 border-brand-dark text-xs font-heading font-bold flex items-center justify-center gap-1.5 transition-all ${
                    role === 'mentor'
                      ? 'bg-brand-gold text-brand-dark shadow-brutal-xs'
                      : 'bg-brand-paper hover:bg-brand-paper-tint text-brand-dark'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  <span>Mentor</span>
                </button>
              </div>
            </div>

            {/* Google Sign In Option */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading || isSubmitting}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 border-2 border-brand-dark bg-brand-paper hover:bg-brand-paper-tint text-xs sm:text-sm font-bold font-sans text-brand-dark shadow-brutal-sm hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all disabled:opacity-60"
            >
              {isGoogleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-brand-dark" />
              ) : (
                <GoogleIcon className="w-4 h-4 shrink-0" />
              )}
              <span>Continue with Google</span>
            </button>

            {/* Visual Divider */}
            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-brand-dark/20" />
              <span className="bg-brand-paper px-3 text-[11px] font-mono text-brand-muted uppercase">
                OR
              </span>
              <div className="w-full border-t border-brand-dark/20" />
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label htmlFor="signup-name" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Full name
                </label>
                <input
                  id="signup-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Farhad Molla"
                  className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                />
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Email address
                </label>
                <input
                  id="signup-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                />
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Password
                </label>
                <input
                  id="signup-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                />
              </div>

              <div>
                <label htmlFor="signup-confirm-password" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                  Confirm password
                </label>
                <input
                  id="signup-confirm-password"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={isSubmitting || isGoogleLoading}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating account...
                    </span>
                  ) : (
                    'Create account'
                  )}
                </Button>
              </div>
            </form>

            {/* Bottom Switch Link */}
            <div className="pt-3 border-t border-brand-dark/20 text-center">
              <p className="text-xs text-brand-dark/80 font-sans">
                Already have an account?{' '}
                <Link to="/login" className="font-bold text-brand-navy hover:text-brand-teal underline">
                  Log in
                </Link>
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
