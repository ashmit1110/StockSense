import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ErrorState } from "@/components/shared/FeedbackState";
import { Field, SelectInput, TextInput } from "@/components/shared/FormControls";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { categoryService } from "@/services/categoryService";
import { locationService } from "@/services/locationService";
import { productService } from "@/services/productService";
import type { Product } from "@/types/domain";

const schema = z.object({
  name: z.string().trim().min(1, "Enter a product name."),
  sku: z.string().trim().min(1, "Enter an SKU."),
  categoryId: z.string(),
  unitOfMeasure: z.string().trim().min(1, "Enter a unit of measure."),
  reorderLevel: z.coerce.number().finite().min(0, "Reorder level cannot be negative."),
  unitCost: z.union([z.literal(""), z.coerce.number().finite().min(0, "Cost cannot be negative.")]),
  initialStock: z.coerce.number().finite().min(0, "Initial stock cannot be negative."),
  initialLocationId: z.string(),
}).refine((values) => values.initialStock === 0 || Boolean(values.initialLocationId), {
  path: ["initialLocationId"], message: "Choose a location for initial stock.",
});
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function ProductFormPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: queryKeys.categories.all, queryFn: () => categoryService.listCategories() });
  const locations = useQuery({ queryKey: queryKeys.locations.list(), queryFn: () => locationService.listLocations() });
  const product = useQuery({ queryKey: queryKeys.products.detail(id ?? ""), queryFn: () => productService.getProduct(id!), enabled: isEditing });
  const defaults = useMemo<FormInput>(() => ({ name: "", sku: "", categoryId: "", unitOfMeasure: "pcs", reorderLevel: "0", unitCost: "", initialStock: "0", initialLocationId: "" }), []);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: defaults });

  useEffect(() => {
    if (!product.data) return;
    reset({
      name: product.data.name,
      sku: product.data.sku,
      categoryId: product.data.categoryId ?? "",
      unitOfMeasure: product.data.unitOfMeasure,
      reorderLevel: String(product.data.reorderLevel),
      unitCost: product.data.unitCost === null ? "" : String(product.data.unitCost),
      initialStock: "0",
      initialLocationId: "",
    });
  }, [product.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      const input = {
        name: values.name,
        sku: values.sku,
        categoryId: values.categoryId || null,
        unitOfMeasure: values.unitOfMeasure,
        reorderLevel: values.reorderLevel,
        unitCost: values.unitCost === "" ? null : Number(values.unitCost),
      };
      return isEditing
        ? productService.updateProduct(id!, input)
        : productService.createProduct({ ...input, initialStock: { locationId: values.initialLocationId || null, quantity: values.initialStock } });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
      navigate(isEditing ? `/products/${saved.id}` : `/products/${saved.id}`, { replace: true, state: { saved: true } });
    },
  });

  const submit = handleSubmit((values) => { mutation.mutate(values); });

  if (categories.isLoading || locations.isLoading || (isEditing && product.isLoading)) return <LoadingState label="Loading product form" />;
  if (product.isError) return <ErrorState message={toAppError(product.error).message} onRetry={() => void product.refetch()} />;
  if (categories.isError) return <ErrorState message={toAppError(categories.error).message} onRetry={() => void categories.refetch()} />;
  if (locations.isError) return <ErrorState message={toAppError(locations.error).message} onRetry={() => void locations.refetch()} />;
  if (!categories.data || !locations.data || (isEditing && !product.data)) return <LoadingState label="Loading product form" />;

  const stockColumns: Column<NonNullable<Product["stockByLocation"]>[number] & { id: string }>[] = [
    { key: "location", header: "Location", render: (row) => row.locationName },
    { key: "onHand", header: "On Hand", render: (row) => row.onHand },
  ];
  const stockRows = (product.data?.stockByLocation ?? []).map((row) => ({ ...row, id: row.locationId }));

  return (
    <>
      <div className="mb-5"><Button asChild variant="ghost" size="sm"><Link to="/products"><ArrowLeft size={15} />Products</Link></Button></div>
      <PageHeader title={isEditing ? "Edit product" : "New product"} description={isEditing ? "Update product details; stock changes stay in audited operations." : "Add a product to your inventory catalog."} />
      <form className="grid gap-5" onSubmit={submit}>
        <Card>
          <CardHeader><CardTitle>Product details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" id="product-name" error={errors.name?.message}><TextInput id="product-name" {...register("name")} /></Field>
            <Field label="SKU / Code" id="product-sku" error={errors.sku?.message}><TextInput id="product-sku" {...register("sku")} /></Field>
            <Field label="Category" id="product-category" error={errors.categoryId?.message}>
              <SelectInput id="product-category" {...register("categoryId")}><option value="">No category</option>{categories.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectInput>
            </Field>
            <Field label="Unit of Measure" id="product-unit" error={errors.unitOfMeasure?.message}><TextInput id="product-unit" placeholder="pcs" {...register("unitOfMeasure")} /></Field>
            <Field label="Reorder Level" id="product-reorder" error={errors.reorderLevel?.message}><TextInput id="product-reorder" type="number" min="0" step="0.001" {...register("reorderLevel")} /></Field>
            <Field label="Per Unit Cost" id="product-cost" error={errors.unitCost?.message}><TextInput id="product-cost" type="number" min="0" step="0.01" {...register("unitCost")} /></Field>
          </CardContent>
        </Card>

        {!isEditing && (
          <Card>
            <CardHeader><CardTitle>Optional initial stock</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Physical count" id="initial-stock" error={errors.initialStock?.message}><TextInput id="initial-stock" type="number" min="0" step="0.001" {...register("initialStock")} /></Field>
              <Field label="Location" id="initial-location" error={errors.initialLocationId?.message}>
                <SelectInput id="initial-location" {...register("initialLocationId")}><option value="">Choose a location</option>{locations.data.map((item) => <option value={item.id} key={item.id}>{item.warehouseName} / {item.name}</option>)}</SelectInput>
              </Field>
              <p className="text-xs text-muted sm:col-span-2">Initial stock is created through the backend Adjustment flow and produces a ledger entry when the count changes stock.</p>
            </CardContent>
          </Card>
        )}

        {isEditing && product.data?.stockByLocation?.length ? (
          <Card><CardHeader><CardTitle>Current stock by location</CardTitle></CardHeader><CardContent><DataTable columns={stockColumns} rows={stockRows} /></CardContent></Card>
        ) : null}
        {mutation.isError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{toAppError(mutation.error).message}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={isSubmitting || mutation.isPending}><Save size={16} />{mutation.isPending ? "Saving…" : "Save product"}</Button></div>
      </form>
    </>
  );
}
