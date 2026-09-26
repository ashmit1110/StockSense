import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Warehouse as WarehouseIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { warehouseService } from "@/services/warehouseService";
import type { Warehouse } from "@/types/domain";

export function WarehousesPage() {
  const navigate = useNavigate();
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: () => warehouseService.listWarehouses() });
  const columns: Column<Warehouse>[] = [
    { key: "name", header: "Warehouse", render: (row) => <span className="font-medium">{row.name}</span> },
    { key: "code", header: "Short Code", render: (row) => <span className="font-mono text-xs">{row.shortCode}</span> },
    { key: "address", header: "Address", render: (row) => row.address || <span className="text-muted">—</span> },
    { key: "locations", header: "Locations", render: (row) => row.locationCount },
  ];

  if (warehouses.isLoading) return <div className="grid gap-4"><PageHeader title="Warehouses" /><div className="panel-card p-6 text-sm text-muted">Loading warehouses…</div></div>;
  if (warehouses.isError) return <div className="grid gap-4"><PageHeader title="Warehouses" /><ErrorState message={toAppError(warehouses.error).message} onRetry={() => void warehouses.refetch()} /></div>;
  if (!warehouses.data) return <div className="grid gap-4"><PageHeader title="Warehouses" /><div className="panel-card p-6 text-sm text-muted">Loading warehouses…</div></div>;
  return (
    <>
      <PageHeader title="Warehouses" description="Manage warehouse names, unique short codes, and addresses." action={<Button onClick={() => navigate("/settings/warehouses/new")}><Plus size={16} />New warehouse</Button>} />
      {warehouses.data.length ? <DataTable columns={columns} rows={warehouses.data} onRowClick={(row) => navigate(`/settings/warehouses/${row.id}`)} rowLabel={(row) => `Edit ${row.name}`} /> : (
        <EmptyState title="No warehouses yet" description="Create a warehouse before adding its locations." action={<Button onClick={() => navigate("/settings/warehouses/new")}><WarehouseIcon size={16} />New warehouse</Button>} />
      )}
    </>
  );
}
