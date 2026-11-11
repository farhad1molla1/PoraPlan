import React, { lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { RootLayout } from '../layouts/RootLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { RouteErrorBoundary } from '../components/common/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';

/**
 * Robust lazy import wrapper with single automatic retry on chunk loading failure.
 * If dynamic chunk fetch fails due to network drop or CDN redeployment, retries once before
 * delegating to the nearest RouteErrorBoundary.
 */
function lazyRoute<T extends Record<string, unknown>, K extends keyof T>(
  importer: () => Promise<T>,
  exportName: K
) {
  return lazy(async () => {
    try {
      const module = await importer();
      return { default: module[exportName] as React.ComponentType };
    } catch (err) {
      // Automatic single retry after short delay for network glitches
      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        const module = await importer();
        return { default: module[exportName] as React.ComponentType };
      } catch {
        throw err;
      }
    }
  });
}

// Public marketing & auth pages (code-split)
const LandingPage = lazyRoute(() => import('../pages/LandingPage'), 'LandingPage');
const ProgramsPage = lazyRoute(() => import('../pages/ProgramsPage'), 'ProgramsPage');
const ProgramDetailPage = lazyRoute(() => import('../pages/ProgramDetailPage'), 'ProgramDetailPage');
const CohortDetailPage = lazyRoute(() => import('../pages/CohortDetailPage'), 'CohortDetailPage');
const HowItWorksPage = lazyRoute(() => import('../pages/HowItWorksPage'), 'HowItWorksPage');
const AboutPage = lazyRoute(() => import('../pages/AboutPage'), 'AboutPage');
const ContactPage = lazyRoute(() => import('../pages/ContactPage'), 'ContactPage');
const LoginPage = lazyRoute(() => import('../pages/LoginPage'), 'LoginPage');
const SignupPage = lazyRoute(() => import('../pages/SignupPage'), 'SignupPage');
const ResetPasswordPage = lazyRoute(() => import('../pages/ResetPasswordPage'), 'ResetPasswordPage');
const NotFoundPage = lazyRoute(() => import('../pages/NotFoundPage'), 'NotFoundPage');

// Primary Student Sector (code-split)
const StudentDashboardPage = lazyRoute(() => import('../pages/dashboard/StudentDashboardPage'), 'StudentDashboardPage');
const StudentTasksPage = lazyRoute(() => import('../pages/dashboard/StudentTasksPage'), 'StudentTasksPage');
const StudentAssignmentsPage = lazyRoute(() => import('../pages/dashboard/StudentAssignmentsPage'), 'StudentAssignmentsPage');
const StudentReportPage = lazyRoute(() => import('../pages/dashboard/StudentReportPage'), 'StudentReportPage');
const StudentProgressPage = lazyRoute(() => import('../pages/dashboard/StudentProgressPage'), 'StudentProgressPage');
const StudentSubjectsPage = lazyRoute(() => import('../pages/dashboard/StudentSubjectsPage'), 'StudentSubjectsPage');
const StudentPlansPage = lazyRoute(() => import('../pages/dashboard/StudentPlansPage'), 'StudentPlansPage');
const StudentLibraryPage = lazyRoute(() => import('../pages/dashboard/StudentLibraryPage'), 'StudentLibraryPage');
const StudentDoubtsPage = lazyRoute(() => import('../pages/dashboard/StudentDoubtsPage'), 'StudentDoubtsPage');
const StudentAnnouncementsPage = lazyRoute(() => import('../pages/dashboard/StudentAnnouncementsPage'), 'StudentAnnouncementsPage');
const StudentNotificationsPage = lazyRoute(() => import('../pages/dashboard/StudentNotificationsPage'), 'StudentNotificationsPage');
const StudentBillingPage = lazyRoute(() => import('../pages/dashboard/StudentBillingPage'), 'StudentBillingPage');

// Primary Mentor Sector (code-split)
const MentorDashboardPage = lazyRoute(() => import('../pages/dashboard/MentorDashboardPage'), 'MentorDashboardPage');
const MentorTasksPage = lazyRoute(() => import('../pages/dashboard/MentorTasksPage'), 'MentorTasksPage');
const MentorAssignmentsPage = lazyRoute(() => import('../pages/dashboard/MentorAssignmentsPage'), 'MentorAssignmentsPage');
const MentorReviewQueuePage = lazyRoute(() => import('../pages/dashboard/MentorReviewQueuePage'), 'MentorReviewQueuePage');
const MentorEvaluationsPage = lazyRoute(() => import('../pages/dashboard/MentorEvaluationsPage'), 'MentorEvaluationsPage');
const MentorReportPage = lazyRoute(() => import('../pages/dashboard/MentorReportPage'), 'MentorReportPage');
const MentorProgressPage = lazyRoute(() => import('../pages/dashboard/MentorProgressPage'), 'MentorProgressPage');
const MentorSubjectsPage = lazyRoute(() => import('../pages/dashboard/MentorSubjectsPage'), 'MentorSubjectsPage');
const MentorPlansPage = lazyRoute(() => import('../pages/dashboard/MentorPlansPage'), 'MentorPlansPage');
const MentorResourcesPage = lazyRoute(() => import('../pages/dashboard/MentorResourcesPage'), 'MentorResourcesPage');
const MentorDoubtsPage = lazyRoute(() => import('../pages/dashboard/MentorDoubtsPage'), 'MentorDoubtsPage');
const MentorAnnouncementsPage = lazyRoute(() => import('../pages/dashboard/MentorAnnouncementsPage'), 'MentorAnnouncementsPage');
const MentorNotificationsPage = lazyRoute(() => import('../pages/dashboard/MentorNotificationsPage'), 'MentorNotificationsPage');
const MentorPayoutsPage = lazyRoute(() => import('../pages/dashboard/MentorPayoutsPage'), 'MentorPayoutsPage');

