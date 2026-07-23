import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRole } from "@/hooks/useRole";
import { useCreateActivityLog } from "@/hooks/useActivityLog";
import { useAccessories } from "@/hooks/useInventory";
import { useBranch } from "@/hooks/useBranch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import type { Accessory } from "@/hooks/useInventory";

export default function Accessories() {
  const { data: accessories = [] } = useAccessories();
  const { branchId } = useBranch();
  const { role } = useRole();
  const logActivity = useCreateActivityLog();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("pcs");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCode, setEditingCode] = useState("");
  const [editingUnit, setEditingUnit] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["accessories"] });

  const startEdit = (a: Accessory) => {
    setEditingId(a.id);
    setEditingName(a.name);
    setEditingCode(a.code ?? "");
    setEditingUnit(a.unit);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
    setEditingCode("");
    setEditingUnit("");
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role?.role !== "manager") return toast.error("Only managers can add accessories.");
    const n = name.trim();
    if (n.length < 2) return toast.error("Name too short");
    if (n.length > 60) return toast.error("Name too long");
    const { error } = await (supabase as any).from("accessories").insert({
      branch_id: branchId,
      name: n,
      code: code.trim() || null,
      unit: unit.trim() || "pcs",
    });
    if (error) return toast.error(error.message);
    toast.success(`Added ${n}`);
    logActivity.mutate({ action: "accessory_created", description: `Accessory "${n}" created` });
    setName(""); setCode(""); setUnit("pcs");
    refresh();
  };

  const saveEdit = async (id: string) => {
    if (role?.role !== "manager") return toast.error("Only managers can edit.");
    const n = editingName.trim();
    if (n.length < 2) return toast.error("Name too short");
    if (n.length > 60) return toast.error("Name too long");
    const { error } = await (supabase as any)
      .from("accessories")
      .update({ name: n, code: editingCode.trim() || null, unit: editingUnit.trim() || "pcs" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Accessory updated");
    logActivity.mutate({ action: "accessory_updated", description: `Accessory "${n}" updated` });
    cancelEdit();
    refresh();
  };

  const remove = async (id: string) => {
    if (role?.role !== "manager") return toast.error("Only managers can delete.");
    const a = accessories.find((x) => x.id === id);
    if (!confirm(`Delete "${a?.name ?? id}"?`)) return;
    const { error } = await (supabase as any).from("accessories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Accessory deleted");
    logActivity.mutate({
      action: "accessory_deleted",
      description: `Accessory "${a?.name ?? id}" deleted`,
    });
    refresh();
  };

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Accessories</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Manage accessories, codes, and units.
      </p>

      <Card className="glass rounded-2xl p-6">
        <form onSubmit={add} className="flex flex-col sm:flex-row gap-2 mb-4">
          <Input
            placeholder="Name (e.g. Steel Hinge)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
          <Input
            placeholder="Code (e.g. ACC-001)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={40}
            className="sm:max-w-[180px]"
          />
          <Input
            placeholder="Unit (e.g. pcs, kg)"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            maxLength={20}
            className="sm:max-w-[140px]"
          />
          <Button type="submit" disabled={role?.role !== "manager"} className="bg-gradient-primary text-primary-foreground">
            {<><Plus className="h-4 w-4 mr-1" /> Add</>}
          </Button>
        </form>

        <ul className="space-y-2">
          {accessories.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 p-3 rounded-lg bg-secondary/40">
              {editingId === a.id ? (
                <>
                  <div className="flex-1 flex flex-col sm:flex-row gap-2">
                    <Input autoFocus value={editingName} onChange={(e) => setEditingName(e.target.value)} maxLength={60} onKeyDown={(e) => { if (e.key === "Enter") saveEdit(a.id); if (e.key === "Escape") cancelEdit(); }} className="h-9" />
                    <Input value={editingCode} onChange={(e) => setEditingCode(e.target.value)} maxLength={40} placeholder="Code" onKeyDown={(e) => { if (e.key === "Enter") saveEdit(a.id); if (e.key === "Escape") cancelEdit(); }} className="h-9 sm:max-w-[160px]" />
                    <Input value={editingUnit} onChange={(e) => setEditingUnit(e.target.value)} maxLength={20} placeholder="Unit" onKeyDown={(e) => { if (e.key === "Enter") saveEdit(a.id); if (e.key === "Escape") cancelEdit(); }} className="h-9 sm:max-w-[120px]" />
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => saveEdit(a.id)} disabled={role?.role !== "manager"}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={cancelEdit}><X className="h-4 w-4" /></Button>
                  </div>
                </>
              ) : (
                <>
                  <span className="font-medium flex items-center gap-2">
                    {a.name}
                    {a.code && <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">{a.code}</span>}
                    <span className="text-xs text-muted-foreground">· {a.unit}</span>
                  </span>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(a)} disabled={role?.role !== "manager"}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(a.id)} disabled={role?.role !== "manager"} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </>
              )}
            </li>
          ))}
          {!accessories.length && (
            <p className="text-sm text-muted-foreground text-center py-6">No accessories yet.</p>
          )}
        </ul>
      </Card>
    </AppShell>
  );
}
