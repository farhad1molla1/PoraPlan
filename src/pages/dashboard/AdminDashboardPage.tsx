import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { ShieldCheck, LogOut, CheckCircle, Database } from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="w-full py-6 sm:py-8 px-3.5 sm:px-6 lg:px-8 academic-grid-pattern min-h-full">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header Ribbon */}
        <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-6 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                ADMIN SECTOR // SYSTEM CONTROL
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

        {/* Phase 1 Verification Docket */}
        <div className="border-2 border-brand-dark bg-brand-paper p-6 shadow-brutal space-y-4">
          <div className="flex items-center justify-between border-b-2 border-brand-dark pb-3">
            <h2 className="font-heading font-extrabold text-lg text-brand-navy flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              Platform Administration Docket
            </h2>
            <Badge variant="teal" size="sm">SECURITY ACTIVE</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Authentication &amp; RLS
                </span>
              </div>
              <p className="text-xs text-brand-dark/80 font-sans">
                Profiles and mentor_students security policies are enforced at the database level.
              </p>
            </div>

            <div className="p-4 border-2 border-brand-dark bg-brand-gold-light/40 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-gold-dark stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Next Milestone (Phase 2)
                </span>
              </div>
              <p className="text-xs text-brand-dark/80 font-sans">
                User pairing console, syllabus management, and global platform metrics unlock in subsequent milestones.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
