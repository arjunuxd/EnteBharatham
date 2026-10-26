import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ProtectedRoute, RoleGuard } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AboutPage } from './pages/AboutPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';

/**
 * Route-level code splitting keeps the first visit lightweight: the home,
 * about, and 404 pages ship in the entry bundle, while exploration, record,
 * contribution, account, and moderation screens load on demand. The shared
 * layout (and its Suspense fallback) stays mounted during each load.
 */
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then((module) => ({ default: module.ExplorePage })),
);
const RegionsPage = lazy(() =>
  import('./pages/RegionsPage').then((module) => ({ default: module.RegionsPage })),
);
const LanguagesPage = lazy(() =>
  import('./pages/LanguagesPage').then((module) => ({ default: module.LanguagesPage })),
);
const HeritageRecordPage = lazy(() =>
  import('./pages/HeritageRecordPage').then((module) => ({ default: module.HeritageRecordPage })),
);
const ContributePage = lazy(() =>
  import('./pages/ContributePage').then((module) => ({ default: module.ContributePage })),
);
const ProfilePage = lazy(() =>
  import('./pages/phase4/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const VerifyEmailPage = lazy(() =>
  import('./pages/VerifyEmailPage').then((module) => ({ default: module.VerifyEmailPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const DraftEditorPage = lazy(() =>
  import('./pages/DraftEditorPage').then((module) => ({ default: module.DraftEditorPage })),
);
const ModerationQueuePage = lazy(() =>
  import('./pages/ModerationQueuePage').then((module) => ({
    default: module.ModerationQueuePage,
  })),
);
const AuditLogPage = lazy(() =>
  import('./pages/AuditLogPage').then((module) => ({ default: module.AuditLogPage })),
);
const ModerationGovernancePage = lazy(() =>
  import('./pages/ModerationGovernancePage').then((module) => ({
    default: module.ModerationGovernancePage,
  })),
);
const ModerationSubmissionPage = lazy(() =>
  import('./pages/ModerationSubmissionPage').then((module) => ({
    default: module.ModerationSubmissionPage,
  })),
);

/**
 * Route table. Auth-aware areas are wrapped in ProtectedRoute (any signed-in
 * account) or RoleGuard (moderator/admin); the guards only shape navigation —
 * the API enforces the same rules server-side.
 */
export function AppRoutes() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="explore/regions" element={<RegionsPage />} />
          <Route path="explore/languages" element={<LanguagesPage />} />
          <Route path="heritage/:slug" element={<HeritageRecordPage />} />
          <Route path="contribute" element={<ContributePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="profiles/:userId" element={<ProfilePage />} />

          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />

          <Route
            path="dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="dashboard/drafts/:id"
            element={
              <ProtectedRoute>
                <DraftEditorPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="moderation"
            element={
              <RoleGuard roles={['moderator', 'admin']}>
                <ModerationQueuePage />
              </RoleGuard>
            }
          />
          <Route
            path="moderation/audit"
            element={
              <RoleGuard roles={['moderator', 'admin']}>
                <AuditLogPage />
              </RoleGuard>
            }
          />
          <Route
            path="moderation/governance"
            element={
              <RoleGuard roles={['moderator', 'admin']}>
                <ModerationGovernancePage />
              </RoleGuard>
            }
          />
          <Route
            path="moderation/submissions/:id"
            element={
              <RoleGuard roles={['moderator', 'admin']}>
                <ModerationSubmissionPage />
              </RoleGuard>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
