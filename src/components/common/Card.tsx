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
  const baseClasses = 'relative border-2 border-brand-dark transition-all duration-150 rounded-none';

  const shadowClasses = {
    none: '',
    sm: 'shadow-brutal-xs',
    md: 'shadow-brutal-sm',
    lg: 'shadow-brutal',
  };

  const hoverClasses = hoverable
    ? 'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal cursor-pointer'
    : '';

  const variantClasses: Record<CardVariant, string> = {
    default: 'bg-brand-paper text-brand-dark',
    paper: 'bg-brand-paper text-brand-dark',
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
        <div className="border-b-2 border-brand-dark px-3 sm:px-4 py-1.5 sm:py-2 bg-black/[0.04] flex items-center justify-between font-mono text-[11px] sm:text-xs tracking-wider">
          {headerBar}
        </div>
      )}
      <div className={headerBar ? 'p-3.5 sm:p-5' : 'p-4 sm:p-6'}>{children}</div>
    </div>
  );
};
