import { useState } from "react";
import { useNavigate, Link, useLocation } from "@/lib/router-shim";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
});

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
        const from = (location.state as any)?.from?.pathname || "/";
        navigate(from, { replace: true });
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast.success("Account created — you can sign in");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      <div className="w-full max-w-md glass rounded-2xl p-8 animate-fade-in">
        <div className="flex justify-center mb-6"><Logo size="lg" /></div>
        <h1 className="text-2xl font-display font-bold text-center mb-1">
          {mode === "login" ? "Manager Sign In" : "Create Manager Account"}
        </h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {mode === "login" ? "Access your factory's live production pulse." : "Set up your shared factory account."}
        </p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
          </div>
          <div>
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              {mode === "login" && (
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
              )}
            </div>
            <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
          </div>
          <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary font-semibold" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "login" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-6">
          {mode === "login" ? "No account yet? " : "Already have one? "}
          <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary hover:underline font-medium">
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}
