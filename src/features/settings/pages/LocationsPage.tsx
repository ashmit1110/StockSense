import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { locationService } from "@/services/locationService";
import { warehouseService } from "@/services/warehouseService";
import type { LocationSummary } from "@/types/domain";

export function LocationsPage() {
  const navigate = useNavigate();
  const [warehouseId, setWarehouseId] = useState("");
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: () => warehouseService.listWarehouses() });
  const locations = useQuery({ queryKey: queryKeys.locations.list(warehouseId || undefined), queryFn: () => locationService.listLocations({ warehouseId: warehouseId || undefined }) });
  const columns: Column<LocationSummary>[] = [
    { key: "name", header: "Location", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "code", header: "Short Code", render: (row) => <span className="font-mono text-xs">{row.shortCode}</span> },
    { key: "warehouse", header: "Warehouse", render: (row) => row.warehouseName },
  ];
  if (warehouses.isLoading || locations.isLoading) return <div className="grid gap-4"><PageHeader title="Locations" /><div className="panel-card p-6 text-sm text-muted">Loading locations…</div></div>;
  if (warehouses.isError) return <div className="grid gap-4"><PageHeader title="Locations" /><ErrorState message={toAppError(warehouses.error).message} onRetry={() => void warehouses.refetch()} /></div>;
  if (locations.isError) return <div className="grid gap-4"><PageHeader title="Locations" /><ErrorState message={toAppError(locations.error).message} onRetry={() => void locations.refetch()} /></div>;
  if (!warehouses.data || !locations.data) return <div className="grid gap-4"><PageHeader title="Locations" /><div className="panel-card p-6 text-sm text-muted">Loading locations…</div></div>;
  return (
    <>
      <PageHeader title="Locations" description="Each location belongs to one warehouse; short codes are unique within that warehouse." action={<Button onClick={() => navigate("/settings/locations/new")} disabled={!warehouses.data.length}><Plus size={16} />New location</Button>} />
      <div className="mb-4"><select aria-label="Filter locations by warehouse" className="h-10 min-w-56 rounded-lg border border-line bg-panel px-3 text-sm" value={warehouseId} onChange={(event) => setWarehouseId(event.target.value)}><option value="">All warehouses</option>{warehouses.data.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select></div>
      {locations.data.length ? <DataTable columns={columns} rows={locations.data} onRowClick={(row) => navigate(`/settings/locations/${row.id}`)} rowLabel={(row) => `Edit ${row.name}`} /> : <EmptyState title="No locations yet" description={warehouseId ? "Create a location in this warehouse." : "Create a warehouse first, then add its locations."} action={warehouses.data.length ? <Button onClick={() => navigate("/settings/locations/new")}><Plus size={16} />New location</Button> : undefined} />}
    </>
  );
}
