import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  LayoutDashboard,
  ListTodo,
  FileText,
  FileCheck,
  Calendar,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  X,
  Sparkles,
  BookOpen,
  Compass,
  TrendingUp,
  BookMarked,
  HelpCircle,
  Megaphone,
  Bell,
  GraduationCap,
  UserCheck,
  Users,
  BarChart3,
  CreditCard,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Menu,
} from 'lucide-react';
import { MobileNavDrawer } from '../components/common/MobileNavDrawer';
import { getUnreadNotificationCount } from '../lib/notifications';

export const DashboardLayout: React.FC = () => {
  const { user, profile, role, poraplanId, signOut, connectEmail } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [emailToLink, setEmailToLink] = useState('');
  const [isLinkingEmail, setIsLinkingEmail] = useState(false);
  const [emailLinkMessage, setEmailLinkMessage] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState<number>(0);

  // Close profile dropdown on outside click or Escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileDropdownOpen(false);
      }
    };
    if (profileDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileDropdownOpen]);

  // Close profile dropdown when route changes
  useEffect(() => {
    setProfileDropdownOpen(false);
  }, [location.pathname]);

  // Handle Escape key and body scroll lock for profileModalOpen
  useEffect(() => {
    if (!profileModalOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLinkingEmail) {
        setProfileModalOpen(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileModalOpen, isLinkingEmail]);

  // Poll/fetch unread notification count for active user (Student, Mentor, Admin)
  React.useEffect(() => {
    let isMounted = true;
    const fetchUnread = async () => {
      const activeUserId = profile?.id || user?.id;
      if (activeUserId) {
        const { count } = await getUnreadNotificationCount(activeUserId);
        if (isMounted) setUnreadNotifCount(count || 0);
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    const handleUpdate = () => {
      fetchUnread();
    };
    window.addEventListener('notifications-updated', handleUpdate);
    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('notifications-updated', handleUpdate);
    };
  }, [profile?.id, user?.id, role, location.pathname]);

  const handleLinkEmail = async () => {
    if (!emailToLink.trim()) return;
    setIsLinkingEmail(true);
    setEmailLinkMessage(null);
    const { error } = await connectEmail(emailToLink.trim());
    if (error) {
      setEmailLinkMessage(`Error: ${error.message}`);
    } else {
      setEmailLinkMessage('Personal email successfully linked!');
      setEmailToLink('');
    }
    setIsLinkingEmail(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const isStudent = role === 'student';
  const isMentor = role === 'mentor';
  const isAdmin = role === 'admin';

  const roleLabel = isStudent ? 'Student' : isMentor ? 'Mentor' : isAdmin ? 'Administrator' : 'Scholar';
  const roleBadgeVariant = isStudent ? 'teal' : isMentor ? 'gold' : 'navy';
  const userDisplayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Scholar';
  const userInitials = (userDisplayName || 'P')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Desktop sidebar navigation links
  const studentNavItems = [
    { label: 'Overview', shortLabel: 'Home', to: '/student/dashboard', icon: LayoutDashboard },
    { label: "Today's Tasks", shortLabel: 'Tasks', to: '/student/tasks', icon: ListTodo },
    { label: 'Doubts Desk', shortLabel: 'Doubts', to: '/student/doubts', icon: HelpCircle },
    { label: 'Assignments', shortLabel: 'Practice', to: '/student/assignments', icon: FileText },
    { label: 'Study Plans', shortLabel: 'Plans', to: '/student/plans', icon: Compass },
    { label: 'Academic Library', shortLabel: 'Library', to: '/student/library', icon: BookMarked },
    { label: 'Academic Progress', shortLabel: 'Progress', to: '/student/progress', icon: TrendingUp },
    { label: 'Academic Reports', shortLabel: 'Reports', to: '/student/reports', icon: BarChart3 },
    { label: 'Announcements', shortLabel: 'Notices', to: '/student/announcements', icon: Megaphone },
    { label: 'Billing & Payments', shortLabel: 'Billing', to: '/student/billing', icon: CreditCard },
    { label: 'Subjects', shortLabel: 'Subjects', to: '/student/subjects', icon: BookOpen },
  ];

  const mentorNavItems = [
    { label: 'Overview', shortLabel: 'Home', to: '/mentor/dashboard', icon: LayoutDashboard },
    { label: 'Review Queue', shortLabel: 'Reviews', to: '/mentor/reviews', icon: FileCheck },
    { label: 'Doubts Desk', shortLabel: 'Doubts', to: '/mentor/doubts', icon: HelpCircle },
    { label: 'Tasks Management', shortLabel: 'Tasks', to: '/mentor/tasks', icon: ListTodo },
    { label: 'Assignments', shortLabel: 'Practice', to: '/mentor/assignments', icon: FileText },
    { label: 'Study Plans', shortLabel: 'Plans', to: '/mentor/plans', icon: Compass },
    { label: 'Evaluations', shortLabel: 'Eval', to: '/mentor/evaluations', icon: Calendar },
    { label: 'Student Progress', shortLabel: 'Progress', to: '/mentor/progress', icon: TrendingUp },
    { label: 'Scholar Reports', shortLabel: 'Reports', to: '/mentor/reports', icon: BarChart3 },
    { label: 'Resources', shortLabel: 'Resources', to: '/mentor/resources', icon: BookMarked },
    { label: 'Announcements', shortLabel: 'Notices', to: '/mentor/announcements', icon: Megaphone },
    { label: 'Payout History', shortLabel: 'Payouts', to: '/mentor/payouts', icon: CreditCard },
    { label: 'Subjects', shortLabel: 'Subjects', to: '/mentor/subjects', icon: BookOpen },
  ];

  const adminNavItems = [
    { label: 'Admin Console', shortLabel: 'Admin', to: '/admin/dashboard', icon: ShieldCheck },
    { label: 'Programs & Cohorts', shortLabel: 'Programs', to: '/admin/programs', icon: GraduationCap },
    { label: 'Enrollments Desk', shortLabel: 'Enrollments', to: '/admin/enrollments', icon: UserCheck },
    { label: 'Mentor Allocations', shortLabel: 'Mentors', to: '/admin/mentor-assignments', icon: Users },
    { label: 'Billing Management', shortLabel: 'Billing', to: '/admin/billing', icon: CreditCard },
    { label: 'User Directory', shortLabel: 'Users', to: '/admin/users', icon: Users },
    { label: 'Academic Reports', shortLabel: 'Reports', to: '/admin/reports', icon: BarChart3 },
    { label: 'System Alerts', shortLabel: 'Alerts', to: '/admin/notifications', icon: Bell, badgeCount: unreadNotifCount },
  ];

  // Mobile navigation: 4 primary essential daily destinations per role
  const mobileStudentNavItems = [
    { label: 'Home', to: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', to: '/student/tasks', icon: ListTodo },
    { label: 'Doubts', to: '/student/doubts', icon: HelpCircle },
    { label: 'Plans', to: '/student/plans', icon: Compass },
  ];

  const mobileMentorNavItems = [
    { label: 'Home', to: '/mentor/dashboard', icon: LayoutDashboard },
    { label: 'Reviews', to: '/mentor/reviews', icon: FileCheck },
    { label: 'Doubts', to: '/mentor/doubts', icon: HelpCircle },
    { label: 'Tasks', to: '/mentor/tasks', icon: ListTodo },
  ];

  const mobileAdminNavItems = [
    { label: 'Admin', to: '/admin/dashboard', icon: ShieldCheck },
    { label: 'Enrollments', to: '/admin/enrollments', icon: UserCheck },
    { label: 'Mentors', to: '/admin/mentor-assignments', icon: Users },
    { label: 'Billing', to: '/admin/billing', icon: CreditCard },
  ];

  const navItems = isStudent ? studentNavItems : isMentor ? mentorNavItems : adminNavItems;
  const mobileNavItems = isStudent ? mobileStudentNavItems : isMentor ? mobileMentorNavItems : mobileAdminNavItems;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-dark flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-brand-header border-b-2 border-brand-dark px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-sm print:hidden">
        {/* Brand identity & Role Indicator */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            to={isStudent ? '/student/dashboard' : isMentor ? '/mentor/dashboard' : '/admin/dashboard'}
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            aria-label="PoraPlan Workspace"
          >
            <div className="h-8 w-8 sm:h-9 sm:w-9 p-0.5 bg-brand-paper border-2 border-brand-dark flex items-center justify-center shadow-brutal-xs group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0">
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
            <div className="flex flex-col">
              <span className="font-heading font-extrabold text-base sm:text-lg text-brand-navy tracking-tight leading-none">
                PoraPlan
              </span>
              <span className="font-mono text-[10px] text-brand-muted sm:hidden leading-none mt-0.5">
                {roleLabel}
              </span>
            </div>
          </Link>

          <Badge variant={roleBadgeVariant} size="sm" className="hidden sm:inline-flex">
            {roleLabel}
          </Badge>
        </div>

        {/* User profile controls & Dropdown Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Center Bell */}
          <Link
            to={isMentor ? '/mentor/notifications' : isAdmin ? '/admin/notifications' : '/student/notifications'}
            className="relative p-2 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform flex items-center justify-center text-brand-dark hover:text-brand-navy"
            title="Notifications Center"
            aria-label={`Notifications Center, ${unreadNotifCount} unread`}
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-brand-coral text-white font-mono font-bold text-[10px] leading-tight flex items-center justify-center border border-brand-dark shadow-xs">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </Link>

          {/* Profile & Account Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-expanded={profileDropdownOpen}
              aria-haspopup="menu"
              aria-label="User account and profile menu"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 bg-brand-navy text-brand-bg font-heading font-extrabold text-xs flex items-center justify-center border border-brand-dark overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="hidden sm:flex flex-col pr-1">
                <span className="text-xs font-bold font-sans text-brand-dark leading-none truncate max-w-[120px]">
                  {userDisplayName}
                </span>
                <span className="text-[10px] font-mono text-brand-teal font-bold leading-tight mt-0.5 truncate max-w-[120px]">
                  {poraplanId || user?.email}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-brand-dark/70 transition-transform ${
                  profileDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                className="absolute right-0 mt-2 w-64 sm:w-72 bg-brand-paper dark:bg-brand-paper-tint border-2 border-brand-dark shadow-brutal-md py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Account Details Header */}
                <div className="px-3.5 py-2 border-b-2 border-brand-dark/15 mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-brand-navy text-brand-bg font-heading font-extrabold text-sm flex items-center justify-center border border-brand-dark overflow-hidden shrink-0">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-heading font-extrabold text-brand-navy truncate">
                        {userDisplayName}
                      </p>
                      <p className="text-[10px] font-mono text-brand-teal font-bold truncate">
                        {poraplanId || user?.email}
                      </p>
                      <div className="mt-1">
                        <Badge variant={roleBadgeVariant} size="sm">
                          {roleLabel}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Destination: Academic Profile */}
                <Link
                  to="/profile"
                  role="menuitem"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-heading font-bold text-brand-dark hover:bg-brand-paper-tint transition-colors"
                >
                  <UserIcon className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                  <span className="flex-1">My Academic Profile</span>
                </Link>

                {/* Role Specific Destination */}
                {isStudent && (
                  <Link
                    to="/student/billing"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-heading font-bold text-brand-dark hover:bg-brand-paper-tint transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                    <span className="flex-1">Billing & Payments</span>
                  </Link>
                )}
                {isMentor && (
                  <Link
                    to="/mentor/payouts"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-heading font-bold text-brand-dark hover:bg-brand-paper-tint transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                    <span className="flex-1">Payout History</span>
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    to="/admin/billing"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-heading font-bold text-brand-dark hover:bg-brand-paper-tint transition-colors"
                  >
                    <CreditCard className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                    <span className="flex-1">Billing Management</span>
                  </Link>
                )}

                {/* Quick Dossier Modal Trigger */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    setProfileModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-heading font-bold text-brand-dark hover:bg-brand-paper-tint transition-colors text-left"
                >
                  <Sparkles className="w-4 h-4 text-brand-gold shrink-0 stroke-[2.2]" />
                  <span className="flex-1">Identity & Email Details</span>
                </button>

                <div className="border-t-2 border-brand-dark/15 my-1.5" />

                {/* Theme Selector Section */}
                <div className="px-3.5 py-2" role="none">
                  <span className="font-mono text-[9px] uppercase font-bold text-brand-muted tracking-wider block mb-1.5">
                    Theme
                  </span>
                  <div
                    role="radiogroup"
                    aria-label="Theme mode"
                    className="grid grid-cols-3 gap-1 bg-brand-paper-tint p-1 border border-brand-dark/20"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={theme === 'light'}
                      aria-label="Light mode"
                      title="Light mode"
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-1 py-1 px-1.5 text-[11px] font-heading font-bold transition-all border ${
                        theme === 'light'
                          ? 'bg-brand-paper text-brand-navy border-brand-dark shadow-brutal-xs'
                          : 'border-transparent text-brand-muted hover:text-brand-dark'
                      }`}
                    >
                      <Sun className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={theme === 'dark'}
                      aria-label="Dark mode"
                      title="Dark mode"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-1 py-1 px-1.5 text-[11px] font-heading font-bold transition-all border ${
                        theme === 'dark'
                          ? 'bg-brand-paper text-brand-navy border-brand-dark shadow-brutal-xs'
                          : 'border-transparent text-brand-muted hover:text-brand-dark'
                      }`}
                    >
                      <Moon className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />
                      <span>Dark</span>
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={theme === 'system'}
                      aria-label="System mode"
                      title="System mode"
                      onClick={() => setTheme('system')}
                      className={`flex items-center justify-center gap-1 py-1 px-1.5 text-[11px] font-heading font-bold transition-all border ${
                        theme === 'system'
                          ? 'bg-brand-paper text-brand-navy border-brand-dark shadow-brutal-xs'
                          : 'border-transparent text-brand-muted hover:text-brand-dark'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5 shrink-0 stroke-[2.2]" />
                      <span>Auto</span>
                    </button>
                  </div>
                </div>

                <div className="border-t-2 border-brand-dark/15 my-1.5" />

                {/* Sign Out Action inside Dropdown */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setProfileDropdownOpen(false);
                    handleSignOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-heading font-bold text-red-700 hover:bg-red-50 hover:text-red-800 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-red-600 shrink-0 stroke-[2.2]" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Responsive Shell */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (md: 768px+) */}
        <aside className="hidden md:flex flex-col w-60 lg:w-64 border-r-2 border-brand-dark bg-brand-sidebar shrink-0 justify-between print:hidden">
          <div className="p-4 space-y-4">
            <div className="border-b-2 border-brand-dark/20 pb-3">
              <span className="font-mono text-[10px] uppercase font-bold text-brand-muted tracking-wider block">
                NAVIGATION
              </span>
              <span className="text-xs font-heading font-bold text-brand-navy">
                {roleLabel} Menu
              </span>
            </div>

            <nav className="space-y-1.5" aria-label="Sidebar Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isExact = location.pathname === item.to || (location.pathname + location.hash) === item.to;
                const isSubpath = item.to.includes('/subjects') && location.pathname.startsWith(item.to);
                const isActive = isExact || isSubpath;
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-3 py-2 text-xs font-heading font-bold border-2 transition-all ${
                      isActive
                        ? 'border-brand-dark bg-brand-teal-light text-brand-navy shadow-brutal-xs'
                        : 'border-transparent text-brand-dark/80 hover:border-brand-dark hover:bg-brand-paper-tint hover:text-brand-dark'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-brand-navy shrink-0 stroke-[2.2]" />
                    <span>{item.label}</span>
                    {Boolean((item as any).badgeCount && (item as any).badgeCount > 0) && (
                      <span className="ml-auto px-1.5 py-0.2 text-[9px] font-mono font-bold bg-brand-coral text-white border border-brand-dark">
                        {(item as any).badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer User Card */}
          <div className="p-3.5 border-t-2 border-brand-dark bg-brand-paper-tint">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-gold border-2 border-brand-dark font-mono font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-heading font-extrabold text-brand-navy truncate">
                  {userDisplayName}
                </p>
                <p className="text-[10px] font-mono text-brand-muted truncate">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Outlet Canvas */}
        <main
          className="flex-1 min-w-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8"
          id="workspace-content"
        >
          <Outlet />

          {/* Clean App Footer */}
          <footer className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-2 text-center print:hidden">
            <p className="font-mono text-[10px] text-brand-muted">
              PoraPlan Study System • You study. We organize how, what and when.
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px, 4 primary destinations + More button) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-header border-t-2 border-brand-dark flex items-stretch justify-around shadow-brutal-xs print:hidden pb-[env(safe-area-inset-bottom,0px)] h-[calc(3.5rem+env(safe-area-inset-bottom,0px))]"
        aria-label="Mobile Bottom Navigation"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isExact =
            location.pathname === item.to || location.pathname + location.hash === item.to;
          const isSubpath =
            item.to.includes('/subjects') && location.pathname.startsWith(item.to);
          const isActive = isExact || isSubpath;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors border-r border-brand-dark/20 relative ${
                isActive
                  ? 'bg-brand-teal-light text-brand-navy font-bold'
                  : 'text-brand-muted hover:text-brand-dark'
              }`}
            >
              <div className="relative">
                <Icon className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-[10px] font-mono mt-0.5 leading-none truncate max-w-[70px]">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* 5th Mobile Navigation Item: More Button (Triggers MobileNavDrawer) */}
        {(() => {
          const isPrimaryActive = mobileNavItems.some((item) => {
            const isExact =
              location.pathname === item.to || location.pathname + location.hash === item.to;
            const isSubpath =
              item.to.includes('/subjects') && location.pathname.startsWith(item.to);
            return isExact || isSubpath;
          });
          const isMoreActive = !isPrimaryActive || mobileDrawerOpen;

          return (
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((prev) => !prev)}
              aria-expanded={mobileDrawerOpen}
              aria-haspopup="dialog"
              aria-label="More navigation options"
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors relative cursor-pointer ${
                isMoreActive
                  ? 'bg-brand-teal-light text-brand-navy font-bold'
                  : 'text-brand-muted hover:text-brand-dark'
              }`}
            >
              <div className="relative">
                <Menu className="w-4 h-4 stroke-[2.2]" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 bg-brand-coral rounded-full border border-brand-dark" />
                )}
              </div>
              <span className="text-[10px] font-mono mt-0.5 leading-none">
                More
              </span>
            </button>
          );
        })()}
      </nav>

      {/* Role-Aware Mobile Navigation Slide-out Drawer (< 768px) */}
      <MobileNavDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        role={role}
        userDisplayName={userDisplayName}
        userInitials={userInitials}
        userEmail={user?.email}
        poraplanId={poraplanId || profile?.poraplan_id}
        avatarUrl={profile?.avatar_url}
        roleLabel={roleLabel}
        roleBadgeVariant={roleBadgeVariant}
        unreadNotifCount={unreadNotifCount}
        onOpenProfileModal={() => setProfileModalOpen(true)}
        onSignOut={handleSignOut}
      />

      {/* Profile Details Modal Dossier */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-brand-dark/60 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Academic Profile & Account Dossier"
          aria-labelledby="profile-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLinkingEmail) {
              setProfileModalOpen(false);
            }
          }}
        >
          <div
            className="w-full max-w-md max-h-[85dvh] flex flex-col bg-brand-paper dark:bg-brand-paper-tint border-3 border-brand-dark shadow-brutal-lg p-4 sm:p-6 animate-in fade-in zoom-in-95 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                <h2 id="profile-modal-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  My Profile
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-2 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
                aria-label="Close Profile"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 py-3 space-y-3 font-mono text-xs pr-1">
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">PoraPlan ID</span>
                <span className="font-bold text-brand-navy text-sm font-mono">
                  {poraplanId || profile?.poraplan_id || '-'}
                </span>
              </div>

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">Full Name</span>
                <span className="font-bold text-brand-dark text-sm font-sans">{userDisplayName}</span>
              </div>

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1.5">
                <span className="text-[10px] text-brand-muted uppercase block">Associated Email</span>
                {profile?.linked_email ? (
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-brand-dark break-all">{profile.linked_email}</span>
                    <Badge variant="teal" size="sm">LINKED</Badge>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs text-brand-muted block font-sans">
                      No personal email linked yet.
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="email"
                        value={emailToLink}
                        onChange={(e) => setEmailToLink(e.target.value)}
                        placeholder="your.email@example.com"
                        className="flex-1 px-2.5 py-1 text-xs border border-brand-dark bg-brand-paper font-sans"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={handleLinkEmail}
                        disabled={isLinkingEmail}
                      >
                        {isLinkingEmail ? 'Linking...' : 'Connect'}
                      </Button>
                    </div>
                  </div>
                )}
                {emailLinkMessage && (
                  <p className="text-[11px] font-sans font-bold text-emerald-800">{emailLinkMessage}</p>
                )}
                <span className="text-[10px] text-brand-muted block font-sans mt-0.5">
                  Used for Google sign-in and password recovery.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block">Role</span>
                  <Badge variant={roleBadgeVariant} size="sm">
                    {roleLabel}
                  </Badge>
                </div>

                <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                  <span className="text-[10px] text-brand-muted uppercase block">Status</span>
                  <span className="font-bold text-brand-teal flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-brand-teal inline-block" />
                    {profile?.status === 'not_activated' ? 'Activating' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-3 shrink-0 flex flex-col gap-2 border-t-2 border-brand-dark">
              <Button
                variant="primary"
                size="sm"
                to="/profile"
                onClick={() => setProfileModalOpen(false)}
                className="w-full"
                leftIcon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Open Full Academic Profile
              </Button>
              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setProfileModalOpen(false)}
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  leftIcon={<LogOut className="w-3.5 h-3.5" />}
                  className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
