/**
 * Helper to verify the authenticated user has the manager role.
 * Call this inside a server function after requireSupabaseAuth has run.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireManagerRole(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await (supabase as any)
    .from("users")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new Error("Forbidden: User record not found");
  }

  if (data.role !== "manager") {
    throw new Error("Forbidden: Manager role required");
  }
}
