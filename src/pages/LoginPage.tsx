import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/common/Button';
import { useAuth } from '../hooks/useAuth';
import { TurnstileWidget, type TurnstileRef } from '../components/auth/TurnstileWidget';
import { isTurnstileConfigured, getTurnstileSiteKey } from '../lib/supabase';

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
  const [poraplanId, setPoraplanId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Security & abuse protection state
  const [loginCaptchaToken, setLoginCaptchaToken] = useState<string | null>(null);
  const [recoveryCaptchaToken, setRecoveryCaptchaToken] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [progressiveCooldown, setProgressiveCooldown] = useState(false);

  const loginTurnstileRef = useRef<TurnstileRef>(null);
  const recoveryTurnstileRef = useRef<TurnstileRef>(null);
  const turnstileConfigured = isTurnstileConfigured();
  const turnstileSiteKey = getTurnstileSiteKey();

  const { signInWithPoraPlanId, signInWithGoogle, resetPassword, user, role } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Bounded progressive delay: 0s for 0 attempts, 1s for 1st fail, 2s for 2nd, 4s for 3rd, max 8s
  const getProgressiveDelay = (attempts: number) => {
    if (attempts <= 0) return 0;
    return Math.min(1000 * Math.pow(2, attempts - 1), 8000);
  };

  // Derive query parameter notices without triggering cascading renders in effects
  const queryParams = new URLSearchParams(location.search);
  const queryError = queryParams.get('error') === 'google_not_linked'
    ? 'This Google account is not linked to an authorized PoraPlan account. Google login is only available for existing members whose Google account has been connected.'
    : null;
  const queryResetSuccess = queryParams.get('reset') === 'true'
    ? 'Your password has been reset. Please log in with your PoraPlan ID and new password.'
    : null;

  const displayError = errorMessage || queryError;
  const displaySuccess = successNotice || queryResetSuccess;

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
    if (isSubmitting || progressiveCooldown) {
      return;
    }

    setErrorMessage(null);
    setSuccessNotice(null);

    const cleanId = poraplanId.trim();
    if (!cleanId) {
      setErrorMessage('Please enter your PoraPlan ID.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (turnstileConfigured && !loginCaptchaToken) {
      setErrorMessage('Please complete the security challenge.');
      return;
    }

    setIsSubmitting(true);

    // Apply bounded progressive delay if previous failures occurred in this session
    const delay = getProgressiveDelay(failedAttempts);
    if (delay > 0) {
      setProgressiveCooldown(true);
      await new Promise((resolve) => setTimeout(resolve, delay));
      setProgressiveCooldown(false);
    }

    try {
      let resolutionToken = loginCaptchaToken || undefined;
      let loginToken = loginCaptchaToken || undefined;

      // Handle single-use Turnstile token lifecycle:
      // Token 1 goes to resolver; request fresh Token 2 for GoTrue
      if (turnstileConfigured && loginTurnstileRef.current) {
        const freshTokenPromise = loginTurnstileRef.current.refreshToken();
        loginToken = await Promise.race([
          freshTokenPromise,
          new Promise<string | undefined>((resolve) => setTimeout(() => resolve(undefined), 1500)),
        ]);
      }

      const { error, role: loggedInRole } = await signInWithPoraPlanId(
        cleanId,
        password,
        { resolutionToken, loginToken }
      );

      if (error) {
        setFailedAttempts((prev) => prev + 1);
        if (turnstileConfigured && loginTurnstileRef.current) {
          loginTurnstileRef.current.reset();
          setLoginCaptchaToken(null);
        }

        const raw = error.message || '';
        if (raw.toLowerCase().includes('challenge') || raw.toLowerCase().includes('captcha')) {
          setErrorMessage('Security verification failed. Please try again.');
        } else if (raw.toLowerCase().includes('network') || raw.toLowerCase().includes('unavailable')) {
          setErrorMessage('Authentication service temporarily unavailable. Please check your network connection.');
        } else {
          // Uniform error message: never reveal whether ID exists, whether password failed, or if account is suspended
          setErrorMessage('Invalid PoraPlan ID or password.');
        }
        setIsSubmitting(false);
        return;
      }

      // Successful login resets progressive failure count
      setFailedAttempts(0);

      const targetRole = loggedInRole || role || 'student';
      if (targetRole === 'mentor') {
        navigate('/mentor/dashboard');
      } else if (targetRole === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch {
      setFailedAttempts((prev) => prev + 1);
      if (turnstileConfigured && loginTurnstileRef.current) {
        loginTurnstileRef.current.reset();
        setLoginCaptchaToken(null);
      }
      setErrorMessage('Invalid PoraPlan ID or password.');
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isResetting) {
      return;
    }

    setErrorMessage(null);
    setSuccessNotice(null);

    const emailTrimmed = resetEmail.trim();
    if (!emailTrimmed) {
      setErrorMessage('Please enter the email address associated with your PoraPlan account.');
      return;
    }

    if (turnstileConfigured && !recoveryCaptchaToken) {
      setErrorMessage('Please complete the security challenge.');
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await resetPassword(emailTrimmed, recoveryCaptchaToken || undefined);
      if (error) {
        if (turnstileConfigured && recoveryTurnstileRef.current) {
          recoveryTurnstileRef.current.reset();
          setRecoveryCaptchaToken(null);
        }
        const raw = error.message || '';
        if (raw.toLowerCase().includes('captcha') || raw.toLowerCase().includes('challenge')) {
          setErrorMessage('Security verification failed. Please try again.');
        } else {
          setErrorMessage('Unable to send reset email. Please try again later.');
        }
      } else {
        setSuccessNotice(
          'If an account is associated with this email, password reset instructions have been sent. Please check your inbox.'
        );
        setShowForgotPassword(false);
        setResetEmail('');
        setRecoveryCaptchaToken(null);
      }
    } catch {
      setErrorMessage('Unable to send reset email. Please try again later.');
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
        <div className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 sm:p-8">
          
          {/* Header with Official Logo */}
          <div className="flex items-center gap-3 mb-6">
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
          {displayError && (
            <div className="mb-4 p-3 border-2 border-brand-dark bg-red-50 text-xs font-sans text-red-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5 stroke-[2.5]" />
              <span className="leading-relaxed">{displayError}</span>
            </div>
          )}

          {displaySuccess && (
            <div className="mb-4 p-3 border-2 border-brand-dark bg-emerald-50 text-xs font-sans text-emerald-900 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 stroke-[2.5]" />
              <span className="leading-relaxed">{displaySuccess}</span>
            </div>
          )}

          {!showForgotPassword ? (
            <div className="space-y-4">
              {/* Primary Method: PoraPlan ID + Password */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="poraplan-id"
                    className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1"
                  >
                    PoraPlan ID
                  </label>
                  <input
                    id="poraplan-id"
                    type="text"
                    required
                    autoCapitalize="characters"
                    autoComplete="username"
                    value={poraplanId}
                    onChange={(e) => setPoraplanId(e.target.value.toUpperCase())}
                    placeholder="Enter your PoraPlan ID (e.g. PP001)"
                    className="w-full px-3 py-2.5 text-base sm:text-sm min-h-[44px] border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-mono font-bold uppercase text-brand-dark"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-[11px] font-sans text-brand-teal hover:underline font-semibold"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full px-3 py-2.5 pr-12 text-base sm:text-sm min-h-[44px] border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-0 top-0 bottom-0 min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-brand-muted hover:text-brand-dark focus:outline-none transition-colors cursor-pointer"
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

                {/* Cloudflare Turnstile CAPTCHA (Login) */}
                {turnstileConfigured && (
                  <TurnstileWidget
                    ref={loginTurnstileRef}
                    siteKey={turnstileSiteKey}
                    onSuccess={(token) => setLoginCaptchaToken(token)}
                    onExpire={() => setLoginCaptchaToken(null)}
                    action="login"
                  />
                )}

                <div className="pt-1">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    disabled={isSubmitting || isGoogleLoading || progressiveCooldown}
                  >
                    {progressiveCooldown ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Please wait...
                      </span>
                    ) : isSubmitting ? (
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

              {/* Visual Divider */}
              <div className="relative flex items-center justify-center my-3">
                <div className="w-full border-t border-brand-dark/20" />
                <span className="bg-brand-paper px-3 text-[11px] font-mono text-brand-muted uppercase">
                  or
                </span>
                <div className="w-full border-t border-brand-dark/20" />
              </div>

              {/* Secondary Method: Continue with Google */}
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

              {/* Controlled Model Guidance */}
              <div className="pt-4 border-t border-brand-dark/20 text-center">
                <p className="text-xs text-brand-dark font-sans leading-relaxed">
                  <span className="font-bold text-brand-navy block mb-0.5">New to PoraPlan?</span>
                  Your mentor will provide your PoraPlan ID.
                </p>
              </div>
            </div>
          ) : (
            /* Forgot Password Sub-View */
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <h2 className="text-sm font-heading font-bold text-brand-navy mb-1">
                  Reset your password
                </h2>
                <p className="text-xs text-brand-dark/80 font-sans leading-relaxed mb-3">
                  Enter the email address associated with your PoraPlan account. We will send a secure password reset link.
                </p>
                <label
                  htmlFor="reset-email"
                  className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1"
                >
                  Associated email address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="student@example.com"
                  className="w-full px-3 py-2.5 text-base sm:text-sm min-h-[44px] border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
                />
                <span className="text-[11px] text-brand-muted mt-1 block font-sans">
                  Password reset requires access to your verified connected email address.
                </span>

                {/* Cloudflare Turnstile CAPTCHA (Recovery) */}
                {turnstileConfigured && (
                  <TurnstileWidget
                    ref={recoveryTurnstileRef}
                    siteKey={turnstileSiteKey}
                    onSuccess={(token) => setRecoveryCaptchaToken(token)}
                    onExpire={() => setRecoveryCaptchaToken(null)}
                    action="reset_password"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForgotPassword(false);
                    setErrorMessage(null);
                  }}
                  className="flex-1"
                >
                  Back to Log in
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

        </div>

      </div>
    </div>
  );
};
