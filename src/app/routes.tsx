import { createBrowserRouter, Link, Navigate, Outlet } from "react-router-dom";
import { AppHeader } from "../components/shared/AppHeader";
import { AuthLoading, ProtectedRoute, PublicOnlyRoute } from "../components/shared/ProtectedRoute";
import { Button } from "../components/ui/Button";
import { useAuth } from "../contexts/AuthContext";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { SignupPage } from "../features/auth/pages/SignupPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";
import { ProductsPage } from "../features/products/pages/ProductsPage";
import { ProductFormPage } from "../features/products/pages/ProductFormPage";
import { StockPage } from "../features/stock/pages/StockPage";
import { WarehousesPage } from "../features/settings/pages/WarehousesPage";
import { WarehouseFormPage } from "../features/settings/pages/WarehouseFormPage";
import { LocationsPage } from "../features/settings/pages/LocationsPage";
import { LocationFormPage } from "../features/settings/pages/LocationFormPage";
import { OperationListPage } from "../features/operations/shared/OperationListPage";
import { OperationFormPage } from "../features/operations/shared/OperationFormPage";
import { operationConfigs } from "../features/operations/shared/operationConfig";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { MoveHistoryPage } from "../features/move-history/MoveHistoryPage";
import { ProfilePage } from "../features/profile/ProfilePage";

function AppShell() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

function NotFoundPage() {
  return (
    <section className="panel-card p-6 sm:p-8">
      <p className="eyebrow">StockSense</p>
      <h1 className="mt-2 text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">That StockSense page does not exist.</p>
      <Button asChild className="mt-5"><Link to="/dashboard">Back to Dashboard</Link></Button>
    </section>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <RootRedirect />,
  },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/signup", element: <SignupPage /> },
      { path: "/forgot-password", element: <ForgotPasswordPage /> },
    ],
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard", element: <DashboardPage /> },
          { path: "/products", element: <ProductsPage /> },
          { path: "/products/new", element: <ProductFormPage /> },
          { path: "/products/:id", element: <ProductFormPage /> },
          { path: "/stock", element: <StockPage /> },
          { path: "/operations/receipts", element: <OperationListPage config={operationConfigs.receipts} /> },
          { path: "/operations/receipts/new", element: <OperationFormPage config={operationConfigs.receipts} /> },
          { path: "/operations/receipts/:id", element: <OperationFormPage config={operationConfigs.receipts} /> },
          { path: "/operations/deliveries", element: <OperationListPage config={operationConfigs.deliveries} /> },
          { path: "/operations/deliveries/new", element: <OperationFormPage config={operationConfigs.deliveries} /> },
          { path: "/operations/deliveries/:id", element: <OperationFormPage config={operationConfigs.deliveries} /> },
          { path: "/operations/transfers", element: <OperationListPage config={operationConfigs.transfers} /> },
          { path: "/operations/transfers/new", element: <OperationFormPage config={operationConfigs.transfers} /> },
          { path: "/operations/transfers/:id", element: <OperationFormPage config={operationConfigs.transfers} /> },
          { path: "/operations/adjustments", element: <OperationListPage config={operationConfigs.adjustments} /> },
          { path: "/operations/adjustments/new", element: <OperationFormPage config={operationConfigs.adjustments} /> },
          { path: "/operations/adjustments/:id", element: <OperationFormPage config={operationConfigs.adjustments} /> },
          { path: "/move-history", element: <MoveHistoryPage /> },
          { path: "/settings/warehouses", element: <WarehousesPage /> },
          { path: "/settings/warehouses/new", element: <WarehouseFormPage /> },
          { path: "/settings/warehouses/:id", element: <WarehouseFormPage /> },
          { path: "/settings/locations", element: <LocationsPage /> },
          { path: "/settings/locations/new", element: <LocationFormPage /> },
          { path: "/settings/locations/:id", element: <LocationFormPage /> },
          { path: "/profile", element: <ProfilePage /> },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
