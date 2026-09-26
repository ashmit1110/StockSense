import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Check, Plus, Printer, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/shared/FeedbackState";
import { Field, SelectInput, TextAreaInput, TextInput } from "@/components/shared/FormControls";
import { LoadingState } from "@/components/shared/LoadingState";
import { OperationStatusBadge, OperationStatusStepper } from "@/components/shared/OperationStatus";
import { PageHeader } from "@/components/shared/PageHeader";
import { authService } from "@/services/authService";
import { locationService } from "@/services/locationService";
import { operationService, type OperationInput } from "@/services/operationService";
import { productService } from "@/services/productService";
import { queryKeys } from "@/lib/queryKeys";
import { formatDateTime, formatQuantity } from "@/lib/formatters";
import { toAppError } from "@/lib/errors";
import type { OperationDetail, Shortage } from "@/types/domain";
import type { OperationConfig } from "./operationConfig";

function operationFormSchema(config: OperationConfig) {
  return z.object({
    partnerName: z.string(),
    scheduledDate: z.string().min(1, "Choose a scheduled date."),
    responsibleUserId: z.string(),
    sourceLocationId: z.string(),
    destinationLocationId: z.string(),
    reason: z.string(),
    lines: z.array(z.object({
      productId: z.string().min(1, "Choose a product."),
      quantity: z.string().trim().min(1, "Enter a quantity.").transform(Number).pipe(z.number().finite().min(0, "Quantity cannot be negative.")),
    })).min(1, "Add at least one product."),
  }).superRefine((values, context) => {
    if ((config.locationMode === "source" || config.locationMode === "both") && !values.sourceLocationId) {
      context.addIssue({ code: "custom", path: ["sourceLocationId"], message: "Choose a source location." });
    }
    if ((config.locationMode === "destination" || config.locationMode === "both") && !values.destinationLocationId) {
      context.addIssue({ code: "custom", path: ["destinationLocationId"], message: "Choose a destination location." });
    }
    values.lines.forEach((line, index) => {
      if (config.type !== "ADJUSTMENT" && line.productId && line.quantity === 0) {
        context.addIssue({ code: "custom", path: ["lines", index, "quantity"], message: "Quantity must be greater than zero." });
      }
    });
  });
}

type FormInput = z.input<ReturnType<typeof operationFormSchema>>;
type FormOutput = z.output<ReturnType<typeof operationFormSchema>>;

function todayLocal() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function detailDefaults(detail: OperationDetail): FormInput {
  return {
    partnerName: detail.partnerName ?? "",
    scheduledDate: detail.scheduledDate.slice(0, 10),
    responsibleUserId: detail.responsibleUser?.id ?? "",
    sourceLocationId: detail.sourceLocation?.id ?? "",
    destinationLocationId: detail.destinationLocation?.id ?? "",
    reason: detail.reason ?? "",
    lines: detail.lines.map((line) => ({ productId: line.productId, quantity: String(line.quantity) })),
  };
}

function toOperationInput(values: FormOutput, config: OperationConfig): OperationInput {
  return {
    type: config.type,
    scheduledDate: values.scheduledDate,
    responsibleUserId: values.responsibleUserId || null,
    partnerName: values.partnerName.trim() || null,
    sourceLocationId: values.sourceLocationId || null,
    destinationLocationId: values.destinationLocationId || null,
    reason: values.reason.trim() || null,
    lines: values.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
  };
}

