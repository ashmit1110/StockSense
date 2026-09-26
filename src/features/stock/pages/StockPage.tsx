import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { PageHeader } from "@/components/shared/PageHeader";
import { UpdateStockDialog } from "../components/UpdateStockDialog";
import { categoryService } from "@/services/categoryService";
import { locationService } from "@/services/locationService";
import { stockService } from "@/services/stockService";
import { warehouseService } from "@/services/warehouseService";
import { formatCurrency, formatQuantity } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import type { StockItem } from "@/types/domain";

export function StockPage() {
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const filters = useMemo(() => ({ search: search.trim() || undefined, warehouseId: warehouseId || undefined, locationId: locationId || undefined, categoryId: categoryId || undefined, page: 1, pageSize: 100 }), [search, warehouseId, locationId, categoryId]);
  const stock = useQuery({ queryKey: queryKeys.stock.list(filters), queryFn: () => stockService.listStock(filters) });
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: () => warehouseService.listWarehouses() });
  const locations = useQuery({ queryKey: queryKeys.locations.list(warehouseId || undefined), queryFn: () => locationService.listLocations({ warehouseId: warehouseId || undefined }) });
  const categories = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.listCategories() });

  const columns: Column<StockItem>[] = [
    { key: "product", header: "Product", render: (row) => <div><p className="font-medium">{row.productName}</p><p className="mt-0.5 text-xs text-muted">{row.sku}</p></div> },
    { key: "cost", header: "Per Unit Cost", render: (row) => formatCurrency(row.unitCost) },
    { key: "location", header: "Location", render: (row) => <div><p>{row.locationName}</p><p className="mt-0.5 text-xs text-muted">{row.warehouseName}</p></div> },
    { key: "onHand", header: "On Hand", render: (row) => formatQuantity(row.onHand) },
    { key: "free", header: "Free to Use", render: (row) => <span className={row.freeToUse <= 0 && row.onHand > 0 ? "text-amber-200" : ""}>{formatQuantity(row.freeToUse)}</span> },
    { key: "action", header: "", className: "text-right", render: (row) => <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setNotice(null); setSelected(row); }}>Update Stock</Button> },
  ];

  if (stock.isLoading || warehouses.isLoading || locations.isLoading || categories.isLoading) return <div className="grid gap-4"><PageHeader title="Stock" /><div className="panel-card p-6 text-sm text-muted">Loading stock…</div></div>;
  if (stock.isError) return <div className="grid gap-4"><PageHeader title="Stock" /><ErrorState message={toAppError(stock.error).message} onRetry={() => void stock.refetch()} /></div>;
  if (warehouses.isError || locations.isError || categories.isError) return <div className="grid gap-4"><PageHeader title="Stock" /><ErrorState message={toAppError(warehouses.error ?? locations.error ?? categories.error).message} onRetry={() => { void warehouses.refetch(); void locations.refetch(); void categories.refetch(); }} /></div>;
  if (!stock.data || !warehouses.data || !locations.data || !categories.data) return <div className="grid gap-4"><PageHeader title="Stock" /><div className="panel-card p-6 text-sm text-muted">Loading stock…</div></div>;

  return (
    <>
      <PageHeader title="Stock" description="On-hand and free-to-use quantities come from the backend stock view." />
      {notice && <p className="mb-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100" role="status">{notice}</p>}
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-52 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} /><input className="h-10 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-none" placeholder="Search product or SKU" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <select aria-label="Filter by warehouse" className="h-10 min-w-44 rounded-lg border border-line bg-panel px-3 text-sm" value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setLocationId(""); }}><option value="">All warehouses</option>{warehouses.data.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select aria-label="Filter by location" className="h-10 min-w-44 rounded-lg border border-line bg-panel px-3 text-sm" value={locationId} onChange={(event) => setLocationId(event.target.value)}><option value="">All locations</option>{locations.data.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
        <select aria-label="Filter by category" className="h-10 min-w-44 rounded-lg border border-line bg-panel px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.data.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
      </div>
      {stock.data.items.length ? <DataTable columns={columns} rows={stock.data.items} /> : <EmptyState title="No stock rows" description="There are no balance rows matching these filters. A stock balance appears after an operation or stock adjustment." />}
      <p className="mt-3 text-xs text-muted">{stock.data.total} stock row{stock.data.total === 1 ? "" : "s"}</p>
      <UpdateStockDialog item={selected} onClose={() => setSelected(null)} onSaved={(message) => setNotice(message)} />
    </>
  );
}
