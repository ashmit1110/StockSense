import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, Search, Tags } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/Dialog";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { Field, TextInput } from "@/components/shared/FormControls";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import type { Category, Product } from "@/types/domain";
import { categoryService } from "@/services/categoryService";
import { productService } from "@/services/productService";

const categorySchema = z.object({ name: z.string().trim().min(1, "Enter a category name.") });
type CategoryForm = z.infer<typeof categorySchema>;

function CategoryManager({ categories }: { categories: Category[] }) {
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema), defaultValues: { name: "" } });

  const saveCategory = useMutation({
    mutationFn: (name: string) => renaming ? categoryService.updateCategory(renaming.id, name) : categoryService.createCategory(name),
    onSuccess: async () => {
      setError(null);
      setRenaming(null);
      reset({ name: "" });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]);
    },
    onError: (reason: unknown) => setError(toAppError(reason).message),
  });

  const submit = handleSubmit(async ({ name }) => { try { await saveCategory.mutateAsync(name); } catch { /* the mutation renders its centralized error */ } });

  return (
    <Dialog onOpenChange={(open) => { if (!open) { setRenaming(null); reset({ name: "" }); setError(null); } }}>
      <DialogTrigger asChild><Button variant="outline"><Tags size={16} />Manage categories</Button></DialogTrigger>
      <DialogContent>
        <DialogTitle>Categories</DialogTitle>
        <DialogDescription>Categories help filter products. Category names must be unique.</DialogDescription>
        <form className="mt-5 grid gap-3" onSubmit={submit}>
          <Field label={renaming ? "Rename category" : "New category"} error={errors.name?.message} id="category-name">
            <TextInput id="category-name" autoFocus {...register("name")} />
          </Field>
          {error && <p className="text-sm text-red-200" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            {renaming && <Button type="button" variant="ghost" onClick={() => { setRenaming(null); reset({ name: "" }); }}>Cancel rename</Button>}
            <Button type="submit" disabled={isSubmitting || saveCategory.isPending}>{isSubmitting || saveCategory.isPending ? "Saving…" : renaming ? "Save category" : "Add category"}</Button>
          </div>
        </form>
        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Existing categories</p>
          {categories.length === 0 ? <p className="text-sm text-muted">No categories yet.</p> : (
            <ul className="grid gap-1">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
                  <span>{category.name}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setRenaming(category); reset({ name: category.name }); }}>Rename</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ProductsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const filters = useMemo(() => ({ search: search.trim() || undefined, categoryId: categoryId || undefined, page: 1, pageSize: 50 }), [search, categoryId]);
  const products = useQuery({ queryKey: queryKeys.products.list(filters), queryFn: () => productService.listProducts(filters) });
  const categories = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.listCategories() });

  const columns: Column<Product>[] = [
    { key: "product", header: "Product", render: (row) => <div><p className="font-medium text-ink">{row.name}</p><p className="mt-0.5 text-xs text-muted">{row.sku}</p></div> },
    { key: "category", header: "Category", render: (row) => row.categoryName || <span className="text-muted">—</span> },
    { key: "unit", header: "Unit", render: (row) => row.unitOfMeasure },
    { key: "stock", header: "On Hand by Location", render: (row) => row.stockByLocation?.length ? <div className="flex max-w-md flex-wrap gap-1.5">{row.stockByLocation.map((stock) => <span className="rounded-md border border-line px-2 py-1 text-xs" key={stock.locationId}>{stock.locationName}: {stock.onHand}</span>)}</div> : <span className="text-muted">No balance recorded</span> },
    { key: "active", header: "State", render: (row) => <span className={row.isActive ? "text-emerald-300" : "text-muted"}>{row.isActive ? "Active" : "Inactive"}</span> },
  ];

  if (products.isLoading || categories.isLoading) return <div className="grid gap-4"><PageHeader title="Products" /><div className="panel-card p-6 text-sm text-muted">Loading products…</div></div>;
  if (products.isError) return <div className="grid gap-4"><PageHeader title="Products" /><ErrorState message={toAppError(products.error).message} onRetry={() => void products.refetch()} /></div>;
  if (categories.isError) return <div className="grid gap-4"><PageHeader title="Products" /><ErrorState message={toAppError(categories.error).message} onRetry={() => void categories.refetch()} /></div>;
  if (!products.data || !categories.data) return <div className="grid gap-4"><PageHeader title="Products" /><div className="panel-card p-6 text-sm text-muted">Loading products…</div></div>;

  return (
    <>
      <PageHeader title="Products" description="Manage products, categories, and stock visibility." action={<div className="flex flex-wrap gap-2"><CategoryManager categories={categories.data} /><Button onClick={() => navigate("/products/new")}><Plus size={16} />New product</Button></div>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
          <input className="h-10 w-full rounded-lg border border-line bg-panel pl-9 pr-3 text-sm text-ink placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-none" placeholder="Search name or SKU" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        <select aria-label="Filter products by category" className="h-10 min-w-48 rounded-lg border border-line bg-panel px-3 text-sm" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">All categories</option>
          {categories.data.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
        </select>
      </div>
      {products.data.items.length ? (
        <DataTable columns={columns} rows={products.data.items} onRowClick={(row) => navigate(`/products/${row.id}`)} rowLabel={(row) => `Open ${row.name}`} />
      ) : (
        <EmptyState title={search || categoryId ? "No matching products" : "No products yet"} description={search || categoryId ? "Try another search or category." : "Create a product to begin tracking stock."} action={!search && !categoryId ? <Button onClick={() => navigate("/products/new")}><Plus size={16} />New product</Button> : undefined} />
      )}
      <p className="mt-3 text-xs text-muted">{products.data.total} product{products.data.total === 1 ? "" : "s"}</p>
    </>
  );
}
