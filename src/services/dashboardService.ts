import type { Json } from "@/types/database.types";
import type { DashboardSummary } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

function object(value: Json | undefined, field: string): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Dashboard response is missing ${field}.`);
  return value as Record<string, Json>;
}

function count(value: Json | undefined, field: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Dashboard response contains an invalid ${field}.`);
  return parsed;
}

export const dashboardService = {
  async getDashboardSummary(): Promise<DashboardSummary> {
    try {
      const { data, error } = await getSupabaseClient().rpc("get_dashboard_summary");
      if (error) throw error;
      const response = object(data, "summary");
      const receipts = object(response.receipts, "receipt counts");
      const deliveries = object(response.deliveries, "delivery counts");
      return {
        receipts: {
          openCount: count(receipts.openCount, "receipt open count"),
          lateCount: count(receipts.lateCount, "receipt late count"),
          waitingCount: count(receipts.waitingCount, "receipt waiting count"),
        },
        deliveries: {
          openCount: count(deliveries.openCount, "delivery open count"),
          lateCount: count(deliveries.lateCount, "delivery late count"),
          waitingCount: count(deliveries.waitingCount, "delivery waiting count"),
        },
        totalProducts: count(response.totalProducts, "active product count"),
        totalStock: count(response.totalStock, "stock total"),
        lowStockItems: count(response.lowStockItems, "low-stock count"),
        outOfStockItems: count(response.outOfStockItems, "out-of-stock count"),
        pendingReceipts: count(response.pendingReceipts, "pending receipt count"),
        pendingDeliveries: count(response.pendingDeliveries, "pending delivery count"),
        scheduledTransfers: count(response.scheduledTransfers, "scheduled transfer count"),
      };
    } catch (error) {
      throw toAppError(error);
    }
  },
};
