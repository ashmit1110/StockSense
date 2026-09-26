import type { Json, OperationStatus, OperationType } from "@/types/database.types";
import type { LocationSummary, OperationDetail, OperationLine, OperationListItem, Shortage, ValidationResult } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

export type OperationFilters = {
  search?: string;
  status?: OperationStatus | "ALL";
  openOnly?: boolean;
  locationId?: string;
  warehouseId?: string;
  scheduledDate?: string;
};

export type OperationInput = {
  type: OperationType;
  scheduledDate: string;
  responsibleUserId: string | null;
  partnerName: string | null;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  reason: string | null;
  lines: { productId: string; quantity: number }[];
};

const operationSelect = "id, type, reference, status, scheduled_date, responsible_user_id, partner_name, source_location_id, destination_location_id, reason, validated_at, canceled_at, created_by, created_at, updated_at";

function safeSearch(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

function getObject(value: Json, message: string): Record<string, Json> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value as Record<string, Json>;
}

function responseId(value: Json): string {
  const id = getObject(value, "The operation service returned an invalid response.").id;
  if (typeof id !== "string") throw new Error("The operation response did not include an operation ID.");
  return id;
}

function parseShortages(value: Json): Shortage[] {
  const payload = getObject(value, "The validation response was not an object.");
  if (!Array.isArray(payload.shortages)) return [];
  return payload.shortages.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Json>;
    if (typeof row.productId !== "string" || typeof row.productName !== "string" || typeof row.sku !== "string") return [];
    return [{ productId: row.productId, productName: row.productName, sku: row.sku, requested: Number(row.requested), available: Number(row.available) }];
  });
}

