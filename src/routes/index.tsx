import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LandingPage } from '../pages/LandingPage';
import { HowItWorksPage } from '../pages/HowItWorksPage';
import { AboutPage } from '../pages/AboutPage';
import { ContactPage } from '../pages/ContactPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
import { ResetPasswordPage } from '../pages/ResetPasswordPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { StudentDashboardPage } from '../pages/dashboard/StudentDashboardPage';
import { MentorDashboardPage } from '../pages/dashboard/MentorDashboardPage';
import { AdminDashboardPage } from '../pages/dashboard/AdminDashboardPage';
import { useAuth } from '../hooks/useAuth';

/**
 * Resolves /dashboard to the user's corresponding role workspace.
 */
const DashboardRedirect: React.FC = () => {
  const { role, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center p-6 academic-grid-pattern">
        <div className="p-6 border-2 border-brand-dark bg-brand-paper shadow-brutal text-center max-w-sm">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-brand-teal border-t-brand-navy rounded-full mb-3" />
          <p className="font-heading font-extrabold text-sm text-brand-navy">
            OPENING WORKSPACE
          </p>
          <span className="font-mono text-[11px] text-brand-muted mt-1 block">
            Loading your study dashboard...
          </span>
        </div>
      </div>
    );
  }

  if (role === 'mentor') {
    return <Navigate to="/mentor/dashboard" replace />;
  }
  if (role === 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Navigate to="/student/dashboard" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Marketing & Informational Shell */}
      <Route element={<RootLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />
        <Route path="activate" element={<SignupPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Authenticated Workspace Shell (Protected with Role Guard) */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        {/* Primary Student Sector */}
        <Route
          path="student/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Primary Mentor Sector */}
        <Route
          path="mentor/dashboard"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Primary Admin Sector */}
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Dynamic Role Resolver */}
      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <DashboardRedirect />
          </ProtectedRoute>
        }
      />

      {/* Aliases for backwards compatibility */}
      <Route path="dashboard/student" element={<Navigate to="/student/dashboard" replace />} />
      <Route path="dashboard/mentor" element={<Navigate to="/mentor/dashboard" replace />} />
      <Route path="dashboard/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="student" element={<Navigate to="/student/dashboard" replace />} />
      <Route path="mentor" element={<Navigate to="/mentor/dashboard" replace />} />
      <Route path="admin" element={<Navigate to="/admin/dashboard" replace />} />

      {/* 404 Catch-All Handler (wrapped in RootLayout) */}
      <Route element={<RootLayout />}>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
