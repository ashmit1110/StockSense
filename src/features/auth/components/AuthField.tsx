import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/Input";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function AuthField({ label, error, id, ...props }: AuthFieldProps) {
  const inputId = id ?? props.name;
  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-medium text-ink" htmlFor={inputId}>{label}</label>
      <Input id={inputId} aria-invalid={Boolean(error)} aria-describedby={error ? `${inputId}-error` : undefined} {...props} />
      {error && <p id={`${inputId}-error`} className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
