import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';

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

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const { signIn, signInWithGoogle, resetPassword, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // If already authenticated, redirect to workspace
  useEffect(() => {
    if (user && role) {
      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (from && from !== '/login') {
        navigate(from, { replace: true });
      } else if (role === 'mentor') {
        navigate('/mentor/dashboard', { replace: true });
      } else if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true });
      } else {
        navigate('/student/dashboard', { replace: true });
      }
    }
  }, [user, role, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);
    setIsSubmitting(true);

    try {
      const { error, role: loggedInRole } = await signIn(email, password);

      if (error) {
        setErrorMessage(error.message || 'Incorrect email or password. Please try again.');
        setIsSubmitting(false);
        return;
      }

      const targetRole = loggedInRole || role || 'student';
      if (targetRole === 'mentor') {
        navigate('/mentor/dashboard');
      } else if (targetRole === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to sign in. Please try again.';
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
      // Browser redirects to Google OAuth
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setErrorMessage(msg);
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!resetEmail) {
      setErrorMessage('Please enter your email address to receive password reset instructions.');
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await resetPassword(resetEmail);
      if (error) {
        setErrorMessage(error.message || 'Unable to send reset email. Please verify your address.');
      } else {
        setSuccessNotice('Password reset email sent! Check your inbox for instructions.');
        setShowForgotPassword(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending reset email.';
      setErrorMessage(msg);
    } finally {
      setIsResetting(false);
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
                Welcome back
              </h1>
              <p className="text-xs text-brand-dark/75 font-sans mt-1">
                Log in to your PoraPlan workspace
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

          {/* Google Sign In Option */}
          <div className="space-y-4">
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

            {/* Email / Password Form */}
            {!showForgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                    Email address
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="login-password" className="block text-xs font-mono font-bold uppercase text-brand-dark">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgotPassword(true);
                        setResetEmail(email);
                      }}
                      className="text-[11px] font-sans text-brand-teal hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                  />
                </div>

                <div className="pt-1">
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
                        Logging in...
                      </span>
                    ) : (
                      'Log in'
                    )}
                  </Button>
                </div>
              </form>
            ) : (
              /* Forgot Password Form */
              <form onSubmit={handleForgotPassword} className="space-y-3.5">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                    Enter your email address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="student@example.com"
                    className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                  />
                  <p className="text-[11px] text-brand-muted mt-1 font-sans">
                    We will send a password reset link to this address.
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowForgotPassword(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    className="flex-1"
                    disabled={isResetting}
                  >
                    {isResetting ? 'Sending...' : 'Send reset link'}
                  </Button>
                </div>
              </form>
            )}

            {/* Bottom Switch Link */}
            <div className="pt-3 border-t border-brand-dark/20 text-center">
              <p className="text-xs text-brand-dark/80 font-sans">
                Don't have an account?{' '}
                <Link to="/signup" className="font-bold text-brand-navy hover:text-brand-teal underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
