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
import { ErrorState } from "@/components/shared/FeedbackState";
import { Field, TextInput } from "@/components/shared/FormControls";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { warehouseService } from "@/services/warehouseService";
import type { LocationSummary } from "@/types/domain";

const schema = z.object({ name: z.string().trim().min(1, "Enter a warehouse name."), shortCode: z.string().trim().min(1, "Enter a short code."), address: z.string() });
type FormValues = z.infer<typeof schema>;

export function WarehouseFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const warehouse = useQuery({ queryKey: queryKeys.warehouses.detail(id ?? ""), queryFn: () => warehouseService.getWarehouse(id!), enabled: editing });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", shortCode: "", address: "" } });

  useEffect(() => {
    if (warehouse.data) reset({ name: warehouse.data.name, shortCode: warehouse.data.shortCode, address: warehouse.data.address ?? "" });
  }, [warehouse.data, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => editing ? warehouseService.updateWarehouse(id!, values) : warehouseService.createWarehouse(values),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.warehouses.detail(saved.id) });
      navigate(`/settings/warehouses/${saved.id}`, { replace: true });
    },
  });

  if (editing && warehouse.isLoading) return <LoadingState label="Loading warehouse" />;
  if (warehouse.isError) return <ErrorState message={toAppError(warehouse.error).message} onRetry={() => void warehouse.refetch()} />;

  const locationColumns: Column<LocationSummary>[] = [
    { key: "name", header: "Location", render: (row) => row.name },
    { key: "code", header: "Short Code", render: (row) => <span className="font-mono text-xs">{row.shortCode}</span> },
    { key: "warehouse", header: "Warehouse", render: (row) => row.warehouseName },
  ];

  return (
    <>
      <div className="mb-5"><Button asChild variant="ghost" size="sm"><Link to="/settings/warehouses"><ArrowLeft size={15} />Warehouses</Link></Button></div>
      <PageHeader title={editing ? "Edit warehouse" : "New warehouse"} description="Short codes must be unique." />
      <form className="grid gap-5" onSubmit={handleSubmit((values) => { mutation.mutate(values); })}>
        <Card><CardHeader><CardTitle>Warehouse details</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" id="warehouse-name" error={errors.name?.message}><TextInput id="warehouse-name" {...register("name")} /></Field>
          <Field label="Short Code" id="warehouse-code" error={errors.shortCode?.message}><TextInput id="warehouse-code" autoCapitalize="characters" {...register("shortCode")} /></Field>
          <Field className="sm:col-span-2" label="Address" id="warehouse-address" error={errors.address?.message}><TextInput id="warehouse-address" {...register("address")} /></Field>
        </CardContent></Card>
        {mutation.isError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{toAppError(mutation.error).message}</p>}
        <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? "Saving…" : "Save warehouse"}</Button></div>
      </form>
      {editing && warehouse.data?.locations.length ? <Card className="mt-6"><CardHeader><CardTitle>Locations</CardTitle></CardHeader><CardContent><DataTable columns={locationColumns} rows={warehouse.data.locations} onRowClick={(row) => navigate(`/settings/locations/${row.id}`)} /></CardContent></Card> : null}
    </>
  );
}
