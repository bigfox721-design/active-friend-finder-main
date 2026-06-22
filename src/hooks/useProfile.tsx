import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
};

export const useProfile = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async (): Promise<Profile | null> => {
      if (!user) return null;
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const fallback = { id: user.id, display_name: user.email?.split("@")[0] ?? null, avatar_url: null };
        // Fire-and-forget insert so the UI doesn't wait
        (supabase as any).from("profiles").insert(fallback).then(() => {});
        return fallback;
      }
      return data as Profile;
    },
  });
};

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, "display_name" | "avatar_url">>) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any).from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
};

export const useUploadAvatar = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = data.publicUrl;
      const { error: updErr } = await (supabase as any).from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (updErr) throw updErr;
      return url;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
};

export const useRemoveAvatar = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { data: list } = await supabase.storage.from("avatars").list(user.id);
      if (list && list.length) {
        await supabase.storage.from("avatars").remove(list.map((f) => `${user.id}/${f.name}`));
      }
      const { error } = await (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
};
