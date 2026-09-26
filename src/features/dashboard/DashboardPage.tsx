import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Clock3, History, RefreshCw, Warehouse } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/shared/FeedbackState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { OperationStatusBadge } from "@/components/shared/OperationStatus";
import { formatDateTime, formatQuantity } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { dashboardService } from "@/services/dashboardService";
import { moveHistoryService } from "@/services/moveHistoryService";
import type { MoveHistoryRow } from "@/types/domain";
import type { OperationType } from "@/types/database.types";

const operationSegments: Record<OperationType, string> = { RECEIPT: "receipts", DELIVERY: "deliveries", TRANSFER: "transfers", ADJUSTMENT: "adjustments" };

function RecentMovement({ row }: { row: MoveHistoryRow }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line/70 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <Link to={`/operations/${operationSegments[row.operationType]}/${row.operationId}`} className="text-sm font-medium text-accent hover:underline">{row.reference}</Link>
        <p className="mt-0.5 truncate text-xs text-muted">{row.productName} · {row.sku}{row.contact ? ` · ${row.contact}` : ""}</p>
        <p className="mt-0.5 text-xs text-muted">{row.from || "—"} <span aria-hidden="true">→</span> {row.to || "—"}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold tabular-nums ${row.quantity >= 0 ? "text-emerald-200" : "text-red-200"}`}>{row.quantity > 0 ? "+" : ""}{formatQuantity(row.quantity)}</span>
        <OperationStatusBadge status={row.status} />
      </div>
      <time className="w-full text-right text-xs text-muted sm:w-auto">{formatDateTime(row.date)}</time>
    </li>
  );
}

export function DashboardPage() {
  const summary = useQuery({ queryKey: queryKeys.dashboard.all, queryFn: () => dashboardService.getDashboardSummary() });
  const recent = useQuery({ queryKey: queryKeys.moveHistory.list({ dashboard: "recent", pageSize: 6 }), queryFn: () => moveHistoryService.listMoveHistory({ page: 1, pageSize: 6 }) });

  return (
    <>
      <PageHeader title="Dashboard" description="Keep upcoming receipts, deliveries, and stock movements in view." action={<Button variant="outline" size="sm" onClick={() => { void summary.refetch(); void recent.refetch(); }}><RefreshCw size={15} />Refresh</Button>} />
      {summary.isLoading ? <LoadingState label="Loading dashboard" /> : summary.isError ? <ErrorState message={toAppError(summary.error).message} onRetry={() => void summary.refetch()} /> : summary.data ? (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card className="border-accent/25">
              <CardHeader><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><ArrowDownToLine size={19} /></span><div><CardTitle>Receipt</CardTitle><p className="mt-0.5 text-sm text-muted">Inbound stock operations</p></div></div></CardHeader>
              <CardContent>
                <Button asChild className="min-h-12 w-full justify-between"><Link to="/operations/receipts?open=true"><span className="flex items-center gap-2"><Boxes size={16} />To Receive</span><span className="rounded-full bg-black/15 px-2.5 py-1 tabular-nums" aria-label={`${summary.data.receipts.openCount} open receipts`}>{summary.data.receipts.openCount}</span></Link></Button>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-white/[.02] px-3 py-2.5 text-sm"><span className="flex items-center gap-2 text-muted"><Clock3 size={15} />Late</span><strong className={summary.data.receipts.lateCount ? "text-amber-200" : "text-ink"}>{summary.data.receipts.lateCount}</strong></div>
              </CardContent>
            </Card>

            <Card className="border-accent/25">
              <CardHeader><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><ArrowUpFromLine size={19} /></span><div><CardTitle>Delivery</CardTitle><p className="mt-0.5 text-sm text-muted">Outbound stock operations</p></div></div></CardHeader>
              <CardContent>
                <Button asChild className="min-h-12 w-full justify-between"><Link to="/operations/deliveries?open=true"><span className="flex items-center gap-2"><Boxes size={16} />To Deliver</span><span className="rounded-full bg-black/15 px-2.5 py-1 tabular-nums" aria-label={`${summary.data.deliveries.openCount} open deliveries`}>{summary.data.deliveries.openCount}</span></Link></Button>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-line bg-white/[.02] px-3 py-2.5 text-sm"><span className="flex items-center gap-2 text-muted"><Clock3 size={15} />Late</span><strong className={summary.data.deliveries.lateCount ? "text-amber-200" : "text-ink"}>{summary.data.deliveries.lateCount}</strong></div>
                  <div className="flex items-center justify-between rounded-lg border border-line bg-white/[.02] px-3 py-2.5 text-sm"><span className="text-muted">Waiting</span><strong className={summary.data.deliveries.waitingCount ? "text-amber-200" : "text-ink"}>{summary.data.deliveries.waitingCount}</strong></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,.62fr)]">
            <Card>
              <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Recent stock movements</CardTitle><p className="mt-1 text-sm text-muted">Latest entries from the ledger history view.</p></div><Button asChild variant="ghost" size="sm"><Link to="/move-history"><History size={15} />Move History</Link></Button></CardHeader>
              <CardContent>
                {recent.isLoading ? <p className="py-6 text-sm text-muted">Loading recent movements…</p> : recent.isError ? <div className="py-3"><ErrorState message={toAppError(recent.error).message} onRetry={() => void recent.refetch()} /></div> : recent.data?.items.length ? <ul className="divide-y divide-line/70">{recent.data.items.map((row) => <RecentMovement key={row.id} row={row} />)}</ul> : <p className="py-6 text-sm text-muted">No stock movements yet.</p>}
              </CardContent>
            </Card>
            <Card className="flex flex-col justify-between">
              <CardHeader><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-accent/10 text-accent"><Warehouse size={19} /></span><div><CardTitle>Available stock</CardTitle><p className="mt-0.5 text-sm text-muted">Browse inventory by product and location.</p></div></div></CardHeader>
              <CardContent><p className="mb-4 text-sm text-muted">{summary.data.totalProducts} active products in the catalog.</p><Button asChild variant="outline" className="w-full"><Link to="/stock"><Boxes size={16} />Open Stock</Link></Button></CardContent>
            </Card>
          </div>
        </>
      ) : <LoadingState label="Loading dashboard" />}
    </>
  );
}
