import { useBranch } from "@/hooks/useBranch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

export const BranchSelector = ({ className }: { className?: string }) => {
  const { branchId, setBranchId, branches } = useBranch();
  if (!branches.length) return null;
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select value={branchId ?? undefined} onValueChange={setBranchId}>
        <SelectTrigger className="min-w-[160px]">
          <SelectValue placeholder="Select branch" />
        </SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
