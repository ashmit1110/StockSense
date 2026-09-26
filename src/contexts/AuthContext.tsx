import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { AppError, toAppError } from "@/lib/errors";
import type { Profile } from "@/types/domain";
import { authService, type AuthCredentials } from "@/services/authService";
import { hasSupabaseConfig } from "@/services/supabaseClient";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  profileLoading: boolean;
  isConfigured: boolean;
  authError: AppError | null;
  signIn: (credentials: AuthCredentials) => Promise<void>;
  signUp: (credentials: AuthCredentials, displayName: string) => Promise<{ session: Session | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<Profile>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authError, setAuthError] = useState<AppError | null>(null);
  const revision = useRef(0);

  useEffect(() => {
    if (!hasSupabaseConfig) {
      setIsLoading(false);
      setAuthError(new AppError("CONFIGURATION_ERROR", "Add the Supabase URL and anon key to .env.local to connect StockSense."));
      return;
    }

    let active = true;

    const applySession = (nextSession: Session | null) => {
      const currentRevision = ++revision.current;
      const nextUser = nextSession?.user ?? null;
      setSession(nextSession);
      setUser(nextUser);
      setAuthError(null);
      setIsLoading(false);

      if (!nextUser) {
        setProfile(null);
        setProfileLoading(false);
        return;
      }

      setProfile(null);
      setProfileLoading(true);
      window.setTimeout(() => {
        void authService.getProfile(nextUser.id).then((nextProfile) => {
          if (active && revision.current === currentRevision) {
            setProfile(nextProfile);
            setProfileLoading(false);
          }
        }).catch((error: unknown) => {
          if (active && revision.current === currentRevision) {
            setAuthError(toAppError(error));
            setProfileLoading(false);
          }
        });
      }, 0);
    };

    const subscription = authService.subscribe((_event, nextSession) => applySession(nextSession));
    void authService.restoreSession().then((restored) => {
      if (active && revision.current === 0) applySession(restored);
    }).catch((error: unknown) => {
      if (active) {
        setAuthError(toAppError(error));
        setIsLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    isLoading,
    profileLoading,
    isConfigured: hasSupabaseConfig,
    authError,
    async signIn(credentials) {
      await authService.signIn(credentials);
    },
    async signUp(credentials, displayName) {
      const result = await authService.signUp(credentials, displayName);
      return { session: result.session };
    },
    async signOut() {
      await authService.signOut();
    },
    async resetPassword(email) {
      await authService.resetPasswordForEmail(email);
    },
    async updatePassword(newPassword) {
      await authService.updatePassword(newPassword);
    },
    async updateProfile(displayName) {
      if (!user) throw new AppError("UNAUTHORIZED", "Sign in to update your profile.");
      const nextProfile = await authService.updateProfile(user.id, displayName);
      setProfile(nextProfile);
      return nextProfile;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
