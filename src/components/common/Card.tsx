import React from 'react';
import { cn } from '../../lib/utils';
import type { CardVariant } from '../../types';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  headerBar?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'paper',
  shadow = 'md',
  hoverable = false,
  headerBar,
  className,
  ...props
}) => {
  const baseClasses =
    'relative border border-brand-dark sm:border-2 transition-all duration-150 rounded-semantic-sm sm:rounded-none motion-reduce:transition-none';

  const shadowClasses = {
    none: 'shadow-none',
    sm: 'shadow-micro sm:shadow-brutal-xs',
    md: 'shadow-micro sm:shadow-brutal-sm',
    lg: 'shadow-tactile sm:shadow-brutal',
  };

  const hoverClasses = hoverable
    ? 'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-tactile sm:hover:shadow-brutal motion-reduce:hover:transform-none cursor-pointer'
    : '';

  const variantClasses: Record<CardVariant, string> = {
    default: 'bg-surface-card text-brand-dark dark:text-brand-navy',
    paper: 'bg-surface-card text-brand-dark dark:text-brand-navy',
    navy: 'bg-brand-navy text-brand-bg',
    gold: 'bg-brand-gold text-brand-dark',
    teal: 'bg-brand-teal text-white',
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        shadowClasses[shadow],
        hoverClasses,
        className
      )}
      {...props}
    >
      {headerBar && (
        <div className="border-b border-brand-dark sm:border-b-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-surface-inset flex items-center justify-between font-mono text-[11px] sm:text-xs tracking-wider text-brand-muted">
          {headerBar}
        </div>
      )}
      <div className={headerBar ? 'p-3 sm:p-5' : 'p-3.5 sm:p-6'}>{children}</div>
    </div>
  );
};
