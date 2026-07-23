import { createContext, useContext, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { AppUser, UserRole } from "@/lib/types";

type RoleCtx = {
  role: AppUser | null;
  loading: boolean;
  error: Error | null;
};

const RoleCtx = createContext<RoleCtx>({ role: null, loading: true, error: null });

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const {
    data: appUser,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["app-user", user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    retry: 2,
    queryFn: async (): Promise<AppUser | null> => {
      if (!user) return null;

      // First try to get role from auth user metadata (set during signup)
      const metaRole = user.user_metadata?.role as string | undefined;
      if (metaRole === "manager" || metaRole === "user") {
        return {
          id: user.id,
          name: user.email?.split("@")[0] ?? null,
          email: user.email ?? null,
          role: metaRole as UserRole,
        };
      }

      // Fallback: query the public.users table
      const { data, error } = await (supabase as any)
        .from("users")
        .select("id, name, email, role")
        .eq("id", user.id)
        .maybeSingle();
      if (error) {
        console.error("useRole: users table query failed, using fallback role", error);
        return { id: user.id, name: user.email?.split("@")[0] ?? null, email: user.email ?? null, role: "user" as UserRole };
      }
      if (!data) {
        const fallback: AppUser = {
          id: user.id,
          name: user.email?.split("@")[0] ?? null,
          email: user.email ?? null,
          role: metaRole === "manager" ? "manager" as UserRole : "user" as UserRole,
        };
        (supabase as any).from("users").insert(fallback).then(() => {});
        return fallback;
      }
      return data as AppUser;
    },
  });

  return (
    <RoleCtx.Provider
      value={{ role: appUser ?? null, loading: isLoading, error: error as Error | null }}
    >
      {children}
    </RoleCtx.Provider>
  );
};

export const useRole = () => useContext(RoleCtx);
