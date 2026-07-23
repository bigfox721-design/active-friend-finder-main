import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Branch = { id: string; name: string };

type Ctx = {
  branchId: string | null;
  setBranchId: (id: string) => void;
  branches: Branch[];
  loading: boolean;
};

const BranchCtx = createContext<Ctx>({
  branchId: null,
  setBranchId: () => {},
  branches: [],
  loading: true,
});

const STORAGE_KEY = "selected_branch_id";

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [branchId, setBranchIdState] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null,
  );

  const safeSet = (id: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, id);
  };

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return data as Branch[];
    },
  });

  useEffect(() => {
    if (!branchId && branches.length) {
      const first = branches[0].id;
      setBranchIdState(first);
      safeSet(first);
    } else if (branchId && branches.length && !branches.find((b) => b.id === branchId)) {
      const first = branches[0].id;
      setBranchIdState(first);
      safeSet(first);
    }
  }, [branches, branchId]);

  const setBranchId = (id: string) => {
    setBranchIdState(id);
    safeSet(id);
  };

  return (
    <BranchCtx.Provider value={{ branchId, setBranchId, branches, loading: isLoading }}>
      {children}
    </BranchCtx.Provider>
  );
};

export const useBranch = () => useContext(BranchCtx);
