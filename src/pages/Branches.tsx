import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBranch, type Branch } from "@/hooks/useBranch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";

export default function Branches() {
  const { branches } = useBranch();
  const qc = useQueryClient();
  const [newBranch, setNewBranch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const refreshBranches = () => qc.invalidateQueries({ queryKey: ["branches"] });

  const addBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBranch.trim();
    if (trimmed.length < 2) return toast.error("Branch name too short");
    if (trimmed.length > 60) return toast.error("Branch name too long");
    setBusy(true);
    const { error } = await (supabase as any).from("branches").insert({ name: trimmed });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Added ${trimmed}`);
    setNewBranch("");
    refreshBranches();
  };

  const startEdit = (b: Branch) => { setEditingId(b.id); setEditingName(b.name); };
  const cancelEdit = () => { setEditingId(null); setEditingName(""); };

  const saveEdit = async (id: string) => {
    const trimmed = editingName.trim();
    if (trimmed.length < 2) return toast.error("Branch name too short");
    if (trimmed.length > 60) return toast.error("Branch name too long");
    setBusy(true);
    const { error } = await (supabase as any).from("branches").update({ name: trimmed }).eq("id", id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Branch renamed");
    cancelEdit();
    refreshBranches();
  };

  const removeBranch = async (id: string) => {
    if (!confirm("Delete this branch? Related products and entries will also be removed.")) return;
    const { error } = await (supabase as any).from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Branch deleted");
    refreshBranches();
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Branches</h1>
      <p className="text-muted-foreground text-sm mb-6">Create, rename, and manage your branches.</p>

      <Card className="glass rounded-2xl p-6">
        <form onSubmit={addBranch} className="flex gap-2 mb-4">
          <Input placeholder="e.g. Downtown Branch" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} maxLength={60} />
          <Button type="submit" disabled={busy} className="bg-gradient-primary text-primary-foreground">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
          </Button>
        </form>
        <ul className="space-y-2">
          {branches.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40">
              {editingId === b.id ? (
                <>
                  <Input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} maxLength={60}
                    onKeyDown={(e) => { if (e.key === "Enter") saveEdit(b.id); if (e.key === "Escape") cancelEdit(); }} className="h-9" />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => saveEdit(b.id)} disabled={busy}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium">{b.name}</span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => removeBranch(b.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </>
              )}
            </li>
          ))}
          {!branches.length && <p className="text-sm text-muted-foreground text-center py-6">No branches yet.</p>}
        </ul>
      </Card>
    </AppShell>
  );
}
