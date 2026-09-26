import { Slot } from "@radix-ui/react-slot";
import { X } from "lucide-react";
import { createPortal } from "react-dom";
import { createContext, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DialogContextValue = { open: boolean; setOpen: (open: boolean) => void; titleId: string; descriptionId: string };
const DialogContext = createContext<DialogContextValue | null>(null);

function useDialog() {
  const context = useContext(DialogContext);
  if (!context) throw new Error("Dialog controls must be used inside Dialog.");
  return context;
}

export function Dialog({ children, open: controlledOpen, onOpenChange }: {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const titleId = useId();
  const descriptionId = useId();
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  return <DialogContext.Provider value={{ open, setOpen, titleId, descriptionId }}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({ asChild = false, onClick, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { setOpen } = useDialog();
  const Component = asChild ? Slot : "button";
  return <Component {...props} type={asChild ? undefined : type} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) setOpen(true); }} />;
}

export function DialogClose({ asChild = false, onClick, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const { setOpen } = useDialog();
  const Component = asChild ? Slot : "button";
  return <Component {...props} type={asChild ? undefined : type} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) setOpen(false); }} />;
}

export function DialogContent({ className, children, onClose, onClick, ...props }: ComponentProps<"dialog"> & { children: ReactNode }) {
  const { open, setOpen, titleId, descriptionId } = useDialog();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className={cn("fixed left-1/2 top-1/2 z-50 m-0 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-panel p-5 text-ink shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm focus:outline-none sm:p-6", className)}
      onClose={(event) => { onClose?.(event); setOpen(false); }}
      onClick={(event) => { onClick?.(event); if (event.target === event.currentTarget) setOpen(false); }}
      {...props}
    >
      {children}
      <DialogClose aria-label="Close dialog" className="absolute right-4 top-4 rounded-md p-1 text-muted transition hover:bg-white/5 hover:text-ink">
        <X size={18} />
      </DialogClose>
    </dialog>,
    document.body,
  );
}

export function DialogTitle({ className, ...props }: ComponentProps<"h2">) {
  const { titleId } = useDialog();
  return <h2 id={titleId} className={cn("text-lg font-semibold text-ink", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<"p">) {
  const { descriptionId } = useDialog();
  return <p id={descriptionId} className={cn("mt-1 text-sm text-muted", className)} {...props} />;
}
