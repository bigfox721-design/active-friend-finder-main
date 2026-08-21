import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "@/lib/router-shim";
import { gsap } from "gsap";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Eye, EyeOff, Loader2 } from "lucide-react";
import character from "@/assets/login-character.png";

const schema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Min 6 characters").max(72),
});

export default function Login() {
  const navigate = useNavigate();

  const characterRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const fieldsRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.fromTo(
        cardRef.current,
        { y: 50, opacity: 0, scale: 0.94 },
        { y: 0, opacity: 1, scale: 1, duration: 0.75, ease: "back.out(1.6)" }
      )
        .fromTo(
          [logoRef.current, titleRef.current, subRef.current],
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.45, stagger: 0.09 },
          "-=0.4"
        )
        .fromTo(
          fieldsRef.current?.children ?? [],
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, stagger: 0.1 },
          "-=0.25"
        )
        .fromTo(
          btnRef.current,
          { y: 18, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4 },
          "-=0.1"
        )
        .fromTo(
          footerRef.current,
          { opacity: 0 },
          { opacity: 1, duration: 0.35 },
          "-=0.2"
        );
    });
    return () => ctx.revert();
  }, []);

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
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const metaRole = userData.user.user_metadata?.role as string | undefined;
          let role = "user";
          if (metaRole === "manager") {
            role = "manager";
          } else {
            const { data: appUser } = await (supabase as any)
              .from("users")
              .select("role")
              .eq("id", userData.user.id)
              .maybeSingle();
            role = appUser?.role ?? "user";
          }
          await (supabase as any).from("activity_logs").insert({
            action: "user_login",
            description: `User logged in: ${userData.user.email}`,
            user_id: userData.user.id,
            user_name: userData.user.email?.split("@")[0] ?? "Unknown",
            user_role: role,
          }).then(({ error: logErr }: any) => {
            if (logErr) console.error("Failed to log login event:", logErr);
          });
          navigate(role === "manager" ? "/manager-dashboard" : "/user-dashboard", {
            replace: true,
          });
        } else {
          navigate("/", { replace: true });
        }
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { role: "manager" },
          },
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
    <div className="min-h-screen grid-bg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />

      <div className="relative w-full max-w-5xl flex items-center justify-center">
        <div
          ref={characterRef}
          className="hidden md:block absolute left-0 bottom-0 h-full w-auto max-w-[260px] lg:max-w-[320px] select-none pointer-events-none drop-shadow-2xl z-10"
          style={{ transformOrigin: "bottom center" }}
        >
          <img
            src={character}
            alt=""
            width={420}
            height={700}
            className="h-full w-auto max-w-full object-contain object-bottom"
            style={{ transformOrigin: "bottom center" }}
          />
        </div>

        <div
          ref={cardRef}
          className="relative w-full max-w-md md:ml-[260px] lg:ml-52 glass rounded-2xl p-8"
        >
          <div ref={logoRef} className="flex justify-center mb-6">
            <div className="flex items-center gap-2.5">
              <div className="grid place-items-center rounded-xl bg-gradient-primary p-2 shadow-glow-primary">
                <Activity className="h-8 w-8 text-primary-foreground" strokeWidth={2.5} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-bold tracking-tight text-3xl text-foreground">
                  BigFox<span className="text-gradient"> Pulse</span>
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                  Production Dashboard
                </span>
              </div>
            </div>
          </div>

          <h1
            ref={titleRef}
            className="text-2xl font-bold text-center mb-1 text-foreground"
          >
            {mode === "login" ? "Sign In" : "Create Account"}
          </h1>
          <p
            ref={subRef}
            className="text-sm text-muted-foreground text-center mb-6"
          >
            {mode === "login"
              ? "Access your factory's live production pulse."
              : "Set up your shared factory account."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div ref={fieldsRef} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  maxLength={255}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md bg-secondary/40 border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  {mode === "login" && (
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                      Forgot?
                    </Link>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    maxLength={72}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 w-full rounded-md bg-secondary/40 border border-border px-3 py-2 pr-10 text-sm text-foreground outline-none focus:ring-ring focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-primary hover:bg-primary/15"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              ref={btnRef}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 shadow-glow-primary font-semibold rounded-md py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-70 transition-opacity"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div ref={footerRef} className="text-center text-sm text-muted-foreground mt-6">
            {mode === "login" ? "No account yet? " : "Already have one? "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-primary hover:underline font-medium"
            >
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
