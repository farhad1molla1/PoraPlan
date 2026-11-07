import React from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'gold' | 'teal' | 'navy' | 'paper' | 'muted' | 'danger';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gold',
  size = 'md',
  className,
}) => {
  const baseClasses =
    'inline-flex items-center gap-1 font-mono uppercase font-bold tracking-wider border sm:border-2 border-brand-dark select-none shadow-none sm:shadow-brutal-xs motion-reduce:transition-none';

  const sizeClasses = {
    sm: 'text-[9px] sm:text-[10px] px-1.5 py-0.2 sm:py-0.5 leading-tight',
    md: 'text-[10px] sm:text-xs px-2 py-0.5 sm:px-2.5 sm:py-1 leading-tight sm:leading-normal',
  };

  const variantClasses: Record<BadgeVariant, string> = {
    gold: 'bg-brand-gold text-brand-dark',
    teal: 'bg-brand-teal text-white',
    navy: 'bg-brand-navy text-brand-bg',
    paper: 'bg-brand-paper text-brand-dark',
    muted: 'bg-brand-paper-tint text-brand-muted',
    danger: 'bg-red-600 text-white',
  };

  return (
    <span className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}>
      {children}
    </span>
  );
};
