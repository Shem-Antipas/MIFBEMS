import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import PageLayout from "@/components/layout/PageLayout";
import ProtectedRoute from "@/router/ProtectedRoute";
import LoginPage from "@/pages/auth/LoginPage";
import ForgotPasswordPage from "@/pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/auth/ResetPasswordPage";
import DashboardPage from "@/pages/dashboard/DashboardPage";
import FarmersPage from "@/pages/farmers/FarmersPage";
import LicensesPage from "@/pages/licenses/LicensesPage";
import CaptureFisheriesPage from "@/pages/capture-fisheries/CaptureFisheriesPage";
import ProjectsPage from "@/pages/projects/ProjectsPage";
import InspectionsPage from "@/pages/inspections/InspectionsPage";
import ReportsPage from "@/pages/reports/ReportsPage";
import AnalyticsPage from "@/pages/analytics/AnalyticsPage";
import UsersPage from "@/pages/users/UsersPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import BackupsPage from "@/pages/admin/BackupsPage";
import MyFarmPage from "@/pages/farmer-portal/MyFarmPage";
import AdvisoriesPage from "@/pages/farmer-portal/AdvisoriesPage";
import QueriesPage from "@/pages/farmer-portal/QueriesPage";
import { allRoles } from "@/router/permissions";

const Unauthorized = () => (
  <div className="grid min-h-screen place-items-center bg-background p-6 text-center">
    <div className="rounded-xl border bg-card p-8">
      <h1 className="text-2xl font-semibold">Unauthorized</h1>
      <p className="mt-2 text-sm text-muted-foreground">You do not have access to this page.</p>
    </div>
  </div>
);

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/"
            element={
              <PageLayout>
                <Navigate to="/dashboard" replace />
              </PageLayout>
            }
          />

          <Route element={<ProtectedRoute allowedRoles={["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST"]} />}>
            <Route path="/dashboard" element={<PageLayout><DashboardPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST"]} />}>
            <Route path="/farmers" element={<PageLayout><FarmersPage /></PageLayout>} />
            <Route path="/capture-fisheries" element={<PageLayout><CaptureFisheriesPage /></PageLayout>} />
            <Route path="/projects" element={<PageLayout><ProjectsPage /></PageLayout>} />
            <Route path="/inspections" element={<PageLayout><InspectionsPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["DIRECTOR", "FISHERIES_OFFICER", "DATA_ANALYST", "ADMIN"]} />}>
            <Route path="/licenses" element={<PageLayout><LicensesPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["DIRECTOR", "DATA_ANALYST"]} />}>
            <Route path="/reports" element={<PageLayout><ReportsPage /></PageLayout>} />
            <Route path="/analytics" element={<PageLayout><AnalyticsPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["DIRECTOR", "ADMIN"]} />}>
            <Route path="/users" element={<PageLayout><UsersPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={allRoles} />}>
            <Route path="/settings" element={<PageLayout><SettingsPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route path="/admin/backups" element={<PageLayout><BackupsPage /></PageLayout>} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["FARMER"]} />}>
            <Route path="/farmer/my-farm" element={<PageLayout><MyFarmPage /></PageLayout>} />
            <Route path="/farmer/advisories" element={<PageLayout><AdvisoriesPage /></PageLayout>} />
            <Route path="/farmer/queries" element={<PageLayout><QueriesPage /></PageLayout>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
