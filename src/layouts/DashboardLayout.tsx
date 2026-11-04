import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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
  ClipboardList,
  UserCheck,
  Users,
  BarChart3,
  CreditCard,
  ChevronDown,
} from 'lucide-react';
import { getUnreadNotificationCount } from '../lib/notifications';

export const DashboardLayout: React.FC = () => {
  const { user, profile, role, poraplanId, signOut, connectEmail } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
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
  const rolePillClass = isStudent
    ? 'bg-brand-teal/10 text-brand-navy border border-brand-teal/30'
    : isMentor
    ? 'bg-brand-gold/15 text-amber-900 border border-brand-gold/40'
    : 'bg-brand-navy/10 text-brand-navy border border-brand-navy/20';

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
    { label: 'Applications Desk', shortLabel: 'Apps', to: '/admin/applications', icon: ClipboardList },
    { label: 'System Alerts', shortLabel: 'Alerts', to: '/admin/notifications', icon: Bell, badgeCount: unreadNotifCount },
  ];

  // Mobile navigation: top essential daily actions
  const mobileStudentNavItems = [
    { label: 'Home', to: '/student/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', to: '/student/tasks', icon: ListTodo },
    { label: 'Doubts', to: '/student/doubts', icon: HelpCircle },
    { label: 'Plans', to: '/student/plans', icon: Compass },
    { label: 'Alerts', to: '/student/notifications', icon: Bell, badgeCount: unreadNotifCount },
  ];

  const mobileMentorNavItems = [
    { label: 'Home', to: '/mentor/dashboard', icon: LayoutDashboard },
    { label: 'Reviews', to: '/mentor/reviews', icon: FileCheck },
    { label: 'Doubts', to: '/mentor/doubts', icon: HelpCircle },
    { label: 'Tasks', to: '/mentor/tasks', icon: ListTodo },
    { label: 'Alerts', to: '/mentor/notifications', icon: Bell, badgeCount: unreadNotifCount },
  ];

  const mobileAdminNavItems = [
    { label: 'Admin', to: '/admin/dashboard', icon: ShieldCheck },
    { label: 'Enroll', to: '/admin/enrollments', icon: UserCheck },
    { label: 'Mentors', to: '/admin/mentor-assignments', icon: Users },
    { label: 'Billing', to: '/admin/billing', icon: CreditCard },
    { label: 'Alerts', to: '/admin/notifications', icon: Bell, badgeCount: unreadNotifCount },
  ];

  const navItems = isStudent ? studentNavItems : isMentor ? mentorNavItems : adminNavItems;
  const mobileNavItems = isStudent ? mobileStudentNavItems : isMentor ? mobileMentorNavItems : mobileAdminNavItems;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-dark flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-brand-dark/15 px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between print:hidden">
        {/* Brand identity & Role Indicator */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          <Link
            to={isStudent ? '/student/dashboard' : isMentor ? '/mentor/dashboard' : '/admin/dashboard'}
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal rounded-md"
            aria-label="PoraPlan Workspace"
          >
            <div className="h-8 w-8 sm:h-9 sm:w-9 p-1 bg-white border border-brand-dark/20 rounded-md flex items-center justify-center shrink-0">
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
              <span className="font-heading font-bold text-base sm:text-lg text-brand-navy tracking-tight leading-none">
                PoraPlan
              </span>
              <span className="text-[11px] text-brand-muted sm:hidden leading-none mt-1">
                {roleLabel}
              </span>
            </div>
          </Link>

          <span className={`hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${rolePillClass}`}>
            {roleLabel}
          </span>
        </div>

        {/* User profile controls & Dropdown Menu */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Notifications Center Bell */}
          <Link
            to={isMentor ? '/mentor/notifications' : isAdmin ? '/admin/notifications' : '/student/notifications'}
            className="relative p-2 rounded-md border border-brand-dark/15 bg-white text-brand-muted hover:text-brand-navy hover:bg-brand-paper-tint hover:border-brand-dark/30 transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
            title="Notifications"
            aria-label={`Notifications, ${unreadNotifCount} unread`}
          >
            <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 bg-brand-coral text-white font-sans font-bold text-[9px] leading-tight flex items-center justify-center rounded-full">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </Link>

          {/* Profile & Account Dropdown */}
          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileDropdownOpen((prev) => !prev)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-md border border-brand-dark/15 bg-white hover:bg-brand-paper-tint hover:border-brand-dark/30 transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal"
              aria-expanded={profileDropdownOpen}
              aria-haspopup="menu"
              aria-label="User account and profile menu"
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-brand-navy text-white font-heading font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  userInitials
                )}
              </div>
              <div className="hidden sm:flex flex-col pr-1">
                <span className="text-xs font-semibold text-brand-dark leading-none truncate max-w-[130px]">
                  {userDisplayName}
                </span>
                <span className="text-[10px] text-brand-muted font-mono leading-tight mt-0.5 truncate max-w-[130px]">
                  {poraplanId || user?.email}
                </span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-brand-muted transition-transform ${
                  profileDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                role="menu"
                aria-orientation="vertical"
                className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-lg border border-brand-dark/15 shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                {/* Account Details Header */}
                <div className="px-3.5 py-2.5 border-b border-brand-dark/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-brand-navy text-white font-heading font-bold text-xs flex items-center justify-center overflow-hidden shrink-0">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-brand-navy truncate">
                        {userDisplayName}
                      </p>
                      <p className="text-[11px] text-brand-muted font-mono truncate">
                        {poraplanId || user?.email}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${rolePillClass}`}>
                      {roleLabel}
                    </span>
                  </div>
                </div>

                {/* Primary Destination: Academic Profile */}
                <div className="py-1">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-brand-dark hover:bg-brand-teal-light hover:text-brand-navy transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-brand-navy shrink-0 stroke-[2]" />
                    <span className="flex-1">My Academic Profile</span>
                  </Link>

                  {/* Role Specific Destination */}
                  {isStudent && (
                    <Link
                      to="/student/billing"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-brand-dark hover:bg-brand-teal-light hover:text-brand-navy transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-brand-navy shrink-0 stroke-[2]" />
                      <span className="flex-1">Billing & Payments</span>
                    </Link>
                  )}
                  {isMentor && (
                    <Link
                      to="/mentor/payouts"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-brand-dark hover:bg-brand-teal-light hover:text-brand-navy transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-brand-navy shrink-0 stroke-[2]" />
                      <span className="flex-1">Payout History</span>
                    </Link>
                  )}
                  {isAdmin && (
                    <Link
                      to="/admin/billing"
                      role="menuitem"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-brand-dark hover:bg-brand-teal-light hover:text-brand-navy transition-colors"
                    >
                      <CreditCard className="w-4 h-4 text-brand-navy shrink-0 stroke-[2]" />
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
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-brand-dark hover:bg-brand-teal-light hover:text-brand-navy transition-colors text-left cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4 text-brand-gold shrink-0 stroke-[2]" />
                    <span className="flex-1">Account & Identity Details</span>
                  </button>
                </div>

                <div className="border-t border-brand-dark/10 my-1" />

                {/* Sign Out Action inside Dropdown */}
                <div className="py-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleSignOut();
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors text-left cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-red-500 shrink-0 stroke-[2]" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace Body with Responsive Shell */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (md: 768px+) */}
        <aside className="hidden md:flex flex-col w-60 lg:w-64 border-r border-brand-dark/15 bg-white shrink-0 justify-between print:hidden">
          <div className="p-3.5 space-y-3">
            <div className="px-2.5 pb-2 border-b border-brand-dark/10">
              <span className="text-[11px] font-semibold text-brand-muted tracking-wide uppercase">
                {roleLabel} Workspace
              </span>
            </div>

            <nav className="space-y-1" aria-label="Sidebar Navigation">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isExact = location.pathname === item.to || (location.pathname + location.hash) === item.to;
                const isSubpath = item.to.includes('/subjects') && location.pathname.startsWith(item.to);
                const isActive = isExact || isSubpath;
                return (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-teal-light text-brand-navy font-semibold border-l-2 border-brand-teal'
                        : 'text-brand-dark/80 hover:bg-brand-paper-tint hover:text-brand-navy'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 stroke-[2] ${isActive ? 'text-brand-teal' : 'text-brand-muted'}`} />
                    <span className="truncate">{item.label}</span>
                    {Boolean((item as any).badgeCount && (item as any).badgeCount > 0) && (
                      <span className="ml-auto px-1.5 py-0.2 text-[10px] font-sans font-bold bg-brand-coral text-white rounded-full">
                        {(item as any).badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Clean Minimal Sidebar Footer */}
          <div className="p-3 border-t border-brand-dark/10 bg-brand-paper-tint/40 text-center">
            <p className="text-[11px] text-brand-muted font-sans">
              PoraPlan Academic Mentorship
            </p>
          </div>
        </aside>

        {/* Content Outlet Canvas */}
        <main className="flex-1 min-w-0 pb-20 md:pb-8" id="workspace-content">
          <Outlet />

          {/* Clean App Footer */}
          <footer className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 pb-4 text-center print:hidden">
            <p className="text-xs text-brand-muted font-sans">
              PoraPlan Study System • You study. We organize how, what and when.
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px, optimized for 360px-430px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-brand-dark/15 h-14 flex items-center justify-around shadow-sm print:hidden"
        aria-label="Mobile Bottom Navigation"
      >
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const isExact = location.pathname === item.to || (location.pathname + location.hash) === item.to;
          const isSubpath = item.to.includes('/subjects') && location.pathname.startsWith(item.to);
          const isActive = isExact || isSubpath;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors relative ${
                isActive
                  ? 'text-brand-navy font-semibold'
                  : 'text-brand-muted hover:text-brand-dark'
              }`}
            >
              <div className="relative">
                <Icon className={`w-4 h-4 stroke-[2] ${isActive ? 'text-brand-teal' : 'currentColor'}`} />
                {Boolean((item as any).badgeCount && (item as any).badgeCount > 0) && (
                  <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 bg-brand-coral text-white font-sans font-bold text-[8px] flex items-center justify-center rounded-full">
                    {(item as any).badgeCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 leading-none truncate max-w-[70px] ${isActive ? 'font-semibold text-brand-navy' : 'text-brand-muted'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-6 h-0.5 bg-brand-teal rounded-full" />
              )}
            </Link>
          );
        })}

        {/* Mobile Profile Trigger Item */}
        <button
          type="button"
          onClick={() => setProfileModalOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-1 text-brand-muted hover:text-brand-dark cursor-pointer"
          aria-label="View Profile"
        >
          <UserIcon className="w-4 h-4 stroke-[2]" />
          <span className="text-[10px] mt-0.5 leading-none text-brand-muted">
            Profile
          </span>
        </button>
      </nav>

      {/* Profile Details Modal Dossier */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/50 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
        >
          <div className="w-full max-w-md bg-white rounded-xl border border-brand-dark/15 shadow-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-brand-dark/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold stroke-[2]" />
                <h2 id="profile-modal-title" className="font-heading font-bold text-lg text-brand-navy">
                  Account Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1 rounded-md text-brand-muted hover:text-brand-dark hover:bg-brand-paper-tint transition-colors cursor-pointer"
                aria-label="Close Profile"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-brand-dark/10 bg-brand-paper-tint/60 space-y-1">
                <span className="text-[11px] text-brand-muted block font-medium">PoraPlan ID</span>
                <span className="font-bold text-brand-navy text-sm font-mono">
                  {poraplanId || profile?.poraplan_id || '-'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-brand-dark/10 bg-brand-paper-tint/60 space-y-1">
                <span className="text-[11px] text-brand-muted block font-medium">Full Name</span>
                <span className="font-semibold text-brand-dark text-sm">{userDisplayName}</span>
              </div>

              <div className="p-3 rounded-lg border border-brand-dark/10 bg-brand-paper-tint/60 space-y-1.5">
                <span className="text-[11px] text-brand-muted block font-medium">Associated Email</span>
                {profile?.linked_email ? (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-brand-dark break-all">{profile.linked_email}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      LINKED
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <span className="text-xs text-brand-muted block">
                      No personal email linked yet.
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="email"
                        value={emailToLink}
                        onChange={(e) => setEmailToLink(e.target.value)}
                        placeholder="your.email@example.com"
                        className="flex-1 px-3 py-1.5 text-xs rounded-md border border-brand-dark/20 bg-white focus:outline-none focus:ring-1 focus:ring-brand-teal"
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
                  <p className="text-[11px] font-medium text-emerald-700">{emailLinkMessage}</p>
                )}
                <span className="text-[11px] text-brand-muted block mt-0.5">
                  Used for Google sign-in and password recovery.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-lg border border-brand-dark/10 bg-brand-paper-tint/60 space-y-1">
                  <span className="text-[11px] text-brand-muted block font-medium">Role</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${rolePillClass}`}>
                    {roleLabel}
                  </span>
                </div>

                <div className="p-3 rounded-lg border border-brand-dark/10 bg-brand-paper-tint/60 space-y-1">
                  <span className="text-[11px] text-brand-muted block font-medium">Status</span>
                  <span className="font-semibold text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                    {profile?.status === 'not_activated' ? 'Activating' : 'Active'}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2 border-t border-brand-dark/10">
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
