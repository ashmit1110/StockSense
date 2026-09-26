import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorState } from "@/components/shared/FeedbackState";
import { Field, TextInput } from "@/components/shared/FormControls";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queryKeys";
import { toAppError } from "@/lib/errors";

const schema = z.object({ displayName: z.string().trim().min(1, "Enter a display name.").max(120, "Use 120 characters or fewer.") });
type FormValues = z.infer<typeof schema>;

export function ProfilePage() {
  const { profile, profileLoading, authError, updateProfile } = useAuth();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { displayName: "" } });

  useEffect(() => {
    if (profile) reset({ displayName: profile.displayName });
  }, [profile, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateProfile(values.displayName),
    onSuccess: async (updated) => {
      setSaved(true);
      reset({ displayName: updated.displayName });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.profile.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.responsibleUsers.all }),
      ]);
    },
  });

  if (profileLoading) return <LoadingState label="Loading profile" />;
  if (authError) return <ErrorState message={authError.message} />;
  if (!profile) return <ErrorState message="Your profile could not be loaded. Sign out and back in to try again." />;

  return (
    <>
      <PageHeader title="My Profile" description="Update the display name shown to your StockSense team." />
      <form className="grid gap-5" onSubmit={handleSubmit((values) => { setSaved(false); mutation.mutate(values); })} noValidate>
        <Card>
          <CardHeader><CardTitle>Account details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Display Name" id="profile-display-name" error={errors.displayName?.message}><TextInput id="profile-display-name" autoComplete="name" {...register("displayName")} /></Field>
            <Field label="Email" id="profile-email"><TextInput id="profile-email" type="email" readOnly value={profile.email} /></Field>
            <Field label="Role" id="profile-role"><TextInput id="profile-role" readOnly value={profile.role} /></Field>
          </CardContent>
        </Card>
        {mutation.isError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">{toAppError(mutation.error).message}</p>}
        {saved && <p role="status" className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Profile updated.</p>}
        <div className="flex justify-end"><Button type="submit" disabled={mutation.isPending}><Save size={16} />{mutation.isPending ? "Saving…" : "Save profile"}</Button></div>
      </form>
    </>
  );
}
