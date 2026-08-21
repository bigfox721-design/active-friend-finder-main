import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { User, Bell, Palette, Mail, Save, Send, Loader2, Trash2, AlertTriangle, Eye, EyeOff } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { useClearAllData } from "@/hooks/useClearAllData";
import { saveSmtpConfig, getSmtpConfig, sendTestEmail } from "@/lib/smtp.functions";

const NOTIF_KEY = "bfp-notifications-enabled";

type SmtpForm = {
  smtp_email: string;
  smtp_password: string;
  smtp_host: string;
  smtp_port: string;
};

const DEFAULT_SMTP: SmtpForm = {
  smtp_email: "",
  smtp_password: "",
  smtp_host: "smtp.gmail.com",
  smtp_port: "587",
};

export default function Settings() {
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const { theme, toggle } = useTheme();

  const [username, setUsername] = useState("");
  const [notifications, setNotifications] = useState(true);

  const [smtp, setSmtp] = useState<SmtpForm>(DEFAULT_SMTP);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearTyped, setClearTyped] = useState("");
  const clearAllData = useClearAllData();

  const fetchSmtp = useServerFn(getSmtpConfig);
  const persistSmtp = useServerFn(saveSmtpConfig);
  const sendTest = useServerFn(sendTestEmail);

  useEffect(() => {
    if (profile?.display_name) setUsername(profile.display_name);
  }, [profile?.display_name]);

  useEffect(() => {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw !== null) setNotifications(raw === "true");
  }, []);

  useEffect(() => {
    fetchSmtp()
      .then((r) => {
        if (r?.config) {
          const c = r.config as Partial<SmtpForm> & { smtp_port?: number };
          setSmtp({
            smtp_email: c.smtp_email ?? "",
            smtp_password: "",
            smtp_host: c.smtp_host ?? "smtp.gmail.com",
            smtp_port: String(c.smtp_port ?? 587),
          });
          if (!testTo && c.smtp_email) setTestTo(c.smtp_email);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveUsername = async () => {
    const name = username.trim();
    if (!name) return toast.error("Username cannot be empty");
    if (name.length > 60) return toast.error("Username too long");
    try {
      await updateProfile.mutateAsync({ display_name: name });
      toast.success("Username updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const onToggleNotif = (v: boolean) => {
    setNotifications(v);
    localStorage.setItem(NOTIF_KEY, String(v));
    toast.success(v ? "Notifications enabled" : "Notifications disabled");
  };

  const validateSmtp = (): string | null => {
    if (!/^\S+@\S+\.\S+$/.test(smtp.smtp_email)) return "Enter a valid SMTP email";
    if (!smtp.smtp_password.trim()) return "SMTP password is required";
    if (!smtp.smtp_host.trim()) return "SMTP host is required";
    const port = Number(smtp.smtp_port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return "Port must be 1–65535";
    return null;
  };

  const onSaveSmtp = async () => {
    const err = validateSmtp();
    if (err) return toast.error(err);
    setSavingSmtp(true);
    try {
      await persistSmtp({
        data: {
          smtp_email: smtp.smtp_email.trim(),
          smtp_password: smtp.smtp_password,
          smtp_host: smtp.smtp_host.trim(),
          smtp_port: Number(smtp.smtp_port),
          smtp_secure: Number(smtp.smtp_port) === 465,
        },
      });
      toast.success("Email configuration saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleClearAllData = async () => {
    if (clearTyped !== "DELETE") return;
    try {
      await clearAllData.mutateAsync();
      toast.success("All data cleared");
      setClearConfirm(false);
      setClearTyped("");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to clear data");
    }
  };

  const onSendTest = async () => {
    if (!/^\S+@\S+\.\S+$/.test(testTo)) return toast.error("Enter a valid recipient email");
    setSendingTest(true);
    try {
      await sendTest({ data: { to: testTo.trim() } });
      toast.success(`Test email sent to ${testTo}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight mb-1">Settings <span className="text-gradient">Center</span></h1>
        <p className="text-muted-foreground text-sm">
          Manage your profile, appearance, alerts, and email server.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Profile */}
        <Card className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Profile</h2>
          </div>
          <Label className="font-medium" htmlFor="username">
            Username
          </Label>
          <form
            className="flex gap-2 mt-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveUsername();
            }}
          >
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={60}
              placeholder="Your display name"
            />
            <Button type="submit" disabled={updateProfile.isPending} className="gap-2">
              {updateProfile.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </Button>
          </form>
        </Card>

        {/* Appearance */}
        <Card className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Appearance</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Dark mode</Label>
              <p className="text-xs text-muted-foreground">Toggle between light and dark theme.</p>
            </div>
            <Switch checked={theme === "dark"} onCheckedChange={toggle} />
          </div>
        </Card>

        {/* Notifications */}
        <Card className="glass rounded-2xl p-6 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Notifications</h2>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Enable notifications</Label>
              <p className="text-xs text-muted-foreground">
                Send email alerts when daily production targets are missed. Requires SMTP
                configuration below.
              </p>
            </div>
            <Switch checked={notifications} onCheckedChange={onToggleNotif} />
          </div>
        </Card>

        {/* Email Configuration */}
        <Card className="glass rounded-2xl p-6 md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg font-semibold">Email Configuration</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Configure an SMTP server (e.g. Gmail with an App Password) to send transactional emails
            like signup verification.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSaveSmtp();
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="font-medium" htmlFor="smtp_email">
                  SMTP Email
                </Label>
                <Input
                  id="smtp_email"
                  type="email"
                  value={smtp.smtp_email}
                  onChange={(e) => setSmtp({ ...smtp, smtp_email: e.target.value })}
                  placeholder="you@gmail.com"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label className="font-medium" htmlFor="smtp_password">
                  SMTP Password (App Password)
                </Label>
                <div className="relative">
                  <Input
                    id="smtp_password"
                    type={showSmtpPassword ? "text" : "password"}
                    value={smtp.smtp_password}
                    onChange={(e) => setSmtp({ ...smtp, smtp_password: e.target.value })}
                    placeholder="••••••••••••"
                    className="mt-2 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSmtpPassword((s) => !s)}
                    aria-label={showSmtpPassword ? "Hide SMTP password" : "Show SMTP password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-primary hover:bg-primary/15"
                  >
                    {showSmtpPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label className="font-medium" htmlFor="smtp_host">
                  SMTP Host
                </Label>
                <Input
                  id="smtp_host"
                  value={smtp.smtp_host}
                  onChange={(e) => setSmtp({ ...smtp, smtp_host: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label className="font-medium" htmlFor="smtp_port">
                  SMTP Port
                </Label>
                <Input
                  id="smtp_port"
                  type="number"
                  min={1}
                  max={65535}
                  value={smtp.smtp_port}
                  onChange={(e) => setSmtp({ ...smtp, smtp_port: e.target.value })}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <Button
                type="submit"
                disabled={savingSmtp}
                className="bg-gradient-primary text-primary-foreground gap-2"
              >
                {savingSmtp ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Configuration
              </Button>
            </div>
          </form>

          <form
            className="mt-6 flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              onSendTest();
            }}
          >
            <div className="flex-1 min-w-[220px]">
              <Label className="font-medium" htmlFor="test_to">
                Send Test Email to
              </Label>
              <Input
                id="test_to"
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="recipient@example.com"
                className="mt-2"
              />
            </div>
            <Button type="submit" disabled={sendingTest} variant="outline" className="gap-2">
              {sendingTest ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Test Email
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            <strong>Gmail users:</strong> Enable{" "}
            <a
              href="https://myaccount.google.com/security"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              2-Step Verification
            </a>
            , then create an{" "}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              App Password
            </a>{" "}
            (16 chars) and paste it above — your regular password won't work.
          </p>
        </Card>
      </div>

      {/* Clear All Data */}
      <Card className="glass rounded-2xl p-6 mt-6 border-destructive/30">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="h-5 w-5 text-destructive" />
          <h2 className="font-display text-lg font-semibold text-destructive">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          This will permanently delete all products, inventory, sales, production entries, raw
          materials, accessories, stock entries, activity logs, and all other business data. Branches,
          users, and roles will be preserved.
        </p>
        {!clearConfirm ? (
          <Button
            variant="destructive"
            onClick={() => setClearConfirm(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Clear All Data
          </Button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-destructive">
              Type <span className="font-mono bg-destructive/10 px-1.5 py-0.5 rounded">DELETE</span> below and click Confirm to proceed.
            </p>
            <div className="flex gap-2">
              <Input
                value={clearTyped}
                onChange={(e) => setClearTyped(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="max-w-xs"
              />
              <Button
                variant="destructive"
                disabled={clearTyped !== "DELETE" || clearAllData.isPending}
                onClick={handleClearAllData}
              >
                {clearAllData.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Confirm
              </Button>
              <Button
                variant="outline"
                onClick={() => { setClearConfirm(false); setClearTyped(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
