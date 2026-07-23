import { Activity } from "lucide-react";
import { Link } from "@/lib/router-shim";

export const Logo = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const text = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const icon = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <Link to="/" className="flex items-center gap-2.5 group">
      <div
        className={`grid place-items-center rounded-xl bg-gradient-primary p-2 shadow-glow-primary group-hover:scale-105 transition-smooth`}
      >
        <Activity className={`${icon} text-primary-foreground`} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-display font-bold tracking-tight ${text}`}>
          BigFox<span className="text-gradient"> Pulse</span>
        </span>
        {size !== "sm" && (
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Production Dashboard
          </span>
        )}
      </div>
    </Link>
  );
};
