import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const PageTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h1
    className={cn(
      "font-display text-3xl md:text-4xl font-bold tracking-tight",
      className,
    )}
  >
    {children}
  </h1>
);
