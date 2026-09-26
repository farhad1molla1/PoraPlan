import React from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types/database';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Button } from '../common/Button';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 academic-grid-pattern">
        <div className="p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-teal border-t-brand-navy rounded-full mb-3" />
          <p className="font-heading font-extrabold text-sm text-brand-navy">
            VERIFYING ACADEMIC CREDENTIALS
          </p>
          <span className="font-mono text-[11px] text-brand-muted mt-1 block">
            Connecting session to PoraPlan security layer...
          </span>
        </div>
      </div>
    );
  }

  // Not signed in
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role check if specific roles are required
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return (
      <div className="w-full min-h-[70vh] flex items-center justify-center p-4 academic-grid-pattern">
        <div className="max-w-md w-full border-2 border-brand-dark bg-brand-paper shadow-brutal p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-brand-gold-light border-2 border-brand-dark mx-auto flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-brand-dark stroke-[2.5]" />
          </div>
          <div>
            <h2 className="font-heading font-extrabold text-lg text-brand-navy">
              ACCESS RESTRICTED
            </h2>
            <p className="text-xs text-brand-dark/80 mt-1 font-sans">
              Your registered role (<span className="font-mono font-bold uppercase">{role}</span>) does not have permission to inspect this sector.
            </p>
          </div>
          <div className="pt-2">
            <Link to={role === 'mentor' ? '/dashboard/mentor' : role === 'admin' ? '/dashboard/admin' : '/dashboard/student'}>
              <Button variant="primary" size="sm" fullWidth leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
                Go To My Workspace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
