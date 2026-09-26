import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function AuthLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 text-ink">
      <div className="flex items-center gap-3 rounded-xl border border-line bg-panel px-5 py-4 text-sm text-muted" role="status">
        <span className="size-4 animate-spin rounded-full border-2 border-accent border-r-transparent" />
        Restoring your session…
      </div>
    </main>
  );
}

export function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <AuthLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function PublicOnlyRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <AuthLoading />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
