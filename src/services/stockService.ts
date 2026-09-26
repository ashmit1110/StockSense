import type { Json } from "@/types/database.types";
import type { StockItem, StockUpdateResult } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

export type StockFilters = {
  search?: string;
  warehouseId?: string;
  locationId?: string;
  categoryId?: string;
  page?: number;
  pageSize?: number;
};

function safeSearch(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

function mapStockUpdate(value: Json): StockUpdateResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stock update response was not an object.");
  const payload = value as Record<string, Json>;
  const stock = payload.stock;
  if (!stock || typeof stock !== "object" || Array.isArray(stock)) throw new Error("Stock update response is missing stock values.");
  const values = stock as Record<string, Json>;
  if (typeof values.productId !== "string" || typeof values.locationId !== "string") throw new Error("Stock update response is missing product or location IDs.");
  return {
    operation: payload.operation ?? null,
    stock: {
      productId: values.productId,
      locationId: values.locationId,
      onHand: Number(values.onHand ?? 0),
      freeToUse: Number(values.freeToUse ?? 0),
    },
  };
}

export const stockService = {
  async listStock(filters: StockFilters = {}): Promise<{ items: StockItem[]; total: number }> {
    try {
      const client = getSupabaseClient();
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
      let query = client.from("stock_with_free_to_use")
        .select("stock_balance_id, product_id, product_name, sku, unit_cost, category_id, category_name, location_id, location_name, warehouse_id, warehouse_name, on_hand, free_to_use", { count: "exact" })
        .order("product_name")
        .range((page - 1) * pageSize, page * pageSize - 1);
      if (filters.locationId) query = query.eq("location_id", filters.locationId);
      if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
      if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters.search?.trim()) {
        const term = safeSearch(filters.search);
        query = query.or(`product_name.ilike.%${term}%,sku.ilike.%${term}%`);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      const items = data.map((row) => ({
        id: row.stock_balance_id,
        productId: row.product_id,
        productName: row.product_name,
        sku: row.sku,
        locationId: row.location_id,
        locationName: row.location_name,
        warehouseId: row.warehouse_id,
        warehouseName: row.warehouse_name,
        categoryId: row.category_id,
        categoryName: row.category_name,
        unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
        onHand: Number(row.on_hand),
        freeToUse: Number(row.free_to_use),
      } satisfies StockItem));
      return { items, total: count ?? 0 };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateStockFromCount(input: { productId: string; locationId: string; physicalCount: number; reason?: string }): Promise<StockUpdateResult> {
    try {
      const { data, error } = await getSupabaseClient().rpc("update_stock_from_count", {
        p_product_id: input.productId,
        p_location_id: input.locationId,
        p_physical_count: input.physicalCount,
        p_reason: input.reason ?? null,
      });
      if (error) throw error;
      return mapStockUpdate(data);
    } catch (error) {
      throw toAppError(error);
    }
  },
};