// Administrative Sector (code-split)
const AdminDashboardPage = lazyRoute(() => import('../pages/dashboard/AdminDashboardPage'), 'AdminDashboardPage');
const AdminProgramsPage = lazyRoute(() => import('../pages/dashboard/AdminProgramsPage'), 'AdminProgramsPage');
const AdminEnrollmentsPage = lazyRoute(() => import('../pages/dashboard/AdminEnrollmentsPage'), 'AdminEnrollmentsPage');
const AdminMentorAssignmentsPage = lazyRoute(() => import('../pages/dashboard/AdminMentorAssignmentsPage'), 'AdminMentorAssignmentsPage');
const AdminUsersPage = lazyRoute(() => import('../pages/dashboard/AdminUsersPage'), 'AdminUsersPage');
const AdminReportsPage = lazyRoute(() => import('../pages/dashboard/AdminReportsPage'), 'AdminReportsPage');
const AdminBillingPage = lazyRoute(() => import('../pages/dashboard/AdminBillingPage'), 'AdminBillingPage');
const AdminNotificationsPage = lazyRoute(() => import('../pages/dashboard/AdminNotificationsPage'), 'AdminNotificationsPage');

// Shared / Detail Pages (code-split)
const SubjectDetailPage = lazyRoute(() => import('../pages/dashboard/SubjectDetailPage'), 'SubjectDetailPage');
const PlanDetailPage = lazyRoute(() => import('../pages/dashboard/PlanDetailPage'), 'PlanDetailPage');
const ProfilePage = lazyRoute(() => import('../pages/dashboard/ProfilePage'), 'ProfilePage');
const PublicProfilePage = lazyRoute(() => import('../pages/dashboard/PublicProfilePage'), 'PublicProfilePage');

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

/**
 * Backward compatibility redirect for /student/resources -> /student/library.
 * Preserves query parameters across navigation (e.g. ?tab=resources).
 */
const StudentResourcesRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={{ pathname: '/student/library', search: location.search }} replace />;
};

/**
 * Backward compatibility redirect for /student/evaluations -> /student/library?tab=evaluations.
 * Preserves query parameters across navigation.
 */
const StudentEvaluationsRedirect: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  searchParams.set('tab', 'evaluations');
  return <Navigate to={{ pathname: '/student/library', search: `?${searchParams.toString()}` }} replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Public Marketing & Informational Shell */}
      <Route element={<RootLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="programs" element={<ProgramsPage />} />
        <Route path="programs/:slug" element={<ProgramDetailPage />} />
        <Route path="programs/:programSlug/cohorts/:cohortId" element={<CohortDetailPage />} />
        <Route path="cohorts/:cohortId" element={<CohortDetailPage />} />
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
              <StudentEvaluationsRedirect />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/reports"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentReportPage />
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
          path="student/library"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/billing"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <StudentBillingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="student/resources"
          element={
            <ProtectedRoute allowedRoles={['student', 'admin']}>
              <StudentResourcesRedirect />
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
          element={<Navigate to="/student/dashboard" replace />}
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
          path="mentor/reports"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorReportPage />
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
          path="mentor/payouts"
          element={
            <ProtectedRoute allowedRoles={['mentor']}>
              <MentorPayoutsPage />
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
          element={<Navigate to="/mentor/dashboard" replace />}
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
        <Route
          path="mentor/notifications"
          element={
            <ProtectedRoute allowedRoles={['mentor', 'admin']}>
              <MentorNotificationsPage />
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
          element={<Navigate to="/admin/enrollments" replace />}
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
        <Route
          path="admin/billing"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminBillingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/notifications"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminNotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Dedicated Profile & Identity Sector (All Authenticated Members) */}
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/:id" element={<PublicProfilePage />} />
        <Route path="student/profile" element={<ProfilePage />} />
        <Route path="student/profile/:id" element={<PublicProfilePage />} />
        <Route path="mentor/profile" element={<ProfilePage />} />
        <Route path="mentor/profile/:id" element={<PublicProfilePage />} />
        <Route path="admin/profile" element={<ProfilePage />} />
        <Route path="admin/profile/:id" element={<PublicProfilePage />} />
      </Route>

      {/* Dynamic Role Resolver */}
      <Route
        path="dashboard"
        element={
          <ProtectedRoute>
            <RouteErrorBoundary>
              <DashboardRedirect />
            </RouteErrorBoundary>
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
