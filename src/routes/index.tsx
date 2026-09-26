import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { LandingPage } from '../pages/LandingPage';
import { HowItWorksPage } from '../pages/HowItWorksPage';
import { AboutPage } from '../pages/AboutPage';
import { LoginPage } from '../pages/LoginPage';
import { SignupPage } from '../pages/SignupPage';
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
            RESOLVING WORKSPACE ROUTE
          </p>
        </div>
      </div>
    );
  }

  if (role === 'mentor') {
    return <Navigate to="/dashboard/mentor" replace />;
  }
  if (role === 'admin') {
    return <Navigate to="/dashboard/admin" replace />;
  }
  return <Navigate to="/dashboard/student" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<RootLayout />}>
        {/* Public Routes */}
        <Route index element={<LandingPage />} />
        <Route path="how-it-works" element={<HowItWorksPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="signup" element={<SignupPage />} />

        {/* Dynamic Role Router */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />

        {/* Student Workspace Sector */}
        <Route
          path="dashboard/student"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Mentor Workspace Sector */}
        <Route
          path="dashboard/mentor"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* System Admin Sector */}
        <Route
          path="dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />

        {/* 404 Handler */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
