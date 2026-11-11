import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertTriangle, RotateCcw, Home, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  level?: 'root' | 'route' | 'widget';
  onReset?: () => void;
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * PoraPlan Unified Error Boundary
 *
 * Implements resilient error boundary boundaries across Root and Route layers:
 * 1. Root Level: Prevents full application white-screen crashes if providers or layout fails.
 * 2. Route Level: Isolates page/canvas failures inside Layout Outlets, preserving navigation,
 *    active authentication, and role context without causing redirect loops.
 * 3. Safe Recovery: Resets boundary on retry or route change (via resetKeys).
 * 4. Zero Secrets / Clean Hygiene: Stack traces and sensitive credentials are never rendered to users.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Safe development logging without exposing sensitive tokens or PII
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.error('[PoraPlan ErrorBoundary Caught Error]:', error.message, errorInfo.componentStack);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { hasError } = this.state;
    const { resetKeys } = this.props;

    if (hasError && resetKeys && prevProps.resetKeys) {
      const hasChanged = resetKeys.some((key, idx) => key !== prevProps.resetKeys?.[idx]);
      if (hasChanged) {
        this.resetError();
      }
    }
  }

  resetError = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorCount: prev.errorCount + 1,
    }));
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallbackTitle, fallbackMessage, level = 'route' } = this.props;

    if (!hasError) {
      return children;
    }

    // Root-Level Fallback: Full screen recovery shell
    if (level === 'root') {
      return (
        <div
          className="min-h-screen w-full flex items-center justify-center p-4 bg-brand-bg text-brand-dark academic-grid-pattern"
          role="alert"
          aria-live="assertive"
        >
          <div className="max-w-lg w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 sm:p-8 space-y-5 text-center">
            <div className="w-12 h-12 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
              <AlertTriangle className="w-6 h-6 text-brand-dark stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <span className="font-mono text-[10px] sm:text-xs text-brand-muted uppercase tracking-wider block">
                Academic Workspace Recovery
              </span>
              <h1 className="font-heading font-extrabold text-lg sm:text-xl text-brand-navy">
                {fallbackTitle || 'Workspace Interrupted'}
              </h1>
              <p className="font-sans text-xs sm:text-sm text-brand-dark/80 max-w-sm mx-auto leading-relaxed">
                {fallbackMessage ||
                  'An unexpected rendering error occurred. Your authentication and academic data remain safe.'}
              </p>
            </div>

            {/* Safe development diagnostics (only non-sensitive message, never stack traces) */}
            {typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && error && (
              <div className="p-3 bg-brand-paper-tint border border-brand-dark text-left font-mono text-[11px] text-brand-dark/90 break-words max-h-32 overflow-y-auto">
                <span className="font-bold text-red-600 uppercase block text-[10px] mb-1">
                  Development Notice
                </span>
                {error.message || 'Component render exception'}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={this.resetError}
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto"
              >
                Try Again
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.reload();
                }}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto"
              >
                Reload Page
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (typeof window !== 'undefined') window.location.href = '/';
                }}
                leftIcon={<Home className="w-3.5 h-3.5" />}
                className="w-full sm:w-auto"
              >
                Return Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    // Route-Level Fallback: Compact canvas recovery inside dashboard or public layout
    return (
      <div
        className="w-full min-h-[50vh] flex items-center justify-center p-4 sm:p-6"
        role="alert"
        aria-live="polite"
      >
        <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 text-center space-y-4">
          <div className="w-10 h-10 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center shadow-brutal-xs">
            <AlertTriangle className="w-5 h-5 text-brand-dark stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] text-brand-muted uppercase tracking-wider block">
              Section Notice
            </span>
            <h2 className="font-heading font-extrabold text-base sm:text-lg text-brand-navy">
              {fallbackTitle || 'Unable to Display Section'}
            </h2>
            <p className="font-sans text-xs text-brand-dark/80 leading-relaxed">
              {fallbackMessage ||
                'This section encountered an issue while displaying. Other workspace sections and navigation remain fully operational.'}
            </p>
          </div>

          {/* Safe development diagnostics */}
          {typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production' && error && (
            <div className="p-2.5 bg-brand-paper-tint border border-brand-dark text-left font-mono text-[10px] text-brand-dark/90 break-words max-h-24 overflow-y-auto">
              <span className="font-bold text-red-600 uppercase block text-[9px] mb-0.5">
                Dev Error
              </span>
              {error.message || 'Component render exception'}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
            <Button
              variant="primary"
              size="sm"
              onClick={this.resetError}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
            >
              Retry Section
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload();
              }}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto"
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Root-level boundary wrapper
 */
export const RootErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => {
  return <ErrorBoundary level="root" {...props} />;
};

/**
 * Route-level boundary wrapper.
 * Automatically synchronizes with react-router location to reset errors on page transition.
 */
export const RouteErrorBoundary: React.FC<Omit<ErrorBoundaryProps, 'level'>> = (props) => {
  const location = useLocation();
  const pathname = location?.pathname || '';
  return <ErrorBoundary level="route" resetKeys={[pathname]} {...props} />;
};
