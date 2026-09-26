import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { toAppError } from "@/lib/errors";
import { AuthField } from "../components/AuthField";
import { AuthLayout } from "../components/AuthLayout";

const schema = z.object({ email: z.email("Enter a valid email address.") });
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [message, setMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ email }) => {
    setMessage(null);
    setSubmitError(null);
    try {
      await resetPassword(email);
      setMessage("If an account exists for that email, password reset instructions are on the way.");
    } catch (error) {
      setSubmitError(toAppError(error).message);
    }
  });

  return (
    <AuthLayout title="Reset your password" description="We’ll email you a secure password reset link.">
      {message ? <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100" role="status">{message}</p> : (
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <AuthField label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
          {submitError && <p role="alert" className="text-sm text-red-200">{submitError}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-muted"><Link className="text-accent hover:underline" to="/login">Back to Log In</Link></p>
    </AuthLayout>
  );
}
