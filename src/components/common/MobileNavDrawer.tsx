import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { Badge } from './Badge';
import type { BadgeVariant } from './Badge';
import {
  X,
  User as UserIcon,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  FileText,
  BookMarked,
  TrendingUp,
  BarChart3,
  Megaphone,
  CreditCard,
  BookOpen,
  Calendar,
  GraduationCap,
  Users,
  Bell,
  Compass,
} from 'lucide-react';

export interface MobileDrawerNavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  role: 'student' | 'mentor' | 'admin' | string | null;
  userDisplayName: string;
  userInitials: string;
  userEmail?: string;
  poraplanId?: string | null;
  avatarUrl?: string | null;
  roleLabel: string;
  roleBadgeVariant: BadgeVariant;
  unreadNotifCount: number;
  onOpenProfileModal: () => void;
  onSignOut: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  role,
  userDisplayName,
  userInitials,
  userEmail,
  poraplanId,
  avatarUrl,
  roleLabel,
  roleBadgeVariant,
  unreadNotifCount,
  onOpenProfileModal,
  onSignOut,
}) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();

  // Close drawer on route change
  useEffect(() => {
    if (isOpen) {
      onClose();
    }
  }, [location.pathname, location.search, location.hash]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock background scroll when drawer is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Auto-close if screen expands to desktop width (>= 768px)
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        onClose();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Remaining role-specific navigation destinations (excluding the 4 primary bottom items)
  const studentDrawerItems: MobileDrawerNavItem[] = [
    { label: 'Assignments', to: '/student/assignments', icon: FileText },
    { label: 'Academic Library', to: '/student/library', icon: BookMarked },
    { label: 'Academic Progress', to: '/student/progress', icon: TrendingUp },
    { label: 'Academic Reports', to: '/student/reports', icon: BarChart3 },
    { label: 'Announcements', to: '/student/announcements', icon: Megaphone },
    { label: 'Billing & Payments', to: '/student/billing', icon: CreditCard },
    { label: 'Subjects', to: '/student/subjects', icon: BookOpen },
    {
      label: 'Notifications Center',
      to: '/student/notifications',
      icon: Bell,
      badgeCount: unreadNotifCount,
    },
  ];

  const mentorDrawerItems: MobileDrawerNavItem[] = [
    { label: 'Assignments', to: '/mentor/assignments', icon: FileText },
    { label: 'Study Plans', to: '/mentor/plans', icon: Compass },
    { label: 'Evaluations', to: '/mentor/evaluations', icon: Calendar },
    { label: 'Student Progress', to: '/mentor/progress', icon: TrendingUp },
    { label: 'Scholar Reports', to: '/mentor/reports', icon: BarChart3 },
    { label: 'Resources', to: '/mentor/resources', icon: BookMarked },
    { label: 'Announcements', to: '/mentor/announcements', icon: Megaphone },
    { label: 'Payout History', to: '/mentor/payouts', icon: CreditCard },
    { label: 'Subjects', to: '/mentor/subjects', icon: BookOpen },
    {
      label: 'Notifications Center',
      to: '/mentor/notifications',
      icon: Bell,
      badgeCount: unreadNotifCount,
    },
  ];

  const adminDrawerItems: MobileDrawerNavItem[] = [
    { label: 'Programs & Cohorts', to: '/admin/programs', icon: GraduationCap },
    { label: 'User Directory', to: '/admin/users', icon: Users },
    { label: 'Academic Reports', to: '/admin/reports', icon: BarChart3 },
    {
      label: 'System Alerts',
      to: '/admin/notifications',
      icon: Bell,
      badgeCount: unreadNotifCount,
    },
  ];

  const drawerNavItems: MobileDrawerNavItem[] =
    role === 'student'
      ? studentDrawerItems
      : role === 'mentor'
      ? mentorDrawerItems
      : adminDrawerItems;

  return (
    <div
      className="md:hidden fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={`${roleLabel} Navigation Menu`}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-brand-dark/60 backdrop-blur-xs transition-opacity duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-out Drawer Panel */}
      <aside className="relative w-[88vw] max-w-[340px] h-full bg-surface-card border-l-2 border-brand-dark shadow-elevated flex flex-col z-10 overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-3.5 sm:p-4 border-b border-brand-dark/20 flex items-center justify-between bg-surface-inset shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 p-0.5 bg-surface-card border border-brand-dark rounded-semantic-sm flex items-center justify-center shadow-micro shrink-0">
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
            <span className="font-heading font-extrabold text-sm text-brand-navy tracking-tight">
              {roleLabel} Menu
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 flex items-center justify-center border border-brand-dark bg-surface-card hover:bg-surface-inset shadow-micro rounded-semantic-sm text-brand-dark cursor-pointer transition-transform active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Section 1: User Identity Card */}
          <div className="p-3 border border-brand-dark bg-surface-card rounded-semantic-sm shadow-micro">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-brand-navy text-brand-bg font-heading font-extrabold text-xs flex items-center justify-center border border-brand-dark rounded-semantic-sm overflow-hidden shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-heading font-extrabold text-brand-navy truncate">
                  {userDisplayName}
                </p>
                <p className="text-[10px] font-mono text-brand-teal font-bold truncate">
                  {poraplanId || userEmail}
                </p>
                <div className="mt-1">
                  <Badge variant={roleBadgeVariant} size="sm">
                    {roleLabel}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Remaining Workspace Navigation */}
          <div>
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted tracking-wider block mb-2 px-1">
              Workspace Navigation
            </span>
            <nav className="space-y-1" aria-label="Mobile Drawer Navigation">
              {drawerNavItems.map((item) => {
                const Icon = item.icon;
                const isExact =
                  location.pathname === item.to ||
                  location.pathname + location.hash === item.to;
                const isSubpath =
                  item.to.includes('/subjects') && location.pathname.startsWith(item.to);
                const isActive = isExact || isSubpath;

                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-heading font-bold border-2 transition-all rounded-semantic-sm ${
                      isActive
                        ? 'border-brand-dark bg-brand-teal-light/70 dark:bg-surface-inset text-brand-navy shadow-micro font-bold'
                        : 'border-transparent text-brand-dark/80 hover:border-brand-dark hover:bg-surface-inset hover:text-brand-dark'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {Boolean(item.badgeCount && item.badgeCount > 0) && (
                      <span className="px-1.5 py-0.2 text-[9px] font-mono font-bold bg-brand-coral text-white border border-brand-dark">
                        {item.badgeCount! > 99 ? '99+' : item.badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Section 3: Account & System Actions */}
          <div className="pt-2 border-t border-brand-dark/20 space-y-3">
            <span className="font-mono text-[10px] uppercase font-bold text-brand-muted tracking-wider block px-1">
              Account & Preferences
            </span>

            <div className="space-y-1">
              <Link
                to="/profile"
                onClick={onClose}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-heading font-bold border-2 border-transparent hover:border-brand-dark hover:bg-surface-inset text-brand-dark rounded-semantic-sm transition-all"
              >
                <UserIcon className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                <span className="flex-1 truncate">My Academic Profile</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenProfileModal();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-heading font-bold border-2 border-transparent hover:border-brand-dark hover:bg-surface-inset text-brand-dark rounded-semantic-sm transition-all text-left cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-brand-gold shrink-0 stroke-[2.2]" />
                <span className="flex-1 truncate">Identity & Email Details</span>
              </button>
            </div>

            {/* Theme Selector */}
            <div className="px-1 pt-1">
              <span className="font-mono text-[9px] uppercase font-bold text-brand-muted tracking-wider block mb-1.5">
                Theme Mode
              </span>
              <div
                role="radiogroup"
                aria-label="Theme mode"
                className="grid grid-cols-3 gap-1.5 bg-surface-inset p-1 border border-brand-dark/20 rounded-semantic-sm"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'light'}
                  aria-label="Light mode"
                  title="Light mode"
                  onClick={() => setTheme('light')}
                  className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-heading font-bold transition-all border rounded-semantic-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                    theme === 'light'
                      ? 'bg-surface-card text-brand-navy border-brand-dark shadow-micro font-extrabold'
                      : 'border-transparent text-brand-muted hover:text-brand-dark hover:bg-surface-card/50'
                  }`}
                >
                  <Sun className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'dark'}
                  aria-label="Dark mode"
                  title="Dark mode"
                  onClick={() => setTheme('dark')}
                  className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-heading font-bold transition-all border rounded-semantic-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                    theme === 'dark'
                      ? 'bg-surface-card text-brand-navy border-brand-dark shadow-micro font-extrabold'
                      : 'border-transparent text-brand-muted hover:text-brand-dark hover:bg-surface-card/50'
                  }`}
                >
                  <Moon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={theme === 'system'}
                  aria-label="System mode"
                  title="System mode"
                  onClick={() => setTheme('system')}
                  className={`min-h-[44px] flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-heading font-bold transition-all border rounded-semantic-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal ${
                    theme === 'system'
                      ? 'bg-surface-card text-brand-navy border-brand-dark shadow-micro font-extrabold'
                      : 'border-transparent text-brand-muted hover:text-brand-dark hover:bg-surface-card/50'
                  }`}
                >
                  <Monitor className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span>Auto</span>
                </button>
              </div>
            </div>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onSignOut();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-heading font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 border border-transparent hover:border-red-600 rounded-semantic-sm transition-all text-left cursor-pointer active:translate-y-[1px]"
            >
              <LogOut className="w-4 h-4 text-red-600 shrink-0 stroke-[2.2]" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {/* Drawer Footer with Safe-Area Inset */}
        <div
          className="p-3 border-t border-brand-dark/20 bg-surface-inset text-center shrink-0"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <p className="font-mono text-[9px] text-brand-muted">
            PoraPlan Study System
          </p>
        </div>
      </aside>
    </div>
  );
};
