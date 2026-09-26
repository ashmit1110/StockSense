import { cloneElement, isValidElement, type InputHTMLAttributes, type ReactElement, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

export function Field({ label, error, className, children, ...props }: {
  label: string;
  error?: string;
  className?: string;
  id?: string;
  children: ReactNode;
}) {
  const control = error && isValidElement(children)
    ? cloneElement(children as ReactElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>, { "aria-invalid": true, "aria-describedby": props.id ? `${props.id}-error` : undefined })
    : children;
  return (
    <div className={cn("grid gap-1.5", className)}>
      <label className="text-sm font-medium text-ink" htmlFor={props.id}>{label}</label>
      {control}
      {error && <p id={props.id ? `${props.id}-error` : undefined} className="text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <Input {...props} />;
}

export function SelectInput({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn("h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-ink focus-visible:border-accent focus-visible:outline-none disabled:opacity-50", className)} {...props} />;
}

export function TextAreaInput({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-24 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted/70 focus-visible:border-accent focus-visible:outline-none", className)} {...props} />;
}
