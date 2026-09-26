import type { Json } from "@/types/database.types";
import type { Product } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

export type ProductFilters = { search?: string; categoryId?: string; page?: number; pageSize?: number };
export type ProductInput = {
  name: string;
  sku: string;
  categoryId: string | null;
  unitOfMeasure: string;
  reorderLevel: number;
  unitCost: number | null;
  initialStock?: { locationId: string | null; quantity: number };
};

const productSelect = "id, name, sku, category_id, unit_of_measure, reorder_level, unit_cost, is_active";

function mapProduct(row: {
  id: string; name: string; sku: string; category_id: string | null; categoryName?: string | null;
  unit_of_measure: string; reorder_level: number; unit_cost: number | null; is_active: boolean;
}): Product {
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    categoryId: row.category_id,
    categoryName: row.categoryName ?? null,
    unitOfMeasure: row.unit_of_measure,
    reorderLevel: Number(row.reorder_level),
    unitCost: row.unit_cost === null ? null : Number(row.unit_cost),
    isActive: row.is_active,
  };
}

function safeSearch(value: string) {
  return value.replace(/[(),]/g, " ").trim();
}

function mapStockByLocation(value: Json): Product["stockByLocation"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, Json>;
    if (typeof row.locationId !== "string" || typeof row.locationName !== "string") return [];
    return [{ locationId: row.locationId, locationName: row.locationName, onHand: Number(row.onHand ?? 0) }];
  });
}

async function mapProductsWithRelations(rows: Array<{
  id: string; name: string; sku: string; category_id: string | null; unit_of_measure: string;
  reorder_level: number; unit_cost: number | null; is_active: boolean;
}>): Promise<Product[]> {
  if (rows.length === 0) return [];
  const client = getSupabaseClient();
  const categoryIds = [...new Set(rows.flatMap((row) => row.category_id ? [row.category_id] : []))];
  const productIds = rows.map((row) => row.id);
  const [categoryResult, stockResult] = await Promise.all([
    categoryIds.length
      ? client.from("categories").select("id, name").in("id", categoryIds)
      : Promise.resolve({ data: [], error: null }),
    client.from("stock_with_free_to_use").select("product_id, location_id, location_name, on_hand").in("product_id", productIds),
  ]);
  if (categoryResult.error) throw categoryResult.error;
  if (stockResult.error) throw stockResult.error;

  const categories = new Map(categoryResult.data.map((category) => [category.id, category.name]));
  const stockByProduct = new Map<string, NonNullable<Product["stockByLocation"]>>();
  for (const row of stockResult.data) {
    const list = stockByProduct.get(row.product_id) ?? [];
    list.push({ locationId: row.location_id, locationName: row.location_name, onHand: Number(row.on_hand) });
    stockByProduct.set(row.product_id, list);
  }

  return rows.map((row) => ({
    ...mapProduct({ ...row, categoryName: row.category_id ? categories.get(row.category_id) ?? null : null }),
    stockByLocation: stockByProduct.get(row.id) ?? [],
  }));
}

export const productService = {
  async listProducts(filters: ProductFilters = {}): Promise<{ items: Product[]; total: number }> {
    try {
      const client = getSupabaseClient();
      const page = Math.max(1, filters.page ?? 1);
      const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
      let query = client.from("products").select(productSelect, { count: "exact" }).order("name").range((page - 1) * pageSize, page * pageSize - 1);
      if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
      if (filters.search?.trim()) {
        const term = safeSearch(filters.search);
        query = query.or(`name.ilike.%${term}%,sku.ilike.%${term}%`);
      }
      const { data, error, count } = await query;
      if (error) throw error;
      return { items: await mapProductsWithRelations(data), total: count ?? 0 };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async getProduct(id: string): Promise<Product> {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.from("products").select(productSelect).eq("id", id).single();
      if (error) throw error;
      const category = data.category_id
        ? await client.from("categories").select("name").eq("id", data.category_id).maybeSingle()
        : { data: null, error: null };
      if (category.error) throw category.error;
      const [stockResult] = await Promise.all([client.rpc("get_product_stock", { p_product_id: id })]);
      if (stockResult.error) throw stockResult.error;
      return { ...mapProduct({ ...data, categoryName: category.data?.name ?? null }), stockByLocation: mapStockByLocation(stockResult.data) };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async createProduct(input: ProductInput): Promise<Product> {
    try {
      const { data, error } = await getSupabaseClient().rpc("create_product_with_initial_stock", {
        p_name: input.name.trim(),
        p_sku: input.sku.trim(),
        p_category_id: input.categoryId,
        p_unit_of_measure: input.unitOfMeasure.trim() || "pcs",
        p_reorder_level: input.reorderLevel,
        p_unit_cost: input.unitCost,
        p_location_id: input.initialStock?.quantity ? input.initialStock.locationId : null,
        p_initial_stock: input.initialStock?.quantity ?? 0,
      });
      if (error) throw error;
      return mapProductFromRpc(data);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateProduct(id: string, input: Omit<ProductInput, "initialStock">): Promise<Product> {
    try {
      const { data, error } = await getSupabaseClient().from("products").update({
        name: input.name.trim(),
        sku: input.sku.trim(),
        category_id: input.categoryId,
        unit_of_measure: input.unitOfMeasure.trim() || "pcs",
        reorder_level: input.reorderLevel,
        unit_cost: input.unitCost,
      }).eq("id", id).select(productSelect).single();
      if (error) throw error;
      return mapProduct(data);
    } catch (error) {
      throw toAppError(error);
    }
  },
};

function mapProductFromRpc(value: Json): Product {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Product response was not an object.");
  const row = value as Record<string, Json>;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.sku !== "string") throw new Error("Product response is missing required fields.");
  return mapProduct({
    id: row.id,
    name: row.name,
    sku: row.sku,
    category_id: typeof row.categoryId === "string" ? row.categoryId : null,
    unit_of_measure: typeof row.unitOfMeasure === "string" ? row.unitOfMeasure : "pcs",
    reorder_level: Number(row.reorderLevel ?? 0),
    unit_cost: row.unitCost === null || row.unitCost === undefined ? null : Number(row.unitCost),
    is_active: row.isActive === true,
  });
}
