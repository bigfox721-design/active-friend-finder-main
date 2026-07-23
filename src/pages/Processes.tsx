import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import {
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  Workflow,
  Target,
  CheckCircle2,
  Percent,
} from "lucide-react";
import { toast } from "sonner";
import {
  ProcessDef,
  ProcessEntry,
  efficiency,
  loadEntries,
  loadProcesses,
  processAvailableForBranch,
  pruneProcessBranches,
  saveEntries,
  saveProcesses,
  uid,
} from "@/lib/processStore";
import { useBranch } from "@/hooks/useBranch";
import { useProducts } from "@/hooks/useProduction";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function Processes() {
  const { branches } = useBranch();
  const { role } = useRole();
  const branchNames = useMemo(() => branches.map((b) => b.name), [branches]);
  const { data: products = [] } = useProducts();

  const [processes, setProcesses] = useState<ProcessDef[]>([]);
  const [entries, setEntries] = useState<ProcessEntry[]>([]);

  useEffect(() => {
    setProcesses(loadProcesses());
    setEntries(loadEntries());
  }, []);

  // When branches change in the Branch Management module, prune removed branches
  // from every process's availability list.
  useEffect(() => {
    if (!branchNames.length) return;
    setProcesses((prev) => {
      const pruned = pruneProcessBranches(prev, branchNames);
      const changed = pruned.some(
        (p, i) => p.availableBranches.length !== prev[i].availableBranches.length,
      );
      if (changed) saveProcesses(pruned);
      return pruned;
    });
  }, [branchNames]);

  const persistProcesses = (next: ProcessDef[]) => {
    setProcesses(next);
    saveProcesses(next);
  };
  const persistEntries = (next: ProcessEntry[]) => {
    setEntries(next);
    saveEntries(next);
  };

  // ===== Entry form =====
  const [form, setForm] = useState({
    date: todayISO(),
    branch: "",
    productId: "",
    subProductId: "",
    processId: "",
    target: "",
    manpower: "",
    output: "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Default the form branch to the first known branch once loaded.
  useEffect(() => {
    if (!form.branch && branchNames.length) {
      setForm((f) => ({ ...f, branch: branchNames[0] }));
    }
  }, [branchNames, form.branch]);

  // useProducts already filters by the current branch context, so use it as-is.
  const formProducts = products;

  // Sub-products for the currently selected product in the form.
  const { data: formSubProducts = [] } = useQuery({
    queryKey: ["sub_products", form.productId],
    enabled: !!form.productId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("id, name, code, product_id")
        .eq("product_id", form.productId)
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; code: string | null; product_id: string }>;
    },
  });

  const availableProcesses = useMemo(
    () => processes.filter((p) => processAvailableForBranch(p, form.branch)),
    [processes, form.branch],
  );

  useEffect(() => {
    // Reset processId if switching branch makes current one invalid
    if (form.processId && !availableProcesses.find((p) => p.id === form.processId)) {
      setForm((f) => ({ ...f, processId: "" }));
    }
  }, [availableProcesses, form.processId]);

  // Reset subProductId when product changes and current sub-product no longer matches
  useEffect(() => {
    if (form.subProductId && !formSubProducts.find((s) => s.id === form.subProductId)) {
      setForm((f) => ({ ...f, subProductId: "" }));
    }
  }, [formSubProducts, form.subProductId]);

  const resetForm = () => {
    setForm({
      date: todayISO(),
      branch: branchNames[0] ?? "",
      productId: "",
      subProductId: "",
      processId: "",
      target: "",
      manpower: "",
      output: "",
    });
    setEditingId(null);
  };

  const submitEntry = () => {
    if (role?.role !== "manager") return toast.error("Only managers can add or edit entries.");
    if (!form.branch) return toast.error("Select a branch");
    if (!form.productId) return toast.error("Select a product");
    if (!form.processId) return toast.error("Select a process");
    const target = Number(form.target) || 0;
    const manpower = Number(form.manpower) || 0;
    const output = Number(form.output) || 0;

    const subProdId = form.subProductId || undefined;
    const productName = formProducts.find((p) => p.id === form.productId)?.name ?? "";
    const subProductName = subProdId ? formSubProducts.find((s) => s.id === subProdId)?.name ?? "" : "";

    // Uniqueness key now includes product + subproduct + process + date + branch
    const existing = entries.find(
      (e) =>
        e.date === form.date &&
        e.branch === form.branch &&
        e.processId === form.processId &&
        (e.productId ?? "") === form.productId &&
        (e.subProductId ?? "") === (subProdId ?? "") &&
        e.id !== editingId,
    );

    if (editingId) {
      const next = entries.map((e) =>
        e.id === editingId
          ? {
              ...e,
              date: form.date,
              branch: form.branch,
              processId: form.processId,
              productId: form.productId,
              productName,
              subProductId: subProdId,
              subProductName,
              target,
              manpower,
              output,
            }
          : e,
      );
      persistEntries(next);
      toast.success("Entry updated");
    } else if (existing) {
      const next = entries.map((e) =>
        e.id === existing.id ? { ...e, target, manpower, output } : e,
      );
      persistEntries(next);
      toast.success("Existing entry updated (no duplicate created)");
    } else {
      const newEntry: ProcessEntry = {
        id: uid(),
        date: form.date,
        branch: form.branch,
        processId: form.processId,
        productId: form.productId,
        productName,
        subProductId: subProdId,
        subProductName,
        target,
        manpower,
        output,
      };
      persistEntries([newEntry, ...entries]);
      toast.success("Entry added");
    }
    resetForm();
  };

  const editEntry = (e: ProcessEntry) => {
    setEditingId(e.id);
    setForm({
      date: e.date,
      branch: e.branch,
      productId: e.productId ?? "",
      subProductId: e.subProductId ?? "",
      processId: e.processId,
      target: String(e.target),
      manpower: String(e.manpower),
      output: String(e.output),
    });
  };
  const deleteEntry = (id: string) => {
    if (role?.role !== "manager") {
      toast.error("Only managers can delete entries.");
      return;
    }
    persistEntries(entries.filter((e) => e.id !== id));
    toast.success("Entry deleted");
  };

  // ===== Process management =====
  const [newProcName, setNewProcName] = useState("");
  const [newProcBranches, setNewProcBranches] = useState<string[]>([]);
  const [editProcId, setEditProcId] = useState<string | null>(null);
  const [editProcName, setEditProcName] = useState("");
  const [editProcBranches, setEditProcBranches] = useState<string[]>([]);

  const toggleBranch = (list: string[], name: string): string[] =>
    list.includes(name) ? list.filter((b) => b !== name) : [...list, name];

  const addProcess = () => {
    if (role?.role !== "manager") {
      toast.error("Only managers can add processes.");
      return;
    }
    const name = newProcName.trim();
    if (!name) return toast.error("Process name required");
    if (!newProcBranches.length) return toast.error("Select at least one branch");
    persistProcesses([...processes, { id: uid(), name, availableBranches: newProcBranches }]);
    setNewProcName("");
    setNewProcBranches([]);
    toast.success("Process added");
  };
  const startEditProcess = (p: ProcessDef) => {
    setEditProcId(p.id);
    setEditProcName(p.name);
    setEditProcBranches(p.availableBranches);
  };
  const saveEditProcess = () => {
    if (role?.role !== "manager") {
      toast.error("Only managers can edit processes.");
      return;
    }
    if (!editProcName.trim() || !editProcId) return;
    if (!editProcBranches.length) return toast.error("Select at least one branch");
    persistProcesses(
      processes.map((p) =>
        p.id === editProcId
          ? { ...p, name: editProcName.trim(), availableBranches: editProcBranches }
          : p,
      ),
    );
    setEditProcId(null);
    toast.success("Process updated");
  };
  const deleteProcess = (id: string) => {
    if (role?.role !== "manager") {
      toast.error("Only managers can delete processes.");
      return;
    }
    if (!confirm("Delete this process? Existing entries that reference it will remain.")) return;
    persistProcesses(processes.filter((p) => p.id !== id));
    toast.success("Process deleted");
  };

  // ===== Filters =====
  const [fDate, setFDate] = useState("");
  const [fBranch, setFBranch] = useState("__all");
  const [fProduct, setFProduct] = useState("__all");
  const [fSubProduct, setFSubProduct] = useState("__all");
  const [fProcess, setFProcess] = useState("__all");

  // Sub-products for the filter (depends on selected product filter)
  const { data: filterSubProducts = [] } = useQuery({
    queryKey: ["sub_products", fProduct],
    enabled: fProduct !== "__all" && !!fProduct,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sub_products")
        .select("id, name, product_id")
        .eq("product_id", fProduct)
        .order("name");
      if (error) throw error;
      return data as Array<{ id: string; name: string; product_id: string }>;
    },
  });

  // Reset dependent filters when their parent changes.
  useEffect(() => {
    if (fProduct === "__all") {
      if (fSubProduct !== "__all") setFSubProduct("__all");
      return;
    }
    if (fSubProduct !== "__all" && !filterSubProducts.find((s) => s.id === fSubProduct)) {
      setFSubProduct("__all");
    }
  }, [fProduct, filterSubProducts, fSubProduct]);

  // Which processes are valid given the current product/subproduct filter:
  // a process is "relevant" if at least one entry exists for that subproduct (or product)
  // referencing it. When no product/subproduct is chosen, all processes are listed.
  const relevantProcessIds = useMemo(() => {
    if (fProduct === "__all" && fSubProduct === "__all") return null;
    const ids = new Set<string>();
    entries.forEach((e) => {
      if (fProduct !== "__all" && (e.productId ?? "") !== fProduct) return;
      if (fSubProduct !== "__all" && (e.subProductId ?? "") !== fSubProduct) return;
      ids.add(e.processId);
    });
    return ids;
  }, [entries, fProduct, fSubProduct]);

  const filtered = useMemo(() => {
    // Require specific values on date, branch, product, and process before showing data
    if (!fDate || fBranch === "__all" || fProduct === "__all" || fProcess === "__all") return [];
    return entries.filter(
      (e) =>
        e.date === fDate &&
        e.branch === fBranch &&
        (e.productId ?? "") === fProduct &&
        (fSubProduct === "__all" || (e.subProductId ?? "") === fSubProduct) &&
        e.processId === fProcess,
    );
  }, [entries, fDate, fBranch, fProduct, fSubProduct, fProcess]);

  const procName = (id: string) => processes.find((p) => p.id === id)?.name || "(deleted)";

  // ===== Insights =====
  const totals = useMemo(() => {
    const t = filtered.reduce((s, e) => s + e.target, 0);
    const o = filtered.reduce((s, e) => s + e.output, 0);
    const eff = filtered.length
      ? Math.round(
          filtered.reduce((s, e) => s + efficiency(e.target, e.output), 0) / filtered.length,
        )
      : 0;
    return { t, o, eff };
  }, [filtered]);

  const procEff = useMemo(() => {
    const map = new Map<string, { target: number; output: number }>();
    filtered.forEach((e) => {
      const cur = map.get(e.processId) || { target: 0, output: 0 };
      cur.target += e.target;
      cur.output += e.output;
      map.set(e.processId, cur);
    });
    return Array.from(map.entries()).map(([id, v]) => ({
      name: procName(id),
      target: v.target,
      output: v.output,
      efficiency: efficiency(v.target, v.output),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, processes]);

  // Branch checkbox group used in "Available in" cells.
  const BranchCheckboxes = ({
    selected,
    onChange,
    processName,
  }: {
    selected: string[];
    onChange: (next: string[]) => void;
    processName: string;
  }) => {
    return (
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {branchNames.length === 0 && (
          <span className="text-xs text-muted-foreground">No branches configured</span>
        )}
        {branchNames.map((b) => {
          const id = `chk-${processName}-${b}`;
          return (
            <label
              key={b}
              htmlFor={id}
              className="inline-flex items-center gap-2 text-sm cursor-pointer"
            >
              <Checkbox
                id={id}
                checked={selected.includes(b)}
                onCheckedChange={() => onChange(toggleBranch(selected, b))}
              />
              <span>{b}</span>
            </label>
          );
        })}
      </div>
    );
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight">
            Process <span className="text-gradient">Management</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track per-process daily efficiency. Lagging processes are highlighted in red.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KpiCard label="Total Target" value={totals.t} icon={Target} />
        <KpiCard label="Total Output" value={totals.o} icon={CheckCircle2} />
        <KpiCard
          label="Average Efficiency"
          value={`${totals.eff}%`}
          icon={Percent}
          tone={totals.eff >= 80 ? "success" : "danger"}
        />
      </div>

      {/* Entry form */}
      <section className="glass rounded-2xl p-4 md:p-6 mb-6">
        <h2 className="font-display text-xl font-semibold mb-4">
          {editingId ? "Edit Entry" : "Add / Update Entry"}
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitEntry();
          }}
        >
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div className="col-span-2 md:col-span-1">
              <Label>Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </div>
            <div>
              <Label>Branch</Label>
              <Select
                value={form.branch || undefined}
                onValueChange={(v) => setForm({ ...form, branch: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {branchNames.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Product</Label>
              <Select
                value={form.productId || undefined}
                onValueChange={(v) => setForm({ ...form, productId: v, subProductId: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {formProducts.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No products
                    </SelectItem>
                  )}
                  {formProducts.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subproduct</Label>
              <Select
                value={form.subProductId || undefined}
                onValueChange={(v) => setForm({ ...form, subProductId: v })}
                disabled={!form.productId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={form.productId ? "Select" : "Pick product first"} />
                </SelectTrigger>
                <SelectContent>
                  {formSubProducts.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No subproducts
                    </SelectItem>
                  )}
                  {formSubProducts.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Process</Label>
              <Select
                value={form.processId}
                onValueChange={(v) => setForm({ ...form, processId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {availableProcesses.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target</Label>
              <Input
                type="number"
                min="0"
                value={form.target}
                onChange={(e) => setForm({ ...form, target: e.target.value })}
              />
            </div>
            <div>
              <Label>Manpower</Label>
              <Input
                type="number"
                min="0"
                value={form.manpower}
                onChange={(e) => setForm({ ...form, manpower: e.target.value })}
              />
            </div>
            <div>
              <Label>Output</Label>
              <Input
                type="number"
                min="0"
                value={form.output}
                onChange={(e) => setForm({ ...form, output: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button type="submit" disabled={role?.role !== "manager"}>
              <Save className="h-4 w-4 mr-1" /> {editingId ? "Save Changes" : "Save Entry"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </form>
      </section>

      {/* Filters */}
      <section className="glass rounded-2xl p-4 md:p-6 mb-6">
        <h2 className="font-display text-xl font-semibold mb-4">Daily Tracking</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <Label>Filter Date</Label>
            <Input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
          </div>
          <div>
            <Label>Filter Branch</Label>
            <Select value={fBranch} onValueChange={setFBranch}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All branches</SelectItem>
                {branchNames.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filter Product</Label>
            <Select
              value={fProduct}
              onValueChange={(v) => {
                setFProduct(v);
                setFSubProduct("__all");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filter Subproduct</Label>
            <Select
              value={fSubProduct}
              onValueChange={setFSubProduct}
              disabled={fProduct === "__all"}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={fProduct === "__all" ? "Pick product first" : "All subproducts"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All subproducts</SelectItem>
                {filterSubProducts.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Filter Process</Label>
            <Select value={fProcess} onValueChange={setFProcess}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All processes</SelectItem>
                {processes
                  .filter((p) => fBranch === "__all" || processAvailableForBranch(p, fBranch))
                  .filter((p) => !relevantProcessIds || relevantProcessIds.has(p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFDate("");
                setFBranch("__all");
                setFProduct("__all");
                setFSubProduct("__all");
                setFProcess("__all");
              }}
            >
              Clear filters
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Subproduct</TableHead>
                <TableHead>Process</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Manpower</TableHead>
                <TableHead className="text-right">Output</TableHead>
                <TableHead className="text-right">Efficiency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    No entries
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((e) => {
                const eff = efficiency(e.target, e.output);
                const lag = eff < 80;
                return (
                  <TableRow key={e.id} className={lag ? "bg-red-500/5" : ""}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>{e.branch}</TableCell>
                    <TableCell>
                      {e.productName || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {e.subProductName || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>{procName(e.processId)}</TableCell>
                    <TableCell className="text-right">{e.target}</TableCell>
                    <TableCell className="text-right">{e.manpower}</TableCell>
                    <TableCell className="text-right">{e.output}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${lag ? "text-red-500" : "text-emerald-500"}`}
                    >
                      {eff}%
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${lag ? "bg-red-500/15 text-red-500" : "bg-emerald-500/15 text-emerald-500"}`}
                      >
                        {lag ? "🔴 Lagging" : "✅ Good"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editEntry(e)}
                        disabled={role?.role !== "manager"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEntry(e.id)}
                        disabled={role?.role !== "manager"}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>



      {/* Process management */}
      <section className="glass rounded-2xl p-4 md:p-6 mb-6">
        <h2 className="font-display text-xl font-semibold mb-4">Manage Processes</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addProcess();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4 items-start"
        >
          <div className="md:col-span-4">
            <Label>New process name</Label>
            <Input
              value={newProcName}
              onChange={(e) => {
                setNewProcName(e.target.value);
              }}
              placeholder="e.g. Quality Check"
            />
          </div>
          <div className="md:col-span-6">
            <Label>Available in</Label>
            <div className="mt-2 rounded-md border border-border bg-background/40 p-3">
              <BranchCheckboxes
                selected={newProcBranches}
                onChange={setNewProcBranches}
                processName={newProcName}
              />

            </div>
          </div>
          <div className="md:col-span-2 flex items-end h-full">
            <Button type="submit" className="w-full" disabled={role?.role !== "manager"}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </form>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Process</TableHead>
              <TableHead>Available in</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {processes.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="align-top">
                  {editProcId === p.id ? (
                    <Input
                      value={editProcName}
                      onChange={(e) => setEditProcName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEditProcess();
                        }
                      }}
                    />
                  ) : (
                    <span className="flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-primary" /> {p.name}
                    </span>
                  )}
                </TableCell>
                <TableCell className="align-top">
                  {editProcId === p.id ? (
                    <BranchCheckboxes
                      selected={editProcBranches}
                      onChange={setEditProcBranches}
                      processName={editProcName}
                    />
                  ) : p.availableBranches.length === 0 ? (
                    <span className="text-xs text-muted-foreground">— none —</span>
                  ) : p.availableBranches.length === branchNames.length &&
                    branchNames.length > 0 ? (
                    <span className="text-sm">All branches</span>
                  ) : (
                    <span className="text-sm">{p.availableBranches.join(", ")}</span>
                  )}
                </TableCell>
                <TableCell className="text-right align-top">
                  {editProcId === p.id ? (
                    <>
                      <Button
                        size="sm"
                        onClick={saveEditProcess}
                        disabled={role?.role !== "manager"}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditProcId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => startEditProcess(p)}
                        disabled={role?.role !== "manager"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteProcess(p.id)}
                        disabled={role?.role !== "manager"}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </AppShell>
  );
}
