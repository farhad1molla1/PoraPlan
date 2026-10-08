import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ShieldCheck, LogOut, CheckCircle, Database, UserPlus, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { adminRegisterMember } from '../../lib/profiles';
import type { UserRole } from '../../types/database';

export const AdminDashboardPage: React.FC = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('student');
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisionMessage, setProvisionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

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

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Ribbon */}
        <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-6 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                ADMIN WORKSPACE
              </span>
              <Badge variant="navy" size="sm" className="bg-brand-paper text-brand-dark">
                ADMINISTRATOR
              </Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              System Admin: {profile?.full_name || user?.email || 'Administrator'}
            </h1>
            <p className="font-mono text-xs text-brand-bg/75">
              Account: {user?.email} | Role: {role?.toUpperCase()}
            </p>
          </div>

          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              className="bg-brand-paper text-brand-dark hover:bg-brand-gold-light"
            >
              Sign Out
            </Button>
          </div>
        </div>

        {/* Administration Overview */}
        <div className="border-2 border-brand-dark bg-brand-paper p-6 shadow-brutal space-y-4">
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              Platform Administration Overview
            </h2>
            <Badge variant="teal" size="sm">SECURITY ACTIVE</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Authentication &amp; Access Controls
                </span>
              </div>
              <p className="text-xs text-brand-dark/80 font-sans">
                Profile records and mentorship relationships are strictly protected at the database level.
              </p>
            </div>

            <div className="p-4 border-2 border-brand-dark bg-brand-gold-light/40 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-gold-dark stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Administrative Operations
                </span>
              </div>
              <p className="text-xs text-brand-dark/80 font-sans">
                Student and mentor account management, study syllabus oversight, and platform metrics.
              </p>
            </div>
          </div>
        </div>

        {/* Controlled Member Account Provisioning Card */}
        <div className="border-2 border-brand-dark bg-brand-paper p-6 shadow-brutal space-y-5">
          <div className="border-b-2 border-brand-dark pb-3 flex items-center justify-between">
            <div>
              <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-brand-teal stroke-[2.5]" />
                Controlled Member Provisioning
              </h2>
              <p className="text-xs text-brand-dark/80 font-sans mt-0.5">
                Pre-register an authorized student or mentor account into the platform registry.
              </p>
            </div>
            <span className="text-[11px] font-mono font-bold text-brand-muted uppercase">ADMIN ONLY</span>
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
                className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans uppercase"
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
                className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
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
                className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
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
                className="w-full px-3 py-2 text-sm border-2 border-brand-dark bg-brand-paper focus:bg-brand-teal-light focus:outline-none font-sans"
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
        </div>

        {/* Pre-Registered Test Accounts Reference Table */}
        <div className="border-2 border-brand-dark bg-brand-paper p-6 shadow-brutal space-y-4">
          <div className="border-b-2 border-brand-dark pb-3">
            <h3 className="font-heading font-extrabold text-base text-brand-navy">
              Pre-Registered Testing Accounts
            </h3>
            <p className="text-xs text-brand-dark/80 font-sans mt-0.5">
              Authorized credentials available for development verification.
            </p>
          </div>

          <div className="overflow-x-auto">
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
        </div>

      </div>
    </div>
  );
};

