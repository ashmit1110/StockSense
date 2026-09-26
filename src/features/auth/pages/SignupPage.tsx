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

const schema = z.object({
  displayName: z.string().trim().min(1, "Enter your name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  confirmPassword: z.string().min(1, "Re-enter your password."),
}).refine((values) => values.password === values.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match.",
});
type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ confirmPassword: _confirmPassword, ...values }) => {
    setSubmitError(null);
    try {
      const result = await signUp({ email: values.email, password: values.password }, values.displayName);
      if (result.session) navigate("/dashboard", { replace: true });
      else setConfirmation(true);
    } catch (error) {
      setSubmitError(toAppError(error).message);
    }
  });

  return (
    <AuthLayout title="Create your account" description="Set up your StockSense staff account.">
      {confirmation ? (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100" role="status">
          Account created. Check your email to confirm the address, then log in.
        </div>
      ) : (
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <AuthField label="Name" autoComplete="name" {...register("displayName")} error={errors.displayName?.message} />
          <AuthField label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
          <AuthField label="Password" type="password" autoComplete="new-password" {...register("password")} error={errors.password?.message} />
          <AuthField label="Re-enter password" type="password" autoComplete="new-password" {...register("confirmPassword")} error={errors.confirmPassword?.message} />
          {submitError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{submitError}</p>}
          <Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating account…" : "Sign Up"}</Button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-muted">
        Already have an account? <Link className="text-accent hover:underline" to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
