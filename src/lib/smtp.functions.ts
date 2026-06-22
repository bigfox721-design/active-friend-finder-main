import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import nodemailer from "nodemailer";

const ConfigSchema = z.object({
  smtp_email: z.string().trim().email().max(255),
  smtp_password: z.string().min(1).max(500),
  smtp_host: z.string().trim().min(1).max(255),
  smtp_port: z.number().int().min(1).max(65535),
  smtp_secure: z.boolean().optional().default(false),
});

export const saveSmtpConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ConfigSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await (supabase as any)
      .from("smtp_config")
      .upsert({ user_id: userId, ...data }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSmtpConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await (supabase as any)
      .from("smtp_config")
      .select("smtp_email, smtp_host, smtp_port, smtp_secure")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { config: data ?? null };
  });

export const sendMissedTargetAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cfg, error: cfgErr } = await (supabase as any)
      .from("smtp_config")
      .select("smtp_email, smtp_password, smtp_host, smtp_port, smtp_secure")
      .eq("user_id", userId)
      .maybeSingle();
    if (cfgErr) throw new Error(cfgErr.message);
    if (!cfg) return { sent: false, reason: "no-smtp" };

    const c = cfg as unknown as {
      smtp_email: string; smtp_password: string; smtp_host: string;
      smtp_port: number; smtp_secure: boolean;
    };

    // Get today's entries
    const today = new Date().toISOString().slice(0, 10);
    const { data: entries, error: entErr } = await (supabase as any)
      .from("production_entries")
      .select("product_id, target_qty, completed_qty, manpower")
      .eq("entry_date", today);
    if (entErr) throw new Error(entErr.message);

    const missed = (entries ?? []).filter(
      (e: any) => e.target_qty > 0 && Number(e.completed_qty) < Number(e.target_qty),
    );
    if (missed.length === 0) return { sent: false, reason: "none-missed" };

    const total = (entries ?? []).reduce((s: number, e: any) => s + Number(e.target_qty), 0);
    const done = (entries ?? []).reduce((s: number, e: any) => s + Number(e.completed_qty), 0);

    const transporter = nodemailer.createTransport({
      host: c.smtp_host,
      port: c.smtp_port,
      secure: c.smtp_secure || c.smtp_port === 465,
      auth: { user: c.smtp_email, pass: c.smtp_password },
    });

    try {
      await transporter.sendMail({
        from: c.smtp_email,
        to: c.smtp_email,
        subject: `⚠️ ${missed.length} product(s) missed target today`,
        html: `
          <h2>Production Alert — ${today}</h2>
          <p><strong>${missed.length}</strong> product(s) below today's target.</p>
          <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:600px">
            <tr style="background:#f3f4f6"><th>Product</th><th>Target</th><th>Completed</th><th>%</th></tr>
            ${missed.map((m: any) => `
              <tr>
                <td>${m.product_id}</td>
                <td align="right">${m.target_qty}</td>
                <td align="right">${m.completed_qty ?? 0}</td>
                <td align="right">${m.target_qty > 0 ? Math.round((Number(m.completed_qty) / Number(m.target_qty)) * 100) : 0}%</td>
              </tr>
            `).join("")}
          </table>
          <p style="margin-top:16px">Overall: <strong>${done}/${total}</strong> (${total > 0 ? Math.round((done / total) * 100) : 0}%)</p>
        `,
      });
      return { sent: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      if (msg.includes("535") || msg.includes("Username and Password") || msg.includes("authentication")) {
        throw new Error(
          "Gmail rejected the credentials. Ensure you:\n" +
          "1. Enabled 2-Step Verification at https://myaccount.google.com/security\n" +
          "2. Created an App Password at https://myaccount.google.com/apppasswords\n" +
          "3. Pasted the 16-character App Password (spaces optional) — NOT your regular password"
        );
      }
      throw new Error(msg);
    }
  });

export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ to: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: cfg, error } = await (supabase as any)
      .from("smtp_config")
      .select("smtp_email, smtp_password, smtp_host, smtp_port, smtp_secure")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cfg) throw new Error("No SMTP configuration saved. Please save your settings first.");

    const c = cfg as unknown as {
      smtp_email: string;
      smtp_password: string;
      smtp_host: string;
      smtp_port: number;
      smtp_secure: boolean;
    };

    const transporter = nodemailer.createTransport({
      host: c.smtp_host,
      port: c.smtp_port,
      secure: c.smtp_secure || c.smtp_port === 465,
      auth: { user: c.smtp_email, pass: c.smtp_password },
    });

    try {
      const info = await transporter.sendMail({
        from: c.smtp_email,
        to: data.to,
        subject: "SMTP test email",
        text: "Your SMTP configuration is working correctly.",
        html: "<p>Your <strong>SMTP configuration</strong> is working correctly.</p>",
      });
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to send";
      if (msg.includes("535") || msg.includes("Username and Password") || msg.includes("authentication")) {
        throw new Error(
          "Gmail rejected the credentials. Ensure you:\n" +
          "1. Enabled 2-Step Verification at https://myaccount.google.com/security\n" +
          "2. Created an App Password at https://myaccount.google.com/apppasswords\n" +
          "3. Pasted the 16-character App Password (spaces optional) — NOT your regular password"
        );
      }
      throw new Error(msg);
    }
  });