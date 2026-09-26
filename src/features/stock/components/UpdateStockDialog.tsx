import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/Dialog";
import { Field, TextAreaInput, TextInput } from "@/components/shared/FormControls";
import { formatQuantity } from "@/lib/formatters";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";
import { stockService } from "@/services/stockService";
import type { StockItem } from "@/types/domain";

const schema = z.object({ physicalCount: z.coerce.number().finite().min(0, "Physical count cannot be negative."), reason: z.string().trim() });
type FormInput = z.input<typeof schema>;
type FormOutput = z.output<typeof schema>;

export function UpdateStockDialog({ item, onClose, onSaved }: { item: StockItem | null; onClose: () => void; onSaved: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { physicalCount: String(item?.onHand ?? 0), reason: "Physical count correction" },
  });

  useEffect(() => {
    if (item) reset({ physicalCount: String(item.onHand), reason: "Physical count correction" });
  }, [item, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormOutput) => {
      if (!item) throw new Error("Choose a stock row first.");
      return stockService.updateStockFromCount({ productId: item.productId, locationId: item.locationId, physicalCount: values.physicalCount, reason: values.reason || undefined });
    },
    onSuccess: async ({ stock }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.stock.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.moveHistory.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.products.all }),
      ]);
      onSaved(`${item?.productName} at ${item?.locationName} is now ${formatQuantity(stock.onHand)}.`);
      onClose();
    },
  });

  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => { if (!open) onClose(); }}>
      {item && (
        <DialogContent>
          <DialogTitle>Update Stock</DialogTitle>
          <DialogDescription>Enter a new physical count for {item.productName} at {item.warehouseName} / {item.locationName}. The change is recorded as an Adjustment.</DialogDescription>
          <div className="mt-3 flex gap-4 rounded-lg border border-line bg-canvas/70 p-3 text-sm">
            <div><p className="text-xs text-muted">Current on hand</p><p className="mt-1 font-medium">{formatQuantity(item.onHand)}</p></div>
            <div><p className="text-xs text-muted">Free to use</p><p className="mt-1 font-medium">{formatQuantity(item.freeToUse)}</p></div>
          </div>
          <form className="mt-5 grid gap-4" onSubmit={handleSubmit(async (values) => { setSubmitError(null); try { await mutation.mutateAsync(values); } catch (error) { setSubmitError(toAppError(error).message); } })} noValidate>
            <Field label="New physical count" id="physical-count" error={errors.physicalCount?.message}><TextInput id="physical-count" type="number" min="0" step="0.001" {...register("physicalCount")} /></Field>
            <Field label="Reason (optional)" id="stock-reason"><TextAreaInput id="stock-reason" rows={2} {...register("reason")} /></Field>
            {submitError && <p className="text-sm text-red-200" role="alert">{submitError}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? "Updating…" : "Update Stock"}</Button></div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  );
}