export const operationService = {
  async listOperations(type: OperationType, filters: OperationFilters = {}): Promise<OperationListItem[]> {
    try {
      const client = getSupabaseClient();
      let locationIds: string[] | null = null;
      if (filters.warehouseId) {
        const { data, error } = await client.from("locations").select("id").eq("warehouse_id", filters.warehouseId);
        if (error) throw error;
        locationIds = data.map((row) => row.id);
        if (locationIds.length === 0) return [];
      }

      let query = client.from("operations").select(operationSelect).eq("type", type).order("scheduled_date", { ascending: false }).order("created_at", { ascending: false });
      if (filters.openOnly) query = query.in("status", ["DRAFT", "WAITING", "READY"]);
      else if (filters.status && filters.status !== "ALL") query = query.eq("status", filters.status);
      if (filters.scheduledDate) query = query.eq("scheduled_date", filters.scheduledDate);
      const locationExpressions = filters.locationId
        ? [`source_location_id.eq.${filters.locationId}`, `destination_location_id.eq.${filters.locationId}`]
        : locationIds ? [`source_location_id.in.(${locationIds.join(",")})`, `destination_location_id.in.(${locationIds.join(",")})`] : [];
      let searchExpressions: string[] = [];
      if (filters.search?.trim()) {
        const term = safeSearch(filters.search);
        searchExpressions = [`reference.ilike.%${term}%`, `partner_name.ilike.%${term}%`];
      }
      if (locationExpressions.length && searchExpressions.length) {
        const searchFilter = `or(${searchExpressions.join(",")})`;
        query = query.or(`and(${locationExpressions[0]},${searchFilter}),and(${locationExpressions[1]},${searchFilter})`);
      } else if (locationExpressions.length) {
        query = query.or(locationExpressions.join(","));
      } else if (searchExpressions.length) {
        query = query.or(searchExpressions.join(","));
      }
      const { data, error } = await query;
      if (error) throw error;
      if (!data.length) return [];

      const opIds = data.map((row) => row.id);
      const locationIdSet = [...new Set(data.flatMap((row) => [row.source_location_id, row.destination_location_id].filter((id): id is string => Boolean(id))))];
      const profileIds = [...new Set(data.flatMap((row) => row.responsible_user_id ? [row.responsible_user_id] : []))];
      const [linesResult, locationsResult, profilesResult] = await Promise.all([
        client.from("operation_lines").select("operation_id, product_id, quantity").in("operation_id", opIds),
        locationIdSet.length ? client.from("locations").select("id, name, short_code, warehouse_id").in("id", locationIdSet) : Promise.resolve({ data: [], error: null }),
        profileIds.length ? client.from("profiles").select("id, display_name").in("id", profileIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (linesResult.error) throw linesResult.error;
      if (locationsResult.error) throw locationsResult.error;
      if (profilesResult.error) throw profilesResult.error;
      const productIds = [...new Set(linesResult.data.map((row) => row.product_id))];
      const productsResult = productIds.length ? await client.from("products").select("id, name, unit_of_measure").in("id", productIds) : { data: [], error: null };
      if (productsResult.error) throw productsResult.error;
      const warehouseIds = [...new Set(locationsResult.data.map((row) => row.warehouse_id))];
      const warehousesResult = warehouseIds.length ? await client.from("warehouses").select("id, name, short_code").in("id", warehouseIds) : { data: [], error: null };
      if (warehousesResult.error) throw warehousesResult.error;

      const warehouses = new Map(warehousesResult.data.map((row) => [row.id, row]));
      const locations = new Map<string, LocationSummary>(locationsResult.data.map((row) => {
        const warehouse = warehouses.get(row.warehouse_id);
        return [row.id, { id: row.id, name: row.name, shortCode: row.short_code, warehouseId: row.warehouse_id, warehouseName: warehouse?.name ?? "Unknown warehouse", warehouseShortCode: warehouse?.short_code }];
      }));
      const profiles = new Map(profilesResult.data.map((row) => [row.id, row.display_name]));
      const products = new Map(productsResult.data.map((row) => [row.id, row]));
      const lineCounts = new Map<string, number>();
      const quantitySummaries = new Map<string, OperationListItem["quantitySummary"]>();
      for (const line of linesResult.data) {
        lineCounts.set(line.operation_id, (lineCounts.get(line.operation_id) ?? 0) + 1);
        const product = products.get(line.product_id);
        const summary = quantitySummaries.get(line.operation_id) ?? [];
        summary.push({ productName: product?.name ?? "Unknown product", quantity: Number(line.quantity), unitOfMeasure: product?.unit_of_measure ?? "" });
        quantitySummaries.set(line.operation_id, summary);
      }
      return data.map((row) => ({
        id: row.id,
        type: row.type,
        reference: row.reference,
        status: row.status,
        scheduledDate: row.scheduled_date,
        responsibleUser: row.responsible_user_id ? { id: row.responsible_user_id, displayName: profiles.get(row.responsible_user_id) ?? "Unknown user" } : null,
        sourceLocation: row.source_location_id ? locations.get(row.source_location_id) ?? null : null,
        destinationLocation: row.destination_location_id ? locations.get(row.destination_location_id) ?? null : null,
        partnerName: row.partner_name,
        lineCount: lineCounts.get(row.id) ?? 0,
        quantitySummary: quantitySummaries.get(row.id) ?? [],
      }));
    } catch (error) {
      throw toAppError(error);
    }
  },

  async getOperation(id: string): Promise<OperationDetail> {
    try {
      const client = getSupabaseClient();
      const { data: row, error } = await client.from("operations").select(operationSelect).eq("id", id).single();
      if (error) throw error;

      const [lineResult, locationResult, profileResult] = await Promise.all([
        client.from("operation_lines").select("id, product_id, quantity, line_number").eq("operation_id", id).order("line_number"),
        (() => {
          const ids = [row.source_location_id, row.destination_location_id].filter((value): value is string => Boolean(value));
          return ids.length ? client.from("locations").select("id, name, short_code, warehouse_id").in("id", ids) : Promise.resolve({ data: [], error: null });
        })(),
        row.responsible_user_id ? client.from("profiles").select("id, display_name").eq("id", row.responsible_user_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      ]);
      if (lineResult.error) throw lineResult.error;
      if (locationResult.error) throw locationResult.error;
      if (profileResult.error) throw profileResult.error;

      const productIds = [...new Set(lineResult.data.map((line) => line.product_id))];
      const productsResult = productIds.length ? await client.from("products").select("id, name, sku").in("id", productIds) : { data: [], error: null };
      if (productsResult.error) throw productsResult.error;
      const productMap = new Map(productsResult.data.map((product) => [product.id, product]));

      const warehouseIds = [...new Set(locationResult.data.map((location) => location.warehouse_id))];
      const warehousesResult = warehouseIds.length ? await client.from("warehouses").select("id, name, short_code").in("id", warehouseIds) : { data: [], error: null };
      if (warehousesResult.error) throw warehousesResult.error;
      const warehouseMap = new Map(warehousesResult.data.map((warehouse) => [warehouse.id, warehouse]));
      const locationMap = new Map<string, LocationSummary>(locationResult.data.map((location) => {
        const warehouse = warehouseMap.get(location.warehouse_id);
        return [location.id, { id: location.id, name: location.name, shortCode: location.short_code, warehouseId: location.warehouse_id, warehouseName: warehouse?.name ?? "Unknown warehouse", warehouseShortCode: warehouse?.short_code }];
      }));

      let freeToUse = new Map<string, number>();
      if ((row.type === "DELIVERY" || row.type === "TRANSFER") && row.source_location_id && productIds.length) {
        const availability = await client.from("stock_with_free_to_use").select("product_id, free_to_use").eq("location_id", row.source_location_id).in("product_id", productIds);
        if (availability.error) throw availability.error;
        freeToUse = new Map(availability.data.map((stock) => [stock.product_id, Number(stock.free_to_use)]));
      }

      const lines: OperationLine[] = lineResult.data.map((line) => {
        const product = productMap.get(line.product_id);
        return {
          id: line.id,
          productId: line.product_id,
          productName: product?.name ?? "Unknown product",
          sku: product?.sku ?? "—",
          quantity: Number(line.quantity),
          lineNumber: line.line_number,
          ...((row.type === "DELIVERY" || row.type === "TRANSFER") ? { freeToUseAtSource: freeToUse.get(line.product_id) ?? 0 } : {}),
        };
      });

      return {
        id: row.id,
        type: row.type,
        reference: row.reference,
        status: row.status,
        scheduledDate: row.scheduled_date,
        responsibleUser: profileResult.data ? { id: profileResult.data.id, displayName: profileResult.data.display_name } : null,
        sourceLocation: row.source_location_id ? locationMap.get(row.source_location_id) ?? null : null,
        destinationLocation: row.destination_location_id ? locationMap.get(row.destination_location_id) ?? null : null,
        partnerName: row.partner_name,
        reason: row.reason,
        lines,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        validatedAt: row.validated_at,
        canceledAt: row.canceled_at,
        createdBy: row.created_by,
      };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async createOperation(input: OperationInput): Promise<OperationDetail> {
    try {
      const { data, error } = await getSupabaseClient().rpc("create_operation", {
        p_type: input.type,
        p_lines: input.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
        p_partner_name: input.partnerName,
        p_scheduled_date: input.scheduledDate,
        p_responsible_user_id: input.responsibleUserId,
        p_source_location_id: input.sourceLocationId,
        p_destination_location_id: input.destinationLocationId,
        p_reason: input.reason,
      });
      if (error) throw error;
      return await this.getOperation(responseId(data));
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateOperation(id: string, input: OperationInput): Promise<OperationDetail> {
    try {
      const { error } = await getSupabaseClient().rpc("update_operation", {
        p_operation_id: id,
        p_lines: input.lines.map((line) => ({ product_id: line.productId, quantity: line.quantity })),
        p_partner_name: input.partnerName,
        p_scheduled_date: input.scheduledDate,
        p_responsible_user_id: input.responsibleUserId,
        p_source_location_id: input.sourceLocationId,
        p_destination_location_id: input.destinationLocationId,
        p_reason: input.reason,
      });
      if (error) throw error;
      return await this.getOperation(id);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async markReady(id: string): Promise<OperationDetail> {
    try {
      const { error } = await getSupabaseClient().rpc("mark_operation_ready", { p_operation_id: id });
      if (error) throw error;
      return await this.getOperation(id);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async cancelOperation(id: string): Promise<OperationDetail> {
    try {
      const { error } = await getSupabaseClient().rpc("cancel_operation", { p_operation_id: id });
      if (error) throw error;
      return await this.getOperation(id);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async validateOperation(id: string): Promise<ValidationResult> {
    try {
      const { data, error } = await getSupabaseClient().rpc("validate_operation", { p_operation_id: id });
      if (error) throw error;
      const shortages = parseShortages(data);
      const operation = await this.getOperation(id);
      if (operation.status === "WAITING") return { operation: { ...operation, status: "WAITING" }, shortages };
      return { operation, shortages: [] };
    } catch (error) {
      throw toAppError(error);
    }
  },
};
