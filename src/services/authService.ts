import type { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import type { Profile } from "@/types/domain";
import { toAppError } from "@/lib/errors";
import { getSupabaseClient } from "./supabaseClient";

export type AuthCredentials = { email: string; password: string };

export const authService = {
  async restoreSession(): Promise<Session | null> {
    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      throw toAppError(error);
    }
  },

  subscribe(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    return getSupabaseClient().auth.onAuthStateChange(callback).data.subscription;
  },

  async signUp({ email, password }: AuthCredentials, displayName: string) {
    try {
      const { data, error } = await getSupabaseClient().auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw error;
      return { user: data.user, session: data.session };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async signIn({ email, password }: AuthCredentials): Promise<{ user: User; session: Session }> {
    try {
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.user || !data.session) throw new Error("No authenticated session was returned.");
      return { user: data.user, session: data.session };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async signOut(): Promise<void> {
    try {
      const { error } = await getSupabaseClient().auth.signOut();
      if (error) throw error;
    } catch (error) {
      throw toAppError(error);
    }
  },

  async resetPasswordForEmail(email: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updatePassword(newPassword: string): Promise<void> {
    try {
      const { error } = await getSupabaseClient().auth.updateUser({ password: newPassword });
      if (error) throw error;
    } catch (error) {
      throw toAppError(error);
    }
  },

  async getProfile(userId: string): Promise<Profile> {
    try {
      const { data, error } = await getSupabaseClient()
        .from("profiles")
        .select("id, display_name, email, role")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return { id: data.id, displayName: data.display_name, email: data.email, role: data.role };
    } catch (error) {
      throw toAppError(error);
    }
  },

  async updateProfile(userId: string, displayName: string): Promise<Profile> {
    try {
      const { data, error } = await getSupabaseClient()
        .from("profiles")
        .update({ display_name: displayName })
        .eq("id", userId)
        .select("id, display_name, email, role")
        .single();
      if (error) throw error;
      return { id: data.id, displayName: data.display_name, email: data.email, role: data.role };
    } catch (error) {
      throw toAppError(error);
    }
  },
};
