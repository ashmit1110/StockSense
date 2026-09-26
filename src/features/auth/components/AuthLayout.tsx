import type { ReactNode } from "react";
import { Package2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuth } from "@/contexts/AuthContext";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  const { isConfigured } = useAuth();

  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4 py-10 text-ink">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 flex items-center justify-center gap-2.5 text-sm font-semibold tracking-wide">
          <span className="grid size-9 place-items-center rounded-xl bg-accent text-white"><Package2 size={19} /></span>
          StockSense
        </Link>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">{title}</CardTitle>
            <p className="text-sm text-muted">{description}</p>
          </CardHeader>
          <CardContent>
            {!isConfigured && (
              <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-200" role="alert">
                Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code> and add the project URL and anon key.
              </div>
            )}
            {children}
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted">Inventory operations with a clear audit trail.</p>
      </div>
    </main>
  );
}
