import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { ButtonVariant, ButtonSize } from '../../types';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  to?: string;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  to,
  fullWidth = false,
  leftIcon,
  rightIcon,
  className,
  disabled,
  ...props
}) => {
  const baseClasses = 
    'inline-flex items-center justify-center font-bold font-sans tracking-tight transition-all duration-100 ease-out border border-brand-dark sm:border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 dark:focus-visible:ring-offset-surface-canvas disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:shadow-none disabled:transform-none select-none rounded-semantic-sm sm:rounded-none text-center motion-reduce:transition-none motion-reduce:hover:transform-none motion-reduce:active:transform-none';

  const sizeClasses: Record<ButtonSize, string> = {
    sm: 'text-[11px] sm:text-xs px-2.5 py-1 sm:px-3 sm:py-1.5 gap-1 sm:gap-1.5 shadow-micro sm:shadow-brutal-xs sm:hover:-translate-x-0.5 sm:hover:-translate-y-0.5 active:translate-y-[1px] sm:active:translate-x-0.5 sm:active:translate-y-0.5 active:shadow-none min-h-[34px] sm:min-h-0',
    md: 'text-xs sm:text-sm px-3 py-1.5 sm:px-4.5 sm:py-2.5 gap-1.5 sm:gap-2 shadow-micro sm:shadow-brutal-sm sm:hover:-translate-x-0.5 sm:hover:-translate-y-0.5 active:translate-y-[1px] sm:active:translate-x-0.5 sm:active:translate-y-0.5 active:shadow-none min-h-[38px] sm:min-h-0',
    lg: 'text-xs sm:text-base px-3.5 py-2 sm:px-5 sm:py-3 gap-2 shadow-tactile sm:shadow-brutal sm:hover:-translate-x-0.5 sm:hover:-translate-y-0.5 active:translate-y-[1.5px] sm:active:translate-x-0.5 sm:active:translate-y-0.5 active:shadow-none min-h-[42px] sm:min-h-0',
  };

  const variantClasses: Record<ButtonVariant, string> = {
    primary: 'bg-brand-gold text-brand-dark hover:bg-[#e89a1c] dark:hover:bg-brand-gold/90',
    secondary: 'bg-brand-teal text-white hover:bg-[#0995a1] dark:hover:bg-brand-teal/90',
    dark: 'bg-brand-navy text-brand-bg hover:bg-[#062039] dark:bg-surface-elevated dark:text-brand-navy dark:hover:bg-surface-inset',
    outline: 'bg-surface-card text-brand-dark hover:bg-surface-inset dark:text-brand-navy',
    ghost: 'bg-transparent border-transparent shadow-none hover:bg-black/5 dark:hover:bg-white/5 hover:border-brand-dark hover:shadow-micro sm:hover:shadow-brutal-xs',
  };

  const combinedClasses = cn(
    baseClasses,
    sizeClasses[size],
    variantClasses[variant],
    fullWidth ? 'w-full' : '',
    className
  );

  if (to && !disabled) {
    return (
      <Link to={to} className={combinedClasses}>
        {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
      </Link>
    );
  }

  return (
    <button className={combinedClasses} disabled={disabled} {...props}>
      {leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </button>
  );
};
