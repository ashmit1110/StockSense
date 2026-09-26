import type { Location, LocationSummary } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

type LocationInput = { name: string; shortCode: string; warehouseId: string };
const select = "id, name, short_code, warehouse_id";

function mapSummary(row: { id: string; name: string; short_code: string; warehouse_id: string }, warehouse: { name: string; short_code?: string }): LocationSummary {
  return { id: row.id, name: row.name, shortCode: row.short_code, warehouseId: row.warehouse_id, warehouseName: warehouse.name, warehouseShortCode: warehouse.short_code };
}

function safeSearch(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

export const locationService = {
  async listLocations(filters: { warehouseId?: string; search?: string } = {}): Promise<LocationSummary[]> {
    try {
      const client = getSupabaseClient();
      let query = client.from("locations").select(select).order("name");
      if (filters.warehouseId) query = query.eq("warehouse_id", filters.warehouseId);
      if (filters.search?.trim()) {
        const term = safeSearch(filters.search);
        query = query.or(`name.ilike.%${term}%,short_code.ilike.%${term}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      const warehouseIds = [...new Set(data.map((row) => row.warehouse_id))];
      const warehouses = warehouseIds.length
        ? await client.from("warehouses").select("id, name, short_code").in("id", warehouseIds)
        : { data: [], error: null };
      if (warehouses.error) throw warehouses.error;
      const byId = new Map(warehouses.data.map((row) => [row.id, row]));
      return data.map((row) => mapSummary(row, byId.get(row.warehouse_id) ?? { name: "Unknown warehouse" }));
    } catch (error) {
      throw toAppError(error);
    }
  },

  async getLocation(id: string): Promise<Location> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from("locations").select(select).eq("id", id).single();
      if (error) throw error;
      const warehouseResult = await client.from("warehouses").select("name, short_code").eq("id", data.warehouse_id).single();
      if (warehouseResult.error) throw warehouseResult.error;
      const stockResult = await client.from("stock_with_free_to_use")
        .select("product_id, product_name, sku, on_hand, free_to_use")
        .eq("location_id", id)
        .order("product_name");
      if (stockResult.error) throw stockResult.error;
      return {
        ...mapSummary(data, warehouseResult.data),
        stockRows: stockResult.data.map((row) => ({ productId: row.product_id, productName: row.product_name, sku: row.sku, onHand: Number(row.on_hand), freeToUse: Number(row.free_to_use) })),
      };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async createLocation(input: LocationInput): Promise<LocationSummary> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from("locations").insert({
        name: input.name.trim(), short_code: input.shortCode.trim().toUpperCase(), warehouse_id: input.warehouseId,
      }).select(select).single();
      if (error) throw error;
      const warehouse = await client.from("warehouses").select("name, short_code").eq("id", data.warehouse_id).single();
      if (warehouse.error) throw warehouse.error;
      return mapSummary(data, warehouse.data);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateLocation(id: string, input: LocationInput): Promise<LocationSummary> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from("locations").update({
        name: input.name.trim(), short_code: input.shortCode.trim().toUpperCase(), warehouse_id: input.warehouseId,
      }).eq("id", id).select(select).single();
      if (error) throw error;
      const warehouse = await client.from("warehouses").select("name, short_code").eq("id", data.warehouse_id).single();
      if (warehouse.error) throw warehouse.error;
      return mapSummary(data, warehouse.data);
    } catch (error) {
      throw toAppError(error);
    }
  },
};
