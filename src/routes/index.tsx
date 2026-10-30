import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { LandingPage } from '../pages/LandingPage';
import { ProgramsPage } from '../pages/ProgramsPage';
import { ProgramDetailPage } from '../pages/ProgramDetailPage';
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
import { AdminProgramsPage } from '../pages/dashboard/AdminProgramsPage';
import { StudentSubjectsPage } from '../pages/dashboard/StudentSubjectsPage';
import { MentorSubjectsPage } from '../pages/dashboard/MentorSubjectsPage';
import { SubjectDetailPage } from '../pages/dashboard/SubjectDetailPage';
import { StudentPlansPage } from '../pages/dashboard/StudentPlansPage';
import { MentorPlansPage } from '../pages/dashboard/MentorPlansPage';
import { PlanDetailPage } from '../pages/dashboard/PlanDetailPage';
import { StudentTasksPage } from '../pages/dashboard/StudentTasksPage';
import { MentorTasksPage } from '../pages/dashboard/MentorTasksPage';
import { StudentAssignmentsPage } from '../pages/dashboard/StudentAssignmentsPage';
import { MentorAssignmentsPage } from '../pages/dashboard/MentorAssignmentsPage';
import { MentorReviewQueuePage } from '../pages/dashboard/MentorReviewQueuePage';
import { StudentEvaluationsPage } from '../pages/dashboard/StudentEvaluationsPage';
import { MentorEvaluationsPage } from '../pages/dashboard/MentorEvaluationsPage';
import { StudentProgressPage } from '../pages/dashboard/StudentProgressPage';
import { MentorProgressPage } from '../pages/dashboard/MentorProgressPage';
import { StudentResourcesPage } from '../pages/dashboard/StudentResourcesPage';
import { MentorResourcesPage } from '../pages/dashboard/MentorResourcesPage';
import { StudentDoubtsPage } from '../pages/dashboard/StudentDoubtsPage';
import { MentorDoubtsPage } from '../pages/dashboard/MentorDoubtsPage';
import { StudentAnnouncementsPage } from '../pages/dashboard/StudentAnnouncementsPage';
import { MentorAnnouncementsPage } from '../pages/dashboard/MentorAnnouncementsPage';
import { StudentNotificationsPage } from '../pages/dashboard/StudentNotificationsPage';
import { ProfilePage } from '../pages/dashboard/ProfilePage';
import { MyApplicationsPage } from '../pages/dashboard/MyApplicationsPage';
import { AdminApplicationsPage } from '../pages/dashboard/AdminApplicationsPage';
import { AdminEnrollmentsPage } from '../pages/dashboard/AdminEnrollmentsPage';
import { AdminMentorAssignmentsPage } from '../pages/dashboard/AdminMentorAssignmentsPage';
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
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="programs/:slug" element={<ProgramDetailPage />} />
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
        <Route
          path="student/tasks"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/assignments"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentAssignmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/evaluations"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentEvaluationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/progress"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/resources"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentResourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/doubts"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentDoubtsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/announcements"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentAnnouncementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/applications"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/notifications"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentNotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/plans"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentPlansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/plans/:planId"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <PlanDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/subjects"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentSubjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/subjects/:subjectId"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <SubjectDetailPage />
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
        <Route
          path="mentor/tasks"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorTasksPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/assignments"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorAssignmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/reviews"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorReviewQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/evaluations"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorEvaluationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/progress"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/resources"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorResourcesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/doubts"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorDoubtsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/announcements"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorAnnouncementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/applications"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/plans"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorPlansPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/plans/:planId"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <PlanDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/subjects"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorSubjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="mentor/subjects/:subjectId"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <SubjectDetailPage />
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
        <Route
          path="admin/programs"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminProgramsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/applications"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/enrollments"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminEnrollmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/mentor-assignments"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminMentorAssignmentsPage />
            </ProtectedRoute>
          }
        />

        {/* Dedicated Profile & Identity Sector (All Authenticated Members) */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="student/profile" element={<ProfilePage />} />
        <Route path="mentor/profile" element={<ProfilePage />} />
        <Route path="admin/profile" element={<ProfilePage />} />
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
