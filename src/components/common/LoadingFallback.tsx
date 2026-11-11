import React from 'react';

export interface LoadingFallbackProps {
  label?: string;
  subtext?: string;
  minHeight?: string;
}

/**
 * Minimal, brutalist loading indicator for React Suspense route transitions.
 * Fully aligned with PoraPlan design system tokens and Light/Midnight Charcoal Dark themes.
 * Strictly zero emojis.
 */
export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
  label = 'LOADING WORKSPACE',
  subtext = 'Preparing academic interface...',
  minHeight = 'min-h-[50vh]',
}) => {
  return (
    <div
      className={`w-full ${minHeight} flex flex-col items-center justify-center p-6 academic-grid-pattern`}
      role="status"
      aria-live="polite"
    >
      <div className="p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm w-full">
        <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-teal border-t-brand-navy rounded-full mb-3" />
        <p className="font-heading font-extrabold text-sm text-brand-navy">
          {label}
        </p>
        <span className="font-mono text-[11px] text-brand-muted mt-1 block">
          {subtext}
        </span>
      </div>
    </div>
  );
};

export default LoadingFallback;
