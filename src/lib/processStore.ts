// Local storage backed store for Process Management module.
// Kept fully isolated from existing production data to avoid impacting current features.

export type ProcessDef = {
  id: string;
  name: string;
  availableBranches: string[]; // dynamic branch names; empty = none
};

export type ProcessEntry = {
  id: string;
  date: string;        // YYYY-MM-DD
  branch: string;      // branch name
  processId: string;
  productId?: string;       // linked product (optional for backwards-compat)
  productName?: string;     // denormalized for display
  subProductId?: string;    // linked sub-product
  subProductName?: string;  // denormalized for display
  target: number;
  manpower: number;
  output: number;
};

const PROC_KEY = "pm_processes_v2";
const LEGACY_PROC_KEY = "pm_processes_v1";
const ENTRY_KEY = "pm_entries_v1";

// Constants used for legacy migration and the Raw Materials Cutting special rule.
export const KISHKINDA = "Kishkinda";
export const THIRUMUDIVAKKAM = "Thirumudivakkam";
export const RAW_CUTTING_NAME = "Raw Materials Cutting";

const DEFAULT_PROCESSES: ProcessDef[] = [
  { id: "p_raw_cutting", name: RAW_CUTTING_NAME, availableBranches: [KISHKINDA] },
  { id: "p_base_framing", name: "Base Framing", availableBranches: [KISHKINDA, THIRUMUDIVAKKAM] },
  { id: "p_full_setting", name: "Full Setting", availableBranches: [KISHKINDA, THIRUMUDIVAKKAM] },
  { id: "p_full_welding", name: "Full Welding", availableBranches: [KISHKINDA, THIRUMUDIVAKKAM] },
  { id: "p_paint_pack", name: "Painting and Packaging", availableBranches: [KISHKINDA, THIRUMUDIVAKKAM] },
];

const isBrowser = typeof window !== "undefined";

type LegacyProcessDef = {
  id: string;
  name: string;
  branchScope?: "kishkinda" | "both";
  availableBranches?: string[];
};

function migrate(list: LegacyProcessDef[]): ProcessDef[] {
  return list.map((p) => {
    if (Array.isArray(p.availableBranches)) {
      return { id: p.id, name: p.name, availableBranches: p.availableBranches };
    }
    const ab = p.branchScope === "both" ? [KISHKINDA, THIRUMUDIVAKKAM] : [KISHKINDA];
    return { id: p.id, name: p.name, availableBranches: ab };
  });
}

export function loadProcesses(): ProcessDef[] {
  if (!isBrowser) return DEFAULT_PROCESSES;
  try {
    const raw = window.localStorage.getItem(PROC_KEY);
    if (raw) return JSON.parse(raw) as ProcessDef[];
    const legacy = window.localStorage.getItem(LEGACY_PROC_KEY);
    if (legacy) {
      const migrated = migrate(JSON.parse(legacy));
      window.localStorage.setItem(PROC_KEY, JSON.stringify(migrated));
      return migrated;
    }
    window.localStorage.setItem(PROC_KEY, JSON.stringify(DEFAULT_PROCESSES));
    return DEFAULT_PROCESSES;
  } catch {
    return DEFAULT_PROCESSES;
  }
}

export function saveProcesses(list: ProcessDef[]) {
  if (!isBrowser) return;
  window.localStorage.setItem(PROC_KEY, JSON.stringify(list));
}

export function loadEntries(): ProcessEntry[] {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(ENTRY_KEY);
    return raw ? (JSON.parse(raw) as ProcessEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveEntries(list: ProcessEntry[]) {
  if (!isBrowser) return;
  window.localStorage.setItem(ENTRY_KEY, JSON.stringify(list));
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function processAvailableForBranch(p: ProcessDef, branch: string) {
  return p.availableBranches.includes(branch);
}

export function efficiency(target: number, output: number) {
  if (!target || target <= 0) return 0;
  return Math.round((output / target) * 100);
}

// Drop branch names from availableBranches that no longer exist in the system.
export function pruneProcessBranches(list: ProcessDef[], validBranches: string[]): ProcessDef[] {
  const set = new Set(validBranches);
  return list.map((p) => {
    const filtered = p.availableBranches.filter((b) => set.has(b));
    if (filtered.length === p.availableBranches.length) return p;
    return { ...p, availableBranches: filtered };
  });
}

// Enforce the Raw Materials Cutting → Kishkinda-only rule.
export function isRawCutting(name: string) {
  return name.trim().toLowerCase() === RAW_CUTTING_NAME.toLowerCase();
}
