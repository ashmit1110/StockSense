import type { OperationStatus } from "@/types/database.types";

const statusClass: Record<OperationStatus, string> = {
  DRAFT: "border-slate-300/20 bg-slate-300/10 text-slate-200",
  WAITING: "border-amber-300/30 bg-amber-400/10 text-amber-200",
  READY: "border-sky-300/30 bg-sky-400/10 text-sky-200",
  DONE: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
  CANCELED: "border-red-300/30 bg-red-400/10 text-red-200",
};

const statusLabel: Record<OperationStatus, string> = {
  DRAFT: "Draft",
  WAITING: "Waiting",
  READY: "Ready",
  DONE: "Done",
  CANCELED: "Canceled",
};

export function OperationStatusBadge({ status }: { status: OperationStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass[status]}`}>{statusLabel[status]}</span>;
}

export function OperationStatusStepper({ status, flow }: { status: OperationStatus; flow: OperationStatus[] }) {
  if (status === "CANCELED") return <div className="rounded-lg border border-red-300/20 bg-red-400/5 px-3 py-2"><OperationStatusBadge status={status} /></div>;
  const activeIndex = flow.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={`Operation status: ${statusLabel[status]}`}>
      {flow.map((step, index) => (
        <li key={step} className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs ${index === activeIndex ? statusClass[step] : index < activeIndex ? "border-emerald-300/15 bg-emerald-400/5 text-emerald-200/70" : "border-line bg-white/[.025] text-muted"}`} aria-current={index === activeIndex ? "step" : undefined}>
            {statusLabel[step]}
          </span>
          {index < flow.length - 1 && <span className="text-muted/60" aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}
