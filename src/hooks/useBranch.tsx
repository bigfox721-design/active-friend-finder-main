import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

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
  const { user } = useAuth();
  // Remember the selected branch per logged-in account, so two users testing
  // in the same browser don't share one branch selection.
  const storageKey = user?.id ? `${STORAGE_KEY}_${user.id}` : STORAGE_KEY;

  const readStored = () =>
    typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;

  const [branchId, setBranchIdState] = useState<string | null>(() => readStored());

  const safeSet = (id: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, id);
  };

  // When the logged-in user changes, load that user's branch preference.
  useEffect(() => {
    setBranchIdState(readStored());
  }, [storageKey]);

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
