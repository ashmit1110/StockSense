import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EmptyState, ErrorState } from "@/components/shared/FeedbackState";
import { Field, SelectInput, TextInput } from "@/components/shared/FormControls";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { locationService } from "@/services/locationService";
import { warehouseService } from "@/services/warehouseService";
import type { Location } from "@/types/domain";

const schema = z.object({ name: z.string().trim().min(1, "Enter a location name."), shortCode: z.string().trim().min(1, "Enter a short code."), warehouseId: z.string().min(1, "Choose a warehouse.") });
type FormValues = z.infer<typeof schema>;

export function LocationFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const warehouses = useQuery({ queryKey: queryKeys.warehouses.all, queryFn: () => warehouseService.listWarehouses() });
  const location = useQuery({ queryKey: queryKeys.locations.detail(id ?? ""), queryFn: () => locationService.getLocation(id!), enabled: editing });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", shortCode: "", warehouseId: "" } });

  useEffect(() => {
    if (location.data) reset({ name: location.data.name, shortCode: location.data.shortCode, warehouseId: location.data.warehouseId });
  }, [location.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => editing ? locationService.updateLocation(id!, values) : locationService.createLocation(values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.locations.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.locations.detail(saved.id) });
      navigate(`/settings/locations/${saved.id}`, { replace: true });
    },
  });

  if (warehouses.isLoading || (editing && location.isLoading)) return <LoadingState label="Loading location" />;
  if (warehouses.isError) return <ErrorState message={toAppError(warehouses.error).message} onRetry={() => void warehouses.refetch()} />;
  if (location.isError) return <ErrorState message={toAppError(location.error).message} onRetry={() => void location.refetch()} />;
  if (!warehouses.data || (editing && !location.data)) return <LoadingState label="Loading location" />;

  const stockColumns: Column<Location["stockRows"][number] & { id: string }>[] = [
    { key: "product", header: "Product", render: (row) => <div><span className="font-medium">{row.productName}</span><span className="ml-2 text-xs text-muted">{row.sku}</span></div> },
    { key: "onHand", header: "On Hand", render: (row) => row.onHand },
    { key: "free", header: "Free to Use", render: (row) => row.freeToUse },
  ];
  const stockRows = (location.data?.stockRows ?? []).map((row) => ({ ...row, id: row.productId }));

  return (
    <>
      <div className="mb-5"><Button asChild variant="ghost" size="sm"><Link to="/settings/locations"><ArrowLeft size={15} />Locations</Link></Button></div>
      <PageHeader title={editing ? "Edit location" : "New location"} description="Short codes must be unique within the selected warehouse." />
      {!warehouses.data.length ? <EmptyState title="Create a warehouse first" description="Locations must belong to a warehouse." action={<Button asChild><Link to="/settings/warehouses/new">New warehouse</Link></Button>} /> : (
        <form className="grid gap-5" onSubmit={handleSubmit((values) => { mutation.mutate(values); })}>
          <Card><CardHeader><CardTitle>Location details</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" id="location-name" error={errors.name?.message}><TextInput id="location-name" {...register("name")} /></Field>
            <Field label="Short Code" id="location-code" error={errors.shortCode?.message}><TextInput id="location-code" autoCapitalize="characters" {...register("shortCode")} /></Field>
            <Field label="Warehouse" id="location-warehouse" error={errors.warehouseId?.message}><SelectInput id="location-warehouse" {...register("warehouseId")}><option value="">Choose a warehouse</option>{warehouses.data.map((warehouse) => <option value={warehouse.id} key={warehouse.id}>{warehouse.name}</option>)}</SelectInput></Field>
          </CardContent></Card>
          {mutation.isError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{toAppError(mutation.error).message}</p>}
          <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? "Saving…" : "Save location"}</Button></div>
        </form>
      )}
      {editing && location.data?.stockRows.length ? <Card className="mt-6"><CardHeader><CardTitle>Current stock at this location</CardTitle></CardHeader><CardContent><DataTable columns={stockColumns} rows={stockRows} /></CardContent></Card> : null}
    </>
  );
}
