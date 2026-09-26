import React from 'react';
import { cn } from '../../lib/utils';
import { Badge } from './Badge';

export interface SectionHeadingProps {
  eyebrow?: string;
  badge?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  badge,
  title,
  description,
  align = 'left',
  className,
}) => {
  return (
    <div
      className={cn(
        'mb-6 sm:mb-10 md:mb-12',
        align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-2xl',
        className
      )}
    >
      {(eyebrow || badge) && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-2 mb-2 sm:mb-2.5',
            align === 'center' ? 'justify-center' : 'justify-start'
          )}
        >
          {badge && <Badge variant="teal" size="sm">{badge}</Badge>}
          {eyebrow && (
            <span className="font-mono text-[10px] sm:text-xs uppercase tracking-wider text-brand-muted font-bold">
              {eyebrow}
            </span>
          )}
        </div>
      )}

      <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-brand-navy tracking-tight leading-snug">
        {title}
      </h2>

      {description && (
        <p className="mt-2 sm:mt-2.5 text-xs sm:text-sm md:text-base text-brand-dark/85 leading-relaxed font-normal">
          {description}
        </p>
      )}
    </div>
  );
};
