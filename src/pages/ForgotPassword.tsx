import { useState } from "react";
import { Link } from "@/lib/router-shim";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter a valid email");
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      toast.success("Reset link sent — check your email");
    } catch (err: any) {
      toast.error(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md glass rounded-2xl p-8 animate-fade-in">
        <div className="flex justify-center mb-6"><Logo size="lg" /></div>
        <h1 className="text-2xl font-display font-bold text-center mb-1">Reset password</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          We'll email you a secure link to set a new password.
        </p>
        {sent ? (
          <div className="text-center py-6">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/15 grid place-items-center mb-3 shadow-glow-primary">✓</div>
            <p className="text-sm">If an account exists for <b>{email}</b>, a reset link is on its way.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
            </div>
            <Button type="submit" className="w-full bg-gradient-primary text-primary-foreground shadow-glow-primary font-semibold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}
        <Link to="/login" className="mt-6 flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
