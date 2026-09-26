import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { AppHeader } from "../components/shared/AppHeader";
import { AuthLoading, ProtectedRoute, PublicOnlyRoute } from "../components/shared/ProtectedRoute";
import { useAuth } from "../contexts/AuthContext";
import { LoginPage } from "../features/auth/pages/LoginPage";
import { SignupPage } from "../features/auth/pages/SignupPage";
import { ForgotPasswordPage } from "../features/auth/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/pages/ResetPasswordPage";

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

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="panel-card p-6 sm:p-8">
      <p className="eyebrow">StockSense</p>
      <h1 className="mt-2 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        This screen is being connected to the inventory services.
      </p>
    </section>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

const placeholder = (title: string) => <PlaceholderPage title={title} />;

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
          { path: "/dashboard", element: placeholder("Dashboard") },
          { path: "/products", element: placeholder("Products") },
          { path: "/products/new", element: placeholder("New product") },
          { path: "/products/:id", element: placeholder("Product details") },
          { path: "/stock", element: placeholder("Stock") },
          { path: "/operations/receipts", element: placeholder("Receipts") },
          { path: "/operations/receipts/new", element: placeholder("New receipt") },
          { path: "/operations/receipts/:id", element: placeholder("Receipt details") },
          { path: "/operations/deliveries", element: placeholder("Deliveries") },
          { path: "/operations/deliveries/new", element: placeholder("New delivery") },
          { path: "/operations/deliveries/:id", element: placeholder("Delivery details") },
          { path: "/operations/transfers", element: placeholder("Transfers") },
          { path: "/operations/transfers/new", element: placeholder("New transfer") },
          { path: "/operations/transfers/:id", element: placeholder("Transfer details") },
          { path: "/operations/adjustments", element: placeholder("Adjustments") },
          { path: "/operations/adjustments/new", element: placeholder("New adjustment") },
          { path: "/operations/adjustments/:id", element: placeholder("Adjustment details") },
          { path: "/move-history", element: placeholder("Move History") },
          { path: "/settings/warehouses", element: placeholder("Warehouses") },
          { path: "/settings/warehouses/new", element: placeholder("New warehouse") },
          { path: "/settings/warehouses/:id", element: placeholder("Warehouse details") },
          { path: "/settings/locations", element: placeholder("Locations") },
          { path: "/settings/locations/new", element: placeholder("New location") },
          { path: "/settings/locations/:id", element: placeholder("Location details") },
          { path: "/profile", element: placeholder("My profile") },
          { path: "*", element: placeholder("Page not found") },
        ],
      },
    ],
  },
]);
