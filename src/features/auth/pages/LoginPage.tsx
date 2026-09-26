import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/contexts/AuthContext";
import { toAppError } from "@/lib/errors";
import { AuthField } from "../components/AuthField";
import { AuthLayout } from "../components/AuthLayout";

const schema = z.object({ email: z.email("Enter a valid email address."), password: z.string().min(1, "Enter your password.") });
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const destination = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await signIn(values);
      navigate(destination, { replace: true });
    } catch (error) {
      setSubmitError(toAppError(error).message);
    }
  });

  return (
    <AuthLayout title="Log in" description="Use your email address to access StockSense.">
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
        <AuthField label="Email" type="email" autoComplete="email" {...register("email")} error={errors.email?.message} />
        <AuthField label="Password" type="password" autoComplete="current-password" {...register("password")} error={errors.password?.message} />
        {submitError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">{submitError}</p>}
        <div className="flex justify-end">
          <Link className="text-sm text-accent hover:underline" to="/forgot-password">Forgot Password?</Link>
        </div>
        <Button className="w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? "Signing in…" : "Log In"}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        New to StockSense? <Link className="text-accent hover:underline" to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
