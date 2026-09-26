export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div className="panel-card flex items-center gap-3 p-6 text-sm text-muted" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-accent border-r-transparent" />
      {label}…
    </div>
  );
}
