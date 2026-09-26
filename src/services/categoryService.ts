import { toAppError } from "@/lib/errors";
import type { Category } from "@/types/domain";
import { getSupabaseClient } from "./supabaseClient";

function mapCategory(row: { id: string; name: string }): Category {
  return { id: row.id, name: row.name };
}

export const categoryService = {
  async listCategories(): Promise<Category[]> {
    try {
      const { data, error } = await getSupabaseClient().from("categories").select("id, name").order("name");
      if (error) throw error;
      return data.map(mapCategory);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async createCategory(name: string): Promise<Category> {
    try {
      const { data, error } = await getSupabaseClient().from("categories").insert({ name: name.trim() }).select("id, name").single();
      if (error) throw error;
      return mapCategory(data);
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateCategory(id: string, name: string): Promise<Category> {
    try {
      const { data, error } = await getSupabaseClient().from("categories").update({ name: name.trim() }).eq("id", id).select("id, name").single();
      if (error) throw error;
      return mapCategory(data);
    } catch (error) {
      throw toAppError(error);
    }
  },
};
