// lib\admin-email.ts
import "server-only";

import nodemailer from "nodemailer";
import type { User } from "@clerk/backend";
import { getDisplayName, getPrimaryEmail } from "@/lib/admin";

type MailResult = { sent: boolean; skipped?: string };

function getTransportConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.NOTIFICATION_EMAIL_FROM ?? user;

  if (!host || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from };
}

function buildEmailHtml(name: string, bodyHtml: string): string {
  const safeName = name.replace(/[<>]/g, "");
  return `
<table cellpadding="0" cellspacing="0" style="width:100%;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06);">
        <tr>
          <td style="padding:22px 32px;background:#6366f1;">
            <h1 style="margin:0;font-size:17px;font-weight:600;color:#ffffff;letter-spacing:-0.01em;">Paperspace</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 20px;">
            <p style="margin:0 0 16px;font-size:15px;color:#18181b;line-height:1.5;">Hi ${safeName},</p>
            <div style="font-size:14px;color:#3f3f46;line-height:1.65;">
              ${bodyHtml}
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 32px;border-top:1px solid #e4e4e7;background:#fafafa;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;">This is an automated notification from Paperspace.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`.trim();
}

async function sendMail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<MailResult> {
  const config = getTransportConfig();
  if (!config) return { sent: false, skipped: "SMTP is not configured" };
  if (!to) return { sent: false, skipped: "User has no email address" };

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });

    await transporter.sendMail({
      from: `Paperspace <${config.from}>`,
      to,
      subject,
      text,
      ...(html ? { html } : {}),
    });

    return { sent: true };
  } catch (error) {
    console.error("[admin-email] Failed to send email:", error);
    return { sent: false, skipped: "Email transport error" };
  }
}

/** Convert plain text to HTML-safe paragraphs. */
function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.65;">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export async function sendInactiveWarningEmail(user: User, daysLeft: number) {
  const name = getDisplayName(user);
  const email = getPrimaryEmail(user);
  const text = `Hi ${name},\n\nYour Paperspace account has been inactive for over 110 days. It will be permanently deleted in ${daysLeft} day${daysLeft === 1 ? "" : "s"} unless you sign in again.\n\nDeletion removes your account, documents, templates, forms, submissions, and connected account data.\n\nSign in to keep your account active.\n\nPaperspace`;
  const html = buildEmailHtml(
    name,
    `<p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.65;">Your Paperspace account has been inactive for over 110 days. It will be <strong>permanently deleted in ${daysLeft} day${daysLeft === 1 ? "" : "s"}</strong> unless you sign in again.</p>
<p style="margin:0 0 12px;font-size:14px;color:#3f3f46;line-height:1.65;">Deletion removes your account, documents, templates, forms, submissions, and connected account data.</p>
<p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.65;"><a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://paperspace.app"}" style="display:inline-block;padding:10px 20px;background:#6366f1;color:#ffffff;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;">Sign in to keep your account</a></p>`
  );

  return await sendMail(email, "Paperspace account inactivity notice", text, html);
}

export async function sendUserNotification(user: User, subject: string, message: string) {
  const name = getDisplayName(user);
  const email = getPrimaryEmail(user);
  const text = `Hi ${name},\n\n${message}\n\nPaperspace`;
  const html = buildEmailHtml(name, textToHtml(message));

  return await sendMail(email, subject, text, html);
}

export async function sendInactiveDeletedEmail(user: User) {
  const name = getDisplayName(user);
  const email = getPrimaryEmail(user);
  const text = `Hi ${name},\n\nYour Paperspace account was inactive for at least 120 days, so it has been permanently deleted along with its documents, templates, forms, submissions, and connected account data.\n\nPaperspace`;
  const html = buildEmailHtml(
    name,
    `<p style="margin:0;font-size:14px;color:#3f3f46;line-height:1.65;">Your Paperspace account was inactive for at least 120 days, so it has been permanently deleted along with its documents, templates, forms, submissions, and connected account data.</p>`
  );

  return await sendMail(
    email,
    "Paperspace account deleted for inactivity",
    text,
    html
  );
}