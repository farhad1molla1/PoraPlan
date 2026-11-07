import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import {
  ShieldCheck,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  GraduationCap,
  ArrowRight,
  UserCheck,
  Users,
  CreditCard,
  BarChart3,
  Bell,
  Calendar,
} from 'lucide-react';
import { adminRegisterMember } from '../../lib/profiles';
import type { UserRole } from '../../types/database';

interface OperationalDesk {
  id: string;
  title: string;
  description: string;
  to: string;
  buttonLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: 'teal' | 'gold' | 'navy';
  variant: 'primary' | 'outline';
}

const OPERATIONAL_DESKS: OperationalDesk[] = [
  {
    id: 'enrollments',
    title: 'Enrollments Desk',
    description: 'Manage cohort student rosters, update enrollment states, and track student registration status.',
    to: '/admin/enrollments',
    buttonLabel: 'Manage Enrollments',
    icon: UserCheck,
    accentColor: 'teal',
    variant: 'primary',
  },
  {
    id: 'programs',
    title: 'Programs & Cohorts',
    description: 'Configure academic programs, curriculum modules, publication status, and scheduled cohort batches.',
    to: '/admin/programs',
    buttonLabel: 'Open Programs',
    icon: GraduationCap,
    accentColor: 'gold',
    variant: 'outline',
  },
  {
    id: 'mentor-assignments',
    title: 'Mentor Allocations',
    description: 'Allocate cohort-level default mentors and manage individual student mentor assignment overrides.',
    to: '/admin/mentor-assignments',
    buttonLabel: 'Open Allocations',
    icon: Users,
    accentColor: 'teal',
    variant: 'outline',
  },
  {
    id: 'billing',
    title: 'Billing & Invoicing',
    description: 'Oversee tuition records, verify student invoice settlement states, and track payment transactions.',
    to: '/admin/billing',
    buttonLabel: 'View Billing',
    icon: CreditCard,
    accentColor: 'navy',
    variant: 'outline',
  },
  {
    id: 'users',
    title: 'User Directory',
    description: 'Inspect registered student, mentor, and administrator profile accounts across the platform.',
    to: '/admin/users',
    buttonLabel: 'View Directory',
    icon: Users,
    accentColor: 'navy',
    variant: 'outline',
  },
  {
    id: 'reports',
    title: 'Academic Reports',
    description: 'Monitor aggregate student completion, study milestone analytics, and mentor workload distribution.',
    to: '/admin/reports',
    buttonLabel: 'View Reports',
    icon: BarChart3,
    accentColor: 'gold',
    variant: 'outline',
  },
  {
    id: 'notifications',
    title: 'System Alerts',
    description: 'Review automated system notifications, capacity alerts, submission pings, and platform events.',
    to: '/admin/notifications',
    buttonLabel: 'View Alerts',
    icon: Bell,
    accentColor: 'teal',
    variant: 'outline',
  },
];

export const AdminDashboardPage: React.FC = () => {
  const { user, profile, role } = useAuth();

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleProvisionMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvisionMessage(null);

    const cleanId = newId.trim().toUpperCase();
    if (!cleanId) {
      setProvisionMessage({ type: 'error', text: 'Please enter a valid PoraPlan ID (e.g. PP004 or PPM003).' });
      return;
    }

    setProvisionLoading(true);
    try {
      const result = await adminRegisterMember(cleanId, newName, newEmail, newRole);
      if (result.success) {
        setProvisionMessage({ type: 'success', text: result.message });
        setNewId('');
        setNewName('');
        setNewEmail('');
      } else {
        setProvisionMessage({ type: 'error', text: result.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error provisioning member.';
      setProvisionMessage({ type: 'error', text: msg });
    } finally {
      setProvisionLoading(false);
    }
  };

  const adminName = profile?.full_name || user?.email || 'Administrator';

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header / Admin Identity Card */}
        <section
          aria-labelledby="admin-header-title"
          className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-5 sm:p-6 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-brand-dark pb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                <h1
                  id="admin-header-title"
                  className="text-xl sm:text-2xl font-extrabold font-heading text-brand-navy tracking-tight"
                >
                  System Administration Console
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-brand-muted">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-brand-teal" />
                  {currentDate}
                </span>
                <span>•</span>
                <span>Admin: {adminName}</span>
                {user?.email && (
                  <>
                    <span>•</span>
                    <span>{user.email}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant="navy" size="sm" className="font-mono uppercase font-bold">
                {role?.toUpperCase() || 'ADMIN'}
              </Badge>
            </div>
          </div>

          <p className="text-xs sm:text-sm font-sans text-brand-dark/80">
            Welcome to the centralized platform operations console. Access administrative desks, configure programs and allocations, or provision member accounts.
          </p>
        </section>

        {/* Core Administrative Desks Grid */}
        <section aria-labelledby="admin-desks-title" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="admin-desks-title"
              className="text-base sm:text-lg font-heading font-extrabold text-brand-navy flex items-center gap-2"
            >
              <span>Administrative Operations</span>
            </h2>
            <span className="text-xs font-mono text-brand-muted">
              {OPERATIONAL_DESKS.length} Desks Available
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {OPERATIONAL_DESKS.map((desk) => {
              const IconComponent = desk.icon;
              const iconColorClass =
                desk.accentColor === 'gold'
                  ? 'text-brand-gold'
                  : desk.accentColor === 'navy'
                  ? 'text-brand-navy'
                  : 'text-brand-teal';

              return (
                <div
                  key={desk.id}
                  className="border-2 border-brand-dark bg-brand-paper shadow-brutal p-4 flex flex-col justify-between space-y-3 hover:-translate-y-0.5 transition-transform"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <IconComponent className={`w-4 h-4 ${iconColorClass} stroke-[2.5]`} />
                      <h3 className="font-heading font-extrabold text-sm text-brand-navy">
                        {desk.title}
                      </h3>
                    </div>
                    <p className="text-xs font-sans text-brand-dark/75 leading-relaxed">
                      {desk.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-brand-dark/20">
                    <Button
                      to={desk.to}
                      variant={desk.variant}
                      size="sm"
                      className="w-full justify-between"
                      rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    >
                      {desk.buttonLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Controlled Member Account Provisioning Card */}
        <section
          aria-labelledby="member-provisioning-title"
          className="border-2 border-brand-dark bg-brand-paper p-5 sm:p-6 shadow-brutal space-y-5"
        >
          <div className="border-b-2 border-brand-dark pb-3 flex items-center justify-between">
            <div>
              <h2
                id="member-provisioning-title"
                className="font-heading font-extrabold text-base sm:text-lg text-brand-navy flex items-center gap-2"
              >
                <UserPlus className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                Controlled Member Provisioning
              </h2>
              <p className="text-xs text-brand-dark/80 font-sans mt-0.5">
                Pre-register an authorized student or mentor account into the platform registry.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-brand-muted uppercase">
              Admin Only
            </span>
          </div>

          {provisionMessage && (
            <div
              className={`p-3 border-2 border-brand-dark text-xs font-sans flex items-start gap-2 ${
                provisionMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900'
                  : 'bg-red-50 text-red-900'
              }`}
            >
              {provisionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 stroke-[2.5]" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5 stroke-[2.5]" />
              )}
              <span>{provisionMessage.text}</span>
            </div>
          )}

          <form onSubmit={handleProvisionMember} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="provision-id" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                PoraPlan ID
              </label>
              <input
                id="provision-id"
                type="text"
                required
                value={newId}
                onChange={(e) => setNewId(e.target.value.toUpperCase())}
                placeholder="e.g. PP004"
                className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans uppercase"
              />
            </div>

            <div>
              <label htmlFor="provision-name" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                Full Name
              </label>
              <input
                id="provision-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Member full name"
                className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
              />
            </div>

            <div>
              <label htmlFor="provision-email" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                Contact Email
              </label>
              <input
                id="provision-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="member@example.com"
                className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
              />
            </div>

            <div>
              <label htmlFor="provision-role" className="block text-xs font-mono font-bold uppercase text-brand-dark mb-1">
                Role
              </label>
              <select
                id="provision-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-base sm:text-sm min-h-[44px] sm:min-h-0 border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
              >
                <option value="student">Student (PP...)</option>
                <option value="mentor">Mentor (PPM...)</option>
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={provisionLoading}
                leftIcon={!provisionLoading ? <UserPlus className="w-4 h-4 stroke-[2.5]" /> : undefined}
              >
                {provisionLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Pre-registering...
                  </span>
                ) : (
                  'Pre-register Member Account'
                )}
              </Button>
            </div>
          </form>
        </section>

        {/* Pre-Registered Test Accounts Reference Table */}
        <section
          aria-labelledby="test-accounts-title"
          className="border-2 border-brand-dark bg-brand-paper p-5 sm:p-6 shadow-brutal space-y-4"
        >
          <div className="border-b-2 border-brand-dark pb-3">
            <h2
              id="test-accounts-title"
              className="font-heading font-extrabold text-base text-brand-navy"
            >
              Pre-Registered Testing Accounts
            </h2>
            <p className="text-xs text-brand-dark/80 font-sans mt-0.5">
              Authorized credentials available for development verification.
            </p>
          </div>

          {/* Compact Responsive Table (< lg: 1024px) */}
          <div className="lg:hidden">
            <table className="w-full text-xs font-sans text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-brand-dark font-mono font-bold uppercase text-[10.5px] text-brand-navy bg-brand-paper-tint">
                  <th scope="col" className="py-2.5 px-2.5">Member &amp; Role</th>
                  <th scope="col" className="py-2.5 px-2">System Email</th>
                  <th scope="col" className="py-2.5 px-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b-2 border-brand-dark">
                <tr>
                  <td className="py-2 px-2.5 align-top">
                    <div className="font-bold text-brand-navy">Fahim Rahman</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10.5px] font-bold text-brand-teal">PP001</span>
                      <Badge variant="teal" size="sm">STUDENT</Badge>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-brand-muted align-top break-all">
                    student.pp001@poraplan.internal
                  </td>
                  <td className="py-2 px-2.5 text-right align-top">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">Active</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 align-top">
                    <div className="font-bold text-brand-navy">Dr. Rafiqul Islam</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10.5px] font-bold text-brand-teal">PPM001</span>
                      <Badge variant="gold" size="sm">MENTOR</Badge>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-brand-muted align-top break-all">
                    mentor.ppm001@poraplan.internal
                  </td>
                  <td className="py-2 px-2.5 text-right align-top">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">Active</span>
                  </td>
                </tr>
                <tr>
                  <td className="py-2 px-2.5 align-top">
                    <div className="font-bold text-brand-navy">PoraPlan System Admin</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10.5px] font-bold text-brand-teal">PPA001</span>
                      <Badge variant="navy" size="sm">ADMIN</Badge>
                    </div>
                  </td>
                  <td className="py-2 px-2 font-mono text-[11px] text-brand-muted align-top break-all">
                    admin.ppa001@poraplan.internal
                  </td>
                  <td className="py-2 px-2.5 text-right align-top">
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs">Active</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Desktop Table (>= lg: 1024px) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-xs font-sans text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-brand-dark font-mono font-bold uppercase text-brand-navy bg-brand-paper-tint">
                  <th className="py-2.5 px-3">PoraPlan ID</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Full Name</th>
                  <th className="py-2.5 px-3">System Email</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y border-b-2 border-brand-dark">
                <tr>
                  <td className="py-2 px-3 font-mono font-bold text-brand-navy">PP001</td>
                  <td className="py-2 px-3"><Badge variant="teal" size="sm">STUDENT</Badge></td>
                  <td className="py-2 px-3">Fahim Rahman</td>
                  <td className="py-2 px-3 font-mono text-brand-muted">student.pp001@poraplan.internal</td>
                  <td className="py-2 px-3"><span className="text-emerald-700 font-bold">Active</span></td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-bold text-brand-navy">PPM001</td>
                  <td className="py-2 px-3"><Badge variant="gold" size="sm">MENTOR</Badge></td>
                  <td className="py-2 px-3">Dr. Rafiqul Islam</td>
                  <td className="py-2 px-3 font-mono text-brand-muted">mentor.ppm001@poraplan.internal</td>
                  <td className="py-2 px-3"><span className="text-emerald-700 font-bold">Active</span></td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono font-bold text-brand-navy">PPA001</td>
                  <td className="py-2 px-3"><Badge variant="navy" size="sm">ADMIN</Badge></td>
                  <td className="py-2 px-3">PoraPlan System Admin</td>
                  <td className="py-2 px-3 font-mono text-brand-muted">admin.ppa001@poraplan.internal</td>
                  <td className="py-2 px-3"><span className="text-emerald-700 font-bold">Active</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
};
