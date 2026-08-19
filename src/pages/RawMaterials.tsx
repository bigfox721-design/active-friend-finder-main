import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageTitle } from "@/components/PageTitle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRawMaterials } from "@/hooks/useRawMaterials";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X, Loader2, Package } from "lucide-react";

export default function RawMaterialsPage() {
  const { data: materials = [], isLoading } = useRawMaterials();
  const qc = useQueryClient();

  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("pcs");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnit, setEditUnit] = useState("");

  const refresh = () => qc.invalidateQueries({ queryKey: ["raw_materials"] });

  const add = async () => {
    const name = newName.trim();
    if (name.length < 2) return toast.error("Name must be at least 2 characters");
    const { error } = await (supabase as any)
      .from("raw_materials")
      .insert({ name, unit: newUnit.trim() || "pcs" });
    if (error) return toast.error(error.message);
    toast.success(`Added ${name}`);
    setNewName("");
    setNewUnit("pcs");
    refresh();
  };

  const startEdit = (m: any) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditUnit(m.unit);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditUnit("");
  };

  const saveEdit = async (id: string) => {
    const name = editName.trim();
    if (name.length < 2) return toast.error("Name must be at least 2 characters");
    const { data, error } = await (supabase as any)
      .from("raw_materials")
      .update({ name, unit: editUnit.trim() || "pcs" })
      .eq("id", id)
      .select();
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) return toast.error("No rows updated — check RLS policies");
    toast.success("Updated");
    cancelEdit();
    refresh();
  };

  const remove = async (id: string, name: string) => {
    const { error } = await (supabase as any)
      .from("raw_materials")
      .delete()
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${name}`);
    refresh();
  };

  return (
    <AppShell>
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 grid place-items-center rounded-lg bg-primary/15 text-primary">
          <Package className="h-5 w-5" />
        </div>
        <div>
          <PageTitle>Raw <span className="text-gradient">Materials</span></PageTitle>
          <p className="text-sm text-muted-foreground">Manage raw material catalog</p>
        </div>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Raw Material
        </h2>
        <form
          onSubmit={(e) => { e.preventDefault(); add(); }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <Input
            placeholder="Material name (e.g. Steel Sheet)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            className="flex-1"
          />
          <Input
            placeholder="Unit (e.g. kg, pcs, m)"
            value={newUnit}
            onChange={(e) => setNewUnit(e.target.value)}
            maxLength={20}
            className="sm:max-w-[160px]"
          />
          <Button type="submit" className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold mb-4">Material List</h2>
        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : materials.length === 0 ? (
          <p className="text-muted-foreground">No raw materials yet.</p>
        ) : (
          <ul className="space-y-2">
            {materials.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/40 p-3">
                {editingId === m.id ? (
                  <>
                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                      <Input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={60}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(m.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-9"
                      />
                      <Input
                        value={editUnit}
                        onChange={(e) => setEditUnit(e.target.value)}
                        maxLength={20}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(m.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-9 sm:max-w-[140px]"
                      />
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => saveEdit(m.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={cancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-mono">
                        {m.unit}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(m.id, m.name)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
