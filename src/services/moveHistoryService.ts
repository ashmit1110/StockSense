import type { MovementType, OperationStatus, OperationType } from "@/types/database.types";
import type { MoveHistoryRow } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

export type MoveHistoryFilters = {
  search?: string;
  status?: OperationStatus | "ALL";
  operationType?: OperationType | "ALL";
  movementType?: MovementType | "ALL";
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
};

function safeSearch(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

function nextDay(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export const moveHistoryService = {
  async listMoveHistory(filters: MoveHistoryFilters = {}): Promise<{ items: MoveHistoryRow[]; total: number }> {
    try {
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
      let query = getSupabaseClient().from("move_history")
        .select("ledger_id, operation_id, reference, date, contact, product_id, product_name, product_sku, quantity_change, movement_type, status, operation_type, from_location_name, to_location_name", { count: "exact" })
        .order("date", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
      if (filters.operationType && filters.operationType !== "ALL") query = query.eq("operation_type", filters.operationType);
      if (filters.movementType && filters.movementType !== "ALL") query = query.eq("movement_type", filters.movementType);
      if (filters.dateFrom) query = query.gte("date", `${filters.dateFrom}T00:00:00.000Z`);
      if (filters.dateTo) query = query.lt("date", `${nextDay(filters.dateTo)}T00:00:00.000Z`);
      if (filters.search?.trim()) {
        const term = safeSearch(filters.search);
        query = query.or(`reference.ilike.%${term}%,contact.ilike.%${term}%`);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      return {
        items: data.map((row) => ({
          id: row.ledger_id,
          ledgerId: row.ledger_id,
          operationId: row.operation_id,
          reference: row.reference,
          date: row.date,
          contact: row.contact,
          from: row.from_location_name,
          to: row.to_location_name,
          productId: row.product_id,
          productName: row.product_name,
          sku: row.product_sku,
          quantity: Number(row.quantity_change),
          status: row.status,
          movementType: row.movement_type,
          operationType: row.operation_type,
        })),
        total: count ?? 0,
      };
    } catch (error) {
      throw toAppError(error);
    }
  },
};
