export const queryKeys = {
  profile: { all: ["profile"] as const, detail: (id: string) => ["profile", id] as const },
  categories: { all: ["categories"] as const },
  products: {
    all: ["products"] as const,
    list: (filters: unknown) => ["products", "list", filters] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  warehouses: { all: ["warehouses"] as const, detail: (id: string) => ["warehouses", id] as const },
  locations: { all: ["locations"] as const, list: (warehouseId?: string) => ["locations", "list", warehouseId] as const, detail: (id: string) => ["locations", id] as const },
  stock: { all: ["stock"] as const, list: (filters: unknown) => ["stock", filters] as const },
  operations: { all: ["operations"] as const, list: (type: string, filters: unknown) => ["operations", type, filters] as const, detail: (id: string) => ["operations", "detail", id] as const },
  dashboard: { all: ["dashboard"] as const },
  moveHistory: { all: ["move-history"] as const, list: (filters: unknown) => ["move-history", filters] as const },
};
