import { useRef } from "react";
import { useNavigate } from "@/lib/router-shim";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useProfile, useUploadAvatar, useRemoveAvatar } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, LogOut, Loader2 } from "lucide-react";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const uploadAvatar = useUploadAvatar();
  const removeAvatar = useRemoveAvatar();
  const fileRef = useRef<HTMLInputElement>(null);

  const displayName = profile?.display_name || user?.email?.split("@")[0] || "User";
  const initials = displayName.slice(0, 2).toUpperCase();

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please select an image");
    if (file.size > 2 * 1024 * 1024) return toast.error("Image must be under 2MB");
    try { await uploadAvatar.mutateAsync(file); toast.success("Profile photo updated"); }
    catch (err: any) { toast.error(err.message); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const onRemove = async () => {
    try { await removeAvatar.mutateAsync(); toast.success("Profile photo removed"); }
    catch (err: any) { toast.error(err.message); }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate("/login");
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Profile</h1>
      <p className="text-muted-foreground text-sm mb-6">Manage your account details and profile photo.</p>

      <Card className="glass rounded-2xl p-6 max-w-2xl">
        {isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Avatar */}
            <div className="flex items-center gap-5 mb-6">
              <div className="relative h-20 w-20 shrink-0 rounded-full overflow-hidden bg-primary/15 grid place-items-center ring-2 ring-primary/30">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-primary">{initials}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadAvatar.isPending} className="gap-1">
                    <Upload className="h-3.5 w-3.5" />
                    {profile?.avatar_url ? "Change photo" : "Upload photo"}
                  </Button>
                  {profile?.avatar_url && (
                    <Button size="sm" variant="ghost" onClick={onRemove} disabled={removeAvatar.isPending} className="gap-1 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG · max 2MB</p>
              </div>
            </div>

            {/* Username + Email */}
            <div className="grid gap-4 mb-6">
              <div>
                <Label className="text-xs text-muted-foreground">Username</Label>
                <Input value={displayName} readOnly className="mt-1 bg-secondary/40" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={user?.email ?? ""} readOnly className="mt-1 bg-secondary/40" />
              </div>
            </div>

            {/* Logout */}
            <div className="border-t border-border pt-4 flex justify-end">
              <Button variant="outline" onClick={logout} className="gap-2 text-destructive hover:text-destructive">
                <LogOut className="h-4 w-4" />
                Log out
              </Button>
            </div>
          </>
        )}
      </Card>
    </AppShell>
  );
}
