import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { Field, SelectInput, TextInput } from "@/components/shared/FormControls";
import { OperationStatusBadge } from "@/components/shared/OperationStatus";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDateTime, formatQuantity } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { moveHistoryService, type MoveHistoryFilters } from "@/services/moveHistoryService";
import type { MoveHistoryRow } from "@/types/domain";
import type { OperationStatus, OperationType } from "@/types/database.types";

const statuses: OperationStatus[] = ["DRAFT", "WAITING", "READY", "DONE", "CANCELED"];
const operationTypes: OperationType[] = ["RECEIPT", "DELIVERY", "TRANSFER", "ADJUSTMENT"];
const routeSegment: Record<OperationType, string> = { RECEIPT: "receipts", DELIVERY: "deliveries", TRANSFER: "transfers", ADJUSTMENT: "adjustments" };

function operationPath(row: MoveHistoryRow) {
  return `/operations/${routeSegment[row.operationType]}/${row.operationId}`;
}

export function MoveHistoryPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filters, setFilters] = useState<MoveHistoryFilters>({ status: "ALL", operationType: "ALL", page: 1, pageSize: 50 });
  const history = useQuery({ queryKey: queryKeys.moveHistory.list(filters), queryFn: () => moveHistoryService.listMoveHistory(filters) });
  const setFilter = <K extends keyof MoveHistoryFilters>(key: K, value: MoveHistoryFilters[K]) => setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }));

  const columns: Column<MoveHistoryRow>[] = [
    { key: "reference", header: "Reference", render: (row) => <Link className="font-medium text-accent hover:underline" to={operationPath(row)} onClick={(event) => event.stopPropagation()}>{row.reference}</Link> },
    { key: "date", header: "Date", render: (row) => formatDateTime(row.date) },
    { key: "contact", header: "Contact", render: (row) => row.contact || "—" },
    { key: "from", header: "From", render: (row) => row.from || "—" },
    { key: "to", header: "To", render: (row) => row.to || "—" },
    { key: "quantity", header: "Quantity", render: (row) => <span className="grid gap-0.5" aria-label={`${row.quantity >= 0 ? "Incoming" : "Outgoing"} ${formatQuantity(row.quantity)} for ${row.productName}`}><span className={`font-semibold tabular-nums ${row.quantity >= 0 ? "text-emerald-200" : "text-red-200"}`}>{row.quantity > 0 ? "+" : ""}{formatQuantity(row.quantity)}</span><span className="text-xs text-muted">{row.productName} · {row.sku} · {row.movementType.replaceAll("_", " ")}</span></span> },
    { key: "status", header: "Status", render: (row) => <OperationStatusBadge status={row.status} /> },
  ];

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const total = history.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const setPage = (next: number) => setFilters((current) => ({ ...current, page: next }));
  const open = (row: MoveHistoryRow) => navigate(operationPath(row));

  return (
    <>
      <PageHeader title="Move History" description="Immutable stock ledger entries with their source operations and locations." />
      <Card className="mb-5">
        <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_11rem_11rem_12rem_12rem_auto]">
          <Field label="Search reference or contact" id="history-search"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} /><TextInput id="history-search" className="pl-9" placeholder="Reference or contact" value={filters.search ?? ""} onChange={(event) => setFilter("search", event.target.value)} /></div></Field>
          <Field label="Operation type" id="history-operation-type"><SelectInput id="history-operation-type" value={filters.operationType ?? "ALL"} onChange={(event) => setFilter("operationType", event.target.value as OperationType | "ALL")}><option value="ALL">All operations</option>{operationTypes.map((type) => <option key={type} value={type}>{type.charAt(0) + type.slice(1).toLowerCase()}</option>)}</SelectInput></Field>
          <Field label="Status" id="history-status"><SelectInput id="history-status" value={filters.status ?? "ALL"} onChange={(event) => setFilter("status", event.target.value as OperationStatus | "ALL")}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{status.charAt(0) + status.slice(1).toLowerCase()}</option>)}</SelectInput></Field>
          <Field label="From date" id="history-date-from"><TextInput id="history-date-from" type="date" value={filters.dateFrom ?? ""} onChange={(event) => setFilter("dateFrom", event.target.value)} /></Field>
          <Field label="To date" id="history-date-to"><TextInput id="history-date-to" type="date" value={filters.dateTo ?? ""} onChange={(event) => setFilter("dateTo", event.target.value)} /></Field>
          <div className="flex items-end gap-1" role="group" aria-label="Move history view">
            <Button variant={view === "list" ? "secondary" : "outline"} size="sm" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} />List</Button>
            <Button variant={view === "kanban" ? "secondary" : "outline"} size="sm" aria-pressed={view === "kanban"} onClick={() => setView("kanban")}><LayoutGrid size={15} />Kanban</Button>
          </div>
        </CardContent>
      </Card>
      {history.isLoading ? <LoadingState label="Loading move history" /> : history.isError ? <ErrorState message={toAppError(history.error).message} onRetry={() => void history.refetch()} /> : history.data?.items.length ? (
        <>
          {view === "list" ? <DataTable columns={columns} rows={history.data.items} onRowClick={open} rowLabel={(row) => `Open ${row.reference} for ${row.productName}`} /> : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {statuses.map((status) => {
                const rows = history.data?.items.filter((row) => row.status === status) ?? [];
                return <section key={status} className="min-h-48 rounded-2xl border border-line bg-white/[.02] p-3" aria-label={`${status} ledger movements`}>
                  <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{status.charAt(0) + status.slice(1).toLowerCase()}</h2><span className="text-xs text-muted">{rows.length}</span></div>
                  <div className="grid gap-2">{rows.map((row) => <button key={row.id} type="button" onClick={() => open(row)} className="rounded-xl border border-line bg-panel p-3 text-left transition hover:border-accent/50"><span className="text-sm font-medium text-accent">{row.reference}</span><span className="mt-1 block truncate text-xs text-muted">{row.productName} · {row.sku}</span><span className={`mt-2 block text-sm font-semibold ${row.quantity >= 0 ? "text-emerald-200" : "text-red-200"}`}>{row.quantity > 0 ? "+" : ""}{formatQuantity(row.quantity)} · {row.movementType.replaceAll("_", " ")}</span><span className="mt-1 block text-xs text-muted">{formatDateTime(row.date)}</span></button>)}</div>
                </section>;
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
            <span>Showing {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} ledger rows</span>
            <div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="flex items-center px-1">Page {page} of {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button></div>
          </div>
        </>
      ) : <EmptyState title="No movements found" description="Ledger entries appear here after a stock operation changes inventory. Adjust your search or date filters." />}
    </>
  );
}
