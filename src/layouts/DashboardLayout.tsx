import React, { useState } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import {
  LayoutDashboard,
  Target,
  ListTodo,
  Users,
  FileCheck,
  Calendar,
  LogOut,
  User as UserIcon,
  ShieldCheck,
  X,
  Sparkles,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { user, profile, role, poraplanId, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

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
    { label: 'Overview', to: '/student/dashboard', icon: LayoutDashboard },
    { label: "Today's Focus", to: '/student/dashboard#focus', icon: Target },
    { label: 'Upcoming Tasks', to: '/student/dashboard#tasks', icon: ListTodo },
    { label: 'Mentorship', to: '/student/dashboard#mentorship', icon: Users },
  ];

  const mentorNavItems = [
    { label: 'Overview', to: '/mentor/dashboard', icon: LayoutDashboard },
    { label: 'Student Roster', to: '/mentor/dashboard#roster', icon: Users },
    { label: 'Review Queue', to: '/mentor/dashboard#reviews', icon: FileCheck },
    { label: 'Evaluations', to: '/mentor/dashboard#evaluations', icon: Calendar },
  ];

  const adminNavItems = [
    { label: 'Admin Console', to: '/admin/dashboard', icon: ShieldCheck },
  ];

  const navItems = isStudent ? studentNavItems : isMentor ? mentorNavItems : adminNavItems;

  return (
    <div className="min-h-screen bg-brand-bg text-brand-dark flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-brand-bg border-b-2 border-brand-dark px-3.5 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-sm">
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

        {/* User profile controls & Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Profile Trigger Button */}
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:-translate-x-0.5 hover:-translate-y-0.5 transition-transform text-left"
            title="View Profile Details"
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-brand-navy text-brand-bg font-heading font-extrabold text-xs flex items-center justify-center border border-brand-dark">
              {userInitials}
            </div>
            <div className="hidden sm:flex flex-col pr-1">
              <span className="text-xs font-bold font-sans text-brand-dark leading-none truncate max-w-[120px]">
                {userDisplayName}
              </span>
              <span className="text-[10px] font-mono text-brand-teal font-bold leading-tight mt-0.5 truncate max-w-[120px]">
                {poraplanId || user?.email}
              </span>
            </div>
          </button>

          {/* Sign Out Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            leftIcon={<LogOut className="w-3.5 h-3.5" />}
            className="hidden sm:inline-flex text-xs font-mono"
          >
            Sign Out
          </Button>

          <button
            type="button"
            onClick={handleSignOut}
            className="sm:hidden p-1.5 border-2 border-brand-dark bg-brand-paper shadow-brutal-xs hover:bg-brand-paper-tint"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="w-4 h-4 text-brand-dark" />
          </button>
        </div>
      </header>

      {/* Main Workspace Body with Responsive Shell */}
      <div className="flex-1 flex w-full">
        {/* Desktop Sidebar (md: 768px+) */}
        <aside className="hidden md:flex flex-col w-60 lg:w-64 border-r-2 border-brand-dark bg-brand-paper shrink-0 justify-between">
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
                const isActive = location.pathname === item.to || (location.pathname + location.hash) === item.to;
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
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer User Card */}
          <div className="p-3.5 border-t-2 border-brand-dark bg-brand-paper-tint space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-gold border-2 border-brand-dark font-mono font-bold text-xs flex items-center justify-center shrink-0">
                {userInitials}
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

            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                className="flex-1 py-1 px-2 border-2 border-brand-dark bg-brand-paper text-[11px] font-mono font-bold text-brand-dark hover:bg-brand-gold-light transition-colors shadow-brutal-xs text-center"
              >
                My Profile
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1 border-2 border-brand-dark bg-brand-paper text-brand-dark hover:bg-red-50 hover:text-red-700 transition-colors shadow-brutal-xs"
                title="Sign Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </aside>

        {/* Content Outlet Canvas */}
        <main className="flex-1 min-w-0 pb-20 md:pb-8" id="workspace-content">
          <Outlet />

          {/* Clean App Footer */}
          <footer className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 pb-2 text-center">
            <p className="font-mono text-[10px] text-brand-muted">
              PoraPlan Study System • You study. We organize how, what and when.
            </p>
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (< 768px, optimized for 360px-430px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-brand-paper border-t-2 border-brand-dark h-14 flex items-stretch justify-around shadow-brutal-xs"
        aria-label="Mobile Bottom Navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to || (location.pathname + location.hash) === item.to;
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-colors border-r last:border-r-0 border-brand-dark/20 ${
                isActive
                  ? 'bg-brand-teal-light text-brand-navy font-bold'
                  : 'text-brand-muted hover:text-brand-dark'
              }`}
            >
              <Icon className="w-4 h-4 stroke-[2.2]" />
              <span className="text-[10px] font-mono mt-0.5 leading-none truncate max-w-[70px]">
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Mobile Profile Trigger Item */}
        <button
          type="button"
          onClick={() => setProfileModalOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-1 text-brand-muted hover:text-brand-dark"
        >
          <UserIcon className="w-4 h-4 stroke-[2.2]" />
          <span className="text-[10px] font-mono mt-0.5 leading-none">
            Profile
          </span>
        </button>
      </nav>

      {/* Profile Details Modal Dossier */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/60 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-modal-title"
        >
          <div className="w-full max-w-md bg-brand-paper border-3 border-brand-dark shadow-brutal-lg p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brand-gold stroke-[2.5]" />
                <h2 id="profile-modal-title" className="font-heading font-extrabold text-lg text-brand-navy">
                  My Profile
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1 border-2 border-brand-dark bg-brand-paper-tint hover:bg-brand-paper shadow-brutal-xs"
                aria-label="Close Profile"
              >
                <X className="w-4 h-4 text-brand-dark" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">PoraPlan ID</span>
                <span className="font-bold text-brand-navy text-sm font-mono">
                  {poraplanId || profile?.poraplan_id || 'PP-MEMBER'}
                </span>
              </div>

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">Full Name</span>
                <span className="font-bold text-brand-dark text-sm font-sans">{userDisplayName}</span>
              </div>

              <div className="p-3 border-2 border-brand-dark bg-brand-paper-tint space-y-1">
                <span className="text-[10px] text-brand-muted uppercase block">Associated Email</span>
                <span className="font-bold text-brand-dark break-all">
                  {profile?.linked_email || user?.email}
                </span>
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

            <div className="pt-2 flex items-center justify-between gap-3 border-t-2 border-brand-dark">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProfileModalOpen(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSignOut}
                leftIcon={<LogOut className="w-3.5 h-3.5" />}
                className="flex-1"
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
