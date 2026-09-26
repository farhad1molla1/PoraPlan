import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { BookOpen, LogOut, CheckCircle, Clock } from 'lucide-react';

export const StudentDashboardPage: React.FC = () => {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="w-full min-h-[calc(100vh-140px)] py-8 px-4 sm:px-6 lg:px-8 academic-grid-pattern">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header Ribbon */}
        <div className="border-2 border-brand-dark bg-brand-navy text-brand-bg p-6 shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase text-brand-gold font-bold tracking-wider">
                STUDENT SECTOR // WORKSPACE
              </span>
              <Badge variant="teal" size="sm">ACTIVE SESSION</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-brand-bg">
              Welcome, {profile?.full_name || user?.email || 'Student'}
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
              <BookOpen className="w-5 h-5 text-brand-teal stroke-[2.5]" />
              Study Docket Status
            </h2>
            <Badge variant="gold" size="sm">PHASE 1 AUTH READY</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 border-2 border-brand-dark bg-brand-teal-light/50 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-brand-teal stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Authentication Engine
                </span>
              </div>
              <p className="text-xs text-brand-dark/80 font-sans">
                Real Supabase Auth session active. Profiles table synced and protected by Row Level Security.
              </p>
            </div>

            <div className="p-4 border-2 border-brand-dark bg-brand-gold-light/40 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-gold-dark stroke-[2.5]" />
                <span className="font-mono text-xs font-bold uppercase text-brand-dark">
                  Next Milestone (Phase 2)
                </span>
              </div>
              <p className="text-xs text-brand-dark/80 font-sans">
                Daily syllabus queue, problem sets submission engine, and mentor correction dockets unlock in Phase 2.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
