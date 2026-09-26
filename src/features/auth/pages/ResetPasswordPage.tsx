import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { toAppError } from "@/lib/errors";
import { AuthField } from "../components/AuthField";
import { AuthLayout } from "../components/AuthLayout";

const schema = z.object({ password: z.string().min(8, "Use at least 8 characters."), confirmPassword: z.string().min(1, "Re-enter your password.") })
  .refine((values) => values.password === values.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match." });
type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const onSubmit = handleSubmit(async ({ password }) => {
    setSubmitError(null);
    try {
      await updatePassword(password);
      navigate("/dashboard", { replace: true });
    } catch (error) {
      setSubmitError(toAppError(error).message);
    }
  });

  return (
    <AuthLayout title="Choose a new password" description="Set a new password for your StockSense account.">
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <AuthField label="New password" type="password" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
        <AuthField label="Re-enter password" type="password" autoComplete="new-password" {...register("confirmPassword")} error={errors.confirmPassword?.message} />
        {submitError && <p role="alert" className="text-sm text-red-200">{submitError}</p>}
        <Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Updating…" : "Update password"}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted"><Link className="text-accent hover:underline" to="/login">Back to Log In</Link></p>
    </AuthLayout>
  );
}