function invalidateOperationData(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.operations.all });
  if (id) void queryClient.invalidateQueries({ queryKey: queryKeys.operations.detail(id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.moveHistory.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
}

function ShortageNotice({ shortages }: { shortages: Shortage[] }) {
  return (
    <section className="rounded-xl border border-amber-300/35 bg-amber-400/[.08] p-4" role="alert" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-amber-100">Waiting for stock</h2>
        <OperationStatusBadge status="WAITING" />
      </div>
      <p className="mt-1 text-sm text-amber-100/85">The server found insufficient Free to Use for the lines below. No stock or ledger rows were changed. Retry after stock is available; to correct the quantity or location, cancel this operation and create a new Draft because Waiting operations cannot be edited.</p>
      <div className="mt-3 grid gap-2">
        {shortages.map((shortage, index) => <div key={`${shortage.productId}-${index}`} className="flex flex-wrap justify-between gap-x-4 gap-y-1 rounded-lg border border-amber-200/10 bg-black/10 px-3 py-2 text-sm">
          <span className="font-medium">{shortage.productName} <span className="text-xs text-muted">{shortage.sku}</span></span>
          <span>Requested <strong>{formatQuantity(shortage.requested)}</strong> · Available <strong>{formatQuantity(shortage.available)}</strong></span>
        </div>)}
        {shortages.length === 0 && <p className="rounded-lg border border-amber-200/10 bg-black/10 px-3 py-2 text-sm">No shortage details were returned on this page load. Retry validation to refresh the server’s current availability result.</p>}
      </div>
    </section>
  );
}

export function OperationFormPage({ config }: { config: OperationConfig }) {
  const { id } = useParams();
  const isExisting = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const locations = useQuery({ queryKey: queryKeys.locations.list(), queryFn: () => locationService.listLocations() });
  const products = useQuery({ queryKey: queryKeys.products.list({ page: 1, pageSize: 100 }), queryFn: () => productService.listProducts({ page: 1, pageSize: 100 }) });
  const profiles = useQuery({ queryKey: queryKeys.responsibleUsers.all, queryFn: () => authService.listProfiles() });
  const operation = useQuery({ queryKey: queryKeys.operations.detail(id ?? ""), queryFn: () => operationService.getOperation(id!), enabled: isExisting });
  const schema = useMemo(() => operationFormSchema(config), [config]);
  const initialValues = useMemo<FormInput>(() => ({ partnerName: "", scheduledDate: todayLocal(), responsibleUserId: "", sourceLocationId: "", destinationLocationId: "", reason: "", lines: [{ productId: "", quantity: "1" }] }), []);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({ resolver: zodResolver(schema), defaultValues: initialValues });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const detail = operation.data;
  const editable = !detail || detail.status === "DRAFT";

  useEffect(() => {
    if (detail) reset(detailDefaults(detail));
  }, [detail, reset]);

  const saveMutation = useMutation({
    mutationFn: (values: FormOutput) => isExisting
      ? operationService.updateOperation(id!, toOperationInput(values, config))
      : operationService.createOperation(toOperationInput(values, config)),
    onSuccess: async (saved) => {
      invalidateOperationData(queryClient, saved.id);
      setShortages([]);
      setNotice(`${config.singular} draft saved.`);
      navigate(`/operations/${config.segment}/${saved.id}`, { replace: true });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (draftValues?: FormOutput) => {
      if (!id || !detail) throw new Error("Save this operation as a Draft before validating it.");
      if (detail.status === "DRAFT") {
        if (!draftValues) throw new Error("Review the required fields before validating.");
        await operationService.updateOperation(id, toOperationInput(draftValues, config));
        await operationService.markReady(id);
      }
      return operationService.validateOperation(id);
    },
    onSuccess: (result) => {
      setShortages(result.shortages);
      setNotice(result.operation.status === "WAITING" ? "Validation completed. This operation is waiting for stock." : `${config.singular} validated successfully.`);
      queryClient.setQueryData(queryKeys.operations.detail(result.operation.id), result.operation);
      invalidateOperationData(queryClient, result.operation.id);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => operationService.cancelOperation(id!),
    onSuccess: (canceled) => {
      setShortages([]);
      setNotice(`${config.singular} canceled. No stock was changed by cancellation.`);
      queryClient.setQueryData(queryKeys.operations.detail(canceled.id), canceled);
      invalidateOperationData(queryClient, canceled.id);
    },
  });

  if (locations.isLoading || products.isLoading || profiles.isLoading || (isExisting && operation.isLoading)) return <LoadingState label={`Loading ${config.singular.toLowerCase()} details`} />;
  if (locations.isError) return <ErrorState message={toAppError(locations.error).message} onRetry={() => void locations.refetch()} />;
  if (products.isError) return <ErrorState message={toAppError(products.error).message} onRetry={() => void products.refetch()} />;
  if (profiles.isError) return <ErrorState message={toAppError(profiles.error).message} onRetry={() => void profiles.refetch()} />;
  if (operation.isError) return <ErrorState message={toAppError(operation.error).message} onRetry={() => void operation.refetch()} />;
  if ((isExisting && !detail) || !locations.data || !products.data || !profiles.data) return <LoadingState label={`Loading ${config.singular.toLowerCase()} details`} />;
  if (detail && detail.type !== config.type) return <ErrorState message="This operation does not match the selected operation type." />;

  const shortageByProduct = new Map(shortages.map((item) => [item.productId, item]));
  const canCancel = detail && ["DRAFT", "READY", "WAITING"].includes(detail.status);
  const canValidate = detail && ["DRAFT", "READY", "WAITING"].includes(detail.status);
  const handleValidate = () => {
    if (detail?.status === "DRAFT") void handleSubmit((values) => validateMutation.mutate(values))();
    else validateMutation.mutate(undefined);
  };
  const saveLabel = saveMutation.isPending ? "Saving…" : "Save draft";

  return (
    <>
      <div className="mb-5"><Button asChild variant="ghost" size="sm"><Link to={`/operations/${config.segment}`}><ArrowLeft size={15} />{config.title}</Link></Button></div>
      <PageHeader title={detail ? config.singular : `New ${config.singular}`} description={detail ? `${detail.reference} · created ${formatDateTime(detail.createdAt)}` : `Enter the ${config.singular.toLowerCase()} details and product quantities.`} />
      {detail && (
        <div className="mb-5 grid gap-4 rounded-xl border border-line bg-white/[.025] p-4 lg:grid-cols-[1fr_auto] lg:items-center">
          <OperationStatusStepper status={detail.status} flow={config.statusFlow} />
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {canValidate && <Button disabled={validateMutation.isPending} onClick={handleValidate}><Check size={15} />{validateMutation.isPending ? "Validating…" : detail.status === "WAITING" ? "Retry validation" : "Validate"}</Button>}
            {config.supportsPrint && <Button variant="outline" disabled={detail.status !== "DONE"} title={detail.status === "DONE" ? "Print this completed operation" : "Printing is available after validation"} onClick={() => window.print()}><Printer size={15} />Print</Button>}
            {canCancel && <Button variant="outline" disabled={cancelMutation.isPending} onClick={() => { if (window.confirm(`Cancel ${detail.reference}? This cannot be undone.`)) cancelMutation.mutate(); }}><Ban size={15} />{cancelMutation.isPending ? "Canceling…" : "Cancel"}</Button>}
          </div>
        </div>
      )}
      {(shortages.length > 0 || detail?.status === "WAITING") && config.supportsWaiting && <div className="mb-5"><ShortageNotice shortages={shortages} /></div>}
      {notice && <p className="mb-4 rounded-lg border border-emerald-300/20 bg-emerald-400/[.06] px-3 py-2 text-sm text-emerald-100" role="status">{notice}</p>}
      {saveMutation.isError && <p className="mb-4 rounded-lg border border-red-300/25 bg-red-400/[.08] p-3 text-sm text-red-100" role="alert">{toAppError(saveMutation.error).message}</p>}
      {validateMutation.isError && <p className="mb-4 rounded-lg border border-red-300/25 bg-red-400/[.08] p-3 text-sm text-red-100" role="alert">{toAppError(validateMutation.error).message}</p>}
      {cancelMutation.isError && <p className="mb-4 rounded-lg border border-red-300/25 bg-red-400/[.08] p-3 text-sm text-red-100" role="alert">{toAppError(cancelMutation.error).message}</p>}

      <form className="grid gap-5" onSubmit={handleSubmit((values) => saveMutation.mutate(values))} noValidate>
        <Card>
          <CardHeader><CardTitle>{config.singular} details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail && <Field label="Reference" id="operation-reference"><TextInput id="operation-reference" readOnly value={detail.reference} /></Field>}
            {config.showPartner && <Field label={config.partnerLabel} id="operation-partner"><TextInput id="operation-partner" placeholder={config.type === "RECEIPT" ? "Vendor or supplier" : "Customer or destination"} disabled={!editable} {...register("partnerName")} /></Field>}
            <Field label="Scheduled Date" id="operation-date" error={errors.scheduledDate?.message}><TextInput id="operation-date" type="date" disabled={!editable} {...register("scheduledDate")} /></Field>
            <Field label="Responsible" id="operation-responsible"><SelectInput id="operation-responsible" disabled={!editable} {...register("responsibleUserId")}><option value="">Not assigned</option>{profiles.data.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}</option>)}</SelectInput></Field>
            {(config.locationMode === "source" || config.locationMode === "both") && <Field label={config.locationMode === "both" ? config.sourceLocationLabel ?? "Source Location" : config.locationLabel} id="operation-source-location" error={errors.sourceLocationId?.message}><SelectInput id="operation-source-location" disabled={!editable} {...register("sourceLocationId")}><option value="">Choose a source location</option>{locations.data.map((location) => <option key={location.id} value={location.id}>{location.warehouseName} / {location.name}</option>)}</SelectInput></Field>}
            {(config.locationMode === "destination" || config.locationMode === "both") && <Field label={config.locationMode === "both" ? config.destinationLocationLabel ?? "Destination Location" : config.locationLabel} id="operation-destination-location" error={errors.destinationLocationId?.message}><SelectInput id="operation-destination-location" disabled={!editable} {...register("destinationLocationId")}><option value="">Choose a destination location</option>{locations.data.map((location) => <option key={location.id} value={location.id}>{location.warehouseName} / {location.name}</option>)}</SelectInput></Field>}
            {config.showDeliveryOperationType && <Field label="Operation Type" id="operation-subtype"><SelectInput id="operation-subtype" disabled value=""><option value=""> </option></SelectInput><span className="text-xs text-muted">The backend contract does not define delivery subtypes.</span></Field>}
            {config.showReason && <Field className="sm:col-span-2 lg:col-span-3" label="Reason" id="operation-reason"><TextAreaInput id="operation-reason" disabled={!editable} {...register("reason")} /></Field>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between"><div><CardTitle>Products</CardTitle><p className="mt-1 text-sm text-muted">Add each product and requested quantity.</p></div>{editable && <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: "1" })}><Plus size={15} />Add Product</Button>}</CardHeader>
          <CardContent>
            {errors.lines?.root?.message && <p className="mb-3 text-sm text-red-200" role="alert">{errors.lines.root.message}</p>}
            <div className="grid gap-3">
              {fields.map((field, index) => {
                const shortage = shortageByProduct.get(detail?.lines[index]?.productId ?? "");
                const lineDetail = detail?.lines[index];
                return <div key={field.id} className={`grid gap-3 rounded-xl border p-3 sm:grid-cols-[minmax(12rem,1fr)_9rem_auto] ${shortage ? "border-red-300/40 bg-red-400/[.06]" : "border-line bg-white/[.02]"}`}>
                  <Field label={`Product ${index + 1}`} id={`operation-product-${index}`} error={errors.lines?.[index]?.productId?.message}>
                    <SelectInput id={`operation-product-${index}`} disabled={!editable} {...register(`lines.${index}.productId`)}><option value="">Choose a product</option>{products.data.items.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}{!product.isActive ? " · inactive" : ""}</option>)}</SelectInput>
                  </Field>
                  <Field label={config.type === "ADJUSTMENT" ? "Physical Count" : "Quantity"} id={`operation-quantity-${index}`} error={errors.lines?.[index]?.quantity?.message}>
                    <TextInput id={`operation-quantity-${index}`} type="number" min="0" step="0.001" disabled={!editable} {...register(`lines.${index}.quantity`)} />
                    {(config.type === "DELIVERY" || config.type === "TRANSFER") && lineDetail && <span className="mt-1 block text-xs text-muted">Free to Use at source: {lineDetail.freeToUseAtSource === null || lineDetail.freeToUseAtSource === undefined ? "—" : formatQuantity(lineDetail.freeToUseAtSource)}</span>}
                  </Field>
                  {editable ? <div className="flex items-end justify-end"><Button type="button" variant="ghost" size="icon" aria-label={`Remove product line ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}><Trash2 size={16} /></Button></div> : <div className="flex items-end justify-end text-xs text-muted">{lineDetail ? `Line ${lineDetail.lineNumber}` : ""}</div>}
                  {shortage && <p className="text-sm text-red-100 sm:col-span-3">Shortage · requested {formatQuantity(shortage.requested)} · available Free to Use {formatQuantity(shortage.available)}</p>}
                </div>;
              })}
            </div>
          </CardContent>
        </Card>

        {detail?.validatedAt && <p className="text-sm text-muted">Validated {formatDateTime(detail.validatedAt)}.</p>}
        {detail?.canceledAt && <p className="text-sm text-muted">Canceled {formatDateTime(detail.canceledAt)}.</p>}
        {editable && <div className="flex flex-wrap justify-end gap-2 print:hidden"><Button type="submit" disabled={saveMutation.isPending || validateMutation.isPending} variant="outline"><Save size={15} />{saveLabel}</Button></div>}
      </form>
    </>
  );
}
