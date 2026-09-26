import type { Warehouse, LocationSummary } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

type WarehouseInput = { name: string; shortCode: string; address?: string | null };
const select = "id, name, short_code, address";

function mapWarehouse(row: { id: string; name: string; short_code: string; address: string | null }, locationCount = 0): Warehouse {
  return { id: row.id, name: row.name, shortCode: row.short_code, address: row.address, locationCount };
}

function mapLocation(row: { id: string; name: string; short_code: string; warehouse_id: string }, warehouse: { name: string; short_code: string }): LocationSummary {
  return { id: row.id, name: row.name, shortCode: row.short_code, warehouseId: row.warehouse_id, warehouseName: warehouse.name, warehouseShortCode: warehouse.short_code };
}

export const warehouseService = {
  async listWarehouses(): Promise<Warehouse[]> {
    try {
      const client = getSupabaseClient();
      const [warehouseResult, locationResult] = await Promise.all([
        client.from("warehouses").select(select).order("name"),
        client.from("locations").select("warehouse_id"),
      ]);
      if (warehouseResult.error) throw warehouseResult.error;
      if (locationResult.error) throw locationResult.error;
      const counts = new Map<string, number>();
      for (const row of locationResult.data) counts.set(row.warehouse_id, (counts.get(row.warehouse_id) ?? 0) + 1);
      return warehouseResult.data.map((row) => mapWarehouse(row, counts.get(row.id) ?? 0));
    } catch (error) {
      throw toAppError(error);
    }
  },

  async getWarehouse(id: string): Promise<Warehouse & { locations: LocationSummary[] }> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from("warehouses").select(select).eq("id", id).single();
      if (error) throw error;
      const locations = await client.from("locations").select("id, name, short_code, warehouse_id").eq("warehouse_id", id).order("name");
      if (locations.error) throw locations.error;
      return {
        ...mapWarehouse(data, locations.data.length),
        locations: locations.data.map((row) => mapLocation(row, { name: data.name, short_code: data.short_code })),
      };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async createWarehouse(input: WarehouseInput): Promise<Warehouse> {
    try {
      const { data, error } = await getSupabaseClient().from("warehouses").insert({
        name: input.name.trim(), short_code: input.shortCode.trim().toUpperCase(), address: input.address?.trim() || null,
      }).select(select).single();
      if (error) throw error;
      return mapWarehouse(data);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateWarehouse(id: string, input: WarehouseInput): Promise<Warehouse> {
    try {
      const { data, error } = await getSupabaseClient().from("warehouses").update({
        name: input.name.trim(), short_code: input.shortCode.trim().toUpperCase(), address: input.address?.trim() || null,
      }).eq("id", id).select(select).single();
      if (error) throw error;
      return mapWarehouse(data);
    } catch (error) {
      throw toAppError(error);
    }
  },
};
