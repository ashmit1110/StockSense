import { AlertCircle, PackageOpen, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="panel-card flex flex-col items-start gap-3 border-red-400/30 p-6" role="alert">
      <div className="flex items-center gap-2 text-red-200"><AlertCircle size={18} /> Could not load this information</div>
      <p className="text-sm text-muted">{message}</p>
      {onRetry && <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw size={14} />Try again</Button>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="panel-card flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <PackageOpen className="mb-3 text-muted" size={24} aria-hidden="true" />
      <h2 className="font-medium">{title}</h2>
      <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
