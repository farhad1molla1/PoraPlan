import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn, ArrowLeft, Info, KeyRound, Mail } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
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
    <div className="w-full min-h-[calc(100vh-140px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 academic-grid-pattern">
      <div className="w-full max-w-md space-y-6">
        
        {/* Navigation link */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase font-bold text-brand-dark hover:text-brand-teal transition-colors"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
            Return to Home
          </Link>
          <Badge variant="gold" size="sm">PORTAL GATEWAY</Badge>
        </div>

        {/* Login Box */}
        <Card
          variant="paper"
          shadow="lg"
          headerBar={
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-brand-navy">PORTAL AUTHENTICATION</span>
              <span className="text-[10px] text-brand-muted font-mono">{APP_CONFIG.codePrefix}-AUTH</span>
            </div>
          }
        >
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-brand-navy border-2 border-brand-dark flex items-center justify-center mx-auto mb-3 shadow-brutal-xs">
              <LogIn className="w-6 h-6 text-brand-gold stroke-[2.5]" />
            </div>
            <h1 className="text-2xl font-extrabold font-heading text-brand-navy">
              Sign In to {APP_CONFIG.name}
            </h1>
            <p className="text-xs sm:text-sm text-brand-dark/75 mt-1 font-sans">
              Enter your student or mentor credentials to access your dashboard.
            </p>
          </div>

          {/* Phase 0 Notice */}
          <div className="mb-6 p-3 border-2 border-brand-dark bg-brand-teal-light text-xs font-mono flex items-start gap-2.5">
            <Info className="w-4 h-4 text-brand-teal shrink-0 mt-0.5 stroke-[2.5]" />
            <div>
              <p className="font-bold text-brand-dark">PHASE 0 ARCHITECTURAL PREVIEW</p>
              <p className="text-brand-dark/80 font-sans mt-0.5">
                Authentication and database backend will be integrated with Supabase in upcoming milestones.
              </p>
            </div>
          </div>

          {submitted && (
            <div className="mb-4 p-3 border-2 border-brand-dark bg-brand-gold-light text-xs font-mono text-brand-dark">
              <strong>Form captured in preview mode.</strong> Active authentication will be connected in Phase 1.
            </div>
          )}

          {/* Accessible Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark mb-1.5"
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
                  className="w-full px-3.5 py-2.5 bg-brand-bg border-2 border-brand-dark text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                />
                <Mail className="w-4 h-4 text-brand-muted absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-mono uppercase font-bold tracking-wider text-brand-dark"
                >
                  Password
                </label>
                <span className="text-[11px] font-mono text-brand-muted">
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
                  className="w-full px-3.5 py-2.5 bg-brand-bg border-2 border-brand-dark text-sm text-brand-dark placeholder-brand-dark/40 font-mono shadow-brutal-xs focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-brand-dark"
                />
                <KeyRound className="w-4 h-4 text-brand-muted absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                fullWidth
                size="md"
              >
                Sign In
              </Button>
            </div>
          </form>

          {/* Footer inside card */}
          <div className="mt-6 pt-4 border-t-2 border-brand-dark/20 text-center text-xs">
            <span className="text-brand-dark/80 font-sans">New to {APP_CONFIG.name}? </span>
            <Link
              to="/signup"
              className="font-bold text-brand-navy font-mono underline hover:text-brand-teal ml-1"
            >
              Create an account →
            </Link>
          </div>
        </Card>

      </div>
    </div>
  );
};
