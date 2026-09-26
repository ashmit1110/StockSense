import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LayoutGrid, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { LoadingState } from "@/components/shared/LoadingState";
import { OperationStatusBadge } from "@/components/shared/OperationStatus";
import { PageHeader } from "@/components/shared/PageHeader";
import { Field, SelectInput, TextInput } from "@/components/shared/FormControls";
import { queryKeys } from "@/lib/queryKeys";
import { formatDate, formatQuantity } from "@/lib/formatters";
import { toAppError } from "@/lib/errors";
import { locationService } from "@/services/locationService";
import { operationService, type OperationFilters } from "@/services/operationService";
import { warehouseService } from "@/services/warehouseService";
import type { OperationListItem } from "@/types/domain";
import type { OperationStatus } from "@/types/database.types";
import type { OperationConfig } from "./operationConfig";

const statuses: { value: OperationStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All statuses" }, { value: "DRAFT", label: "Draft" }, { value: "WAITING", label: "Waiting" },
  { value: "READY", label: "Ready" }, { value: "DONE", label: "Done" }, { value: "CANCELED", label: "Canceled" },
];

export function OperationListPage({ config }: { config: OperationConfig }) {
  const navigate = useNavigate();
  const [view, setView] = useState<"list" | "kanban">("list");
  const [filters, setFilters] = useState<OperationFilters>({ status: "ALL" });
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: () => warehouseService.listWarehouses() });
  const locations = useQuery({ queryKey: queryKeys.locations.list(filters.warehouseId), queryFn: () => locationService.listLocations({ warehouseId: filters.warehouseId }) });
  const operations = useQuery({ queryKey: queryKeys.operations.list(config.type, filters), queryFn: () => operationService.listOperations(config.type, filters) });
  const setFilter = <K extends keyof OperationFilters>(key: K, value: OperationFilters[K]) => setFilters((current) => ({ ...current, [key]: value || undefined }));

  const columns: Column<OperationListItem>[] = [
    { key: "reference", header: "Reference", render: (row) => <span className="font-medium text-ink">{row.reference}</span> },
    { key: "date", header: "Scheduled Date", render: (row) => formatDate(row.scheduledDate) },
    { key: "contact", header: "Contact", render: (row) => row.partnerName || "—" },
    { key: "from", header: "From", render: (row) => row.sourceLocation?.name ?? "—" },
    { key: "to", header: "To", render: (row) => row.destinationLocation?.name ?? "—" },
    { key: "quantity", header: "Quantity", render: (row) => row.quantitySummary.length ? <span className="grid gap-1">{row.quantitySummary.map((line, index) => <span key={`${line.productName}-${index}`} className="text-xs">{line.productName}: {formatQuantity(line.quantity, line.unitOfMeasure)}</span>)}</span> : "—" },
    { key: "status", header: "Status", render: (row) => <OperationStatusBadge status={row.status} /> },
  ];

  const open = (row: OperationListItem) => navigate(`/operations/${config.segment}/${row.id}`);
  const createPath = `/operations/${config.segment}/new`;

  return (
    <>
      <PageHeader title={config.title} description={`Search and manage ${config.title.toLowerCase()} through the shared operation workflow.`} action={<Button asChild><Link to={createPath}><Plus size={16} />New {config.singular}</Link></Button>} />
      <Card className="mb-5">
        <CardContent className="grid gap-3 pt-5 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_10rem_12rem_12rem_12rem_auto]">
          <Field label="Search reference or contact" id="operation-search"><TextInput id="operation-search" placeholder="Reference, vendor, or customer" value={filters.search ?? ""} onChange={(event) => setFilter("search", event.target.value)} /></Field>
          <Field label="Status" id="operation-status"><SelectInput id="operation-status" value={filters.status ?? "ALL"} onChange={(event) => setFilter("status", event.target.value as OperationStatus | "ALL")}><option value="ALL">All statuses</option>{statuses.slice(1).map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</SelectInput></Field>
          <Field label="Warehouse" id="operation-warehouse"><SelectInput id="operation-warehouse" value={filters.warehouseId ?? ""} onChange={(event) => { setFilter("warehouseId", event.target.value); setFilter("locationId", undefined); }}><option value="">All warehouses</option>{(warehouses.data ?? []).map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</SelectInput></Field>
          <Field label="Location" id="operation-location"><SelectInput id="operation-location" value={filters.locationId ?? ""} onChange={(event) => setFilter("locationId", event.target.value)}><option value="">All locations</option>{(locations.data ?? []).map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</SelectInput></Field>
          <Field label="Scheduled date" id="operation-date"><TextInput id="operation-date" type="date" value={filters.scheduledDate ?? ""} onChange={(event) => setFilter("scheduledDate", event.target.value)} /></Field>
          <div className="flex items-end gap-1" role="group" aria-label="Operation list view">
            <Button variant={view === "list" ? "secondary" : "outline"} size="sm" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={15} />List</Button>
            <Button variant={view === "kanban" ? "secondary" : "outline"} size="sm" aria-pressed={view === "kanban"} onClick={() => setView("kanban")}><LayoutGrid size={15} />Kanban</Button>
          </div>
        </CardContent>
      </Card>
      {operations.isLoading ? <LoadingState label={`Loading ${config.title.toLowerCase()}`} /> : operations.isError ? <ErrorState message={toAppError(operations.error).message} onRetry={() => void operations.refetch()} /> : operations.data?.length ? (
        view === "list" ? <DataTable columns={columns} rows={operations.data} onRowClick={open} rowLabel={(row) => `Open ${row.reference}`} /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {statuses.slice(1).map((status) => {
              const cards = operations.data?.filter((operation) => operation.status === status.value) ?? [];
              return <section key={status.value} className="min-h-48 rounded-2xl border border-line bg-white/[.02] p-3" aria-label={`${status.label} operations`}>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold">{status.label}</h2><span className="text-xs text-muted">{cards.length}</span></div>
                <div className="grid gap-2">{cards.map((card) => <button key={card.id} type="button" onClick={() => open(card)} className="rounded-xl border border-line bg-panel p-3 text-left transition hover:border-accent/50"><span className="text-sm font-medium">{card.reference}</span><span className="mt-1 block truncate text-xs text-muted">{card.partnerName || "No contact"}</span><span className="mt-2 flex items-center justify-between text-xs text-muted">{formatDate(card.scheduledDate)}<span>{card.lineCount} products</span></span></button>)}</div>
              </section>;
            })}
          </div>
        )
      ) : <EmptyState title={`No ${config.title.toLowerCase()} found`} description="Create an operation or adjust your search and filters." action={<Button asChild size="sm"><Link to={createPath}><Plus size={15} />New {config.singular}</Link></Button>} />}
    </>
  );
}
