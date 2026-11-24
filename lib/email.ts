/**
 * Email transport. Uses Resend when RESEND_API_KEY is set; otherwise (dev/test) writes to an outbox
 * that /dev/outbox shows, so magic links work locally without any account.
 */
import { Resend } from "resend";

export interface Mail { to: string; subject: string; html: string; text: string }
const g = globalThis as unknown as { __kumoOutbox?: (Mail & { at: string })[] };
export const outbox = (g.__kumoOutbox ??= []);

export const emailEnabled = () => !!process.env.RESEND_API_KEY;
/** Email is optional: without a provider, mails go to the dev outbox and the UI offers share links instead. */
export async function sendMail(m: Mail): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    outbox.unshift({ ...m, at: new Date().toISOString() });
    outbox.length = Math.min(outbox.length, 50);
    console.info(`[mail:outbox] to=${m.to} subject="${m.subject}"`);
    return;
  }
  const from = process.env.EMAIL_FROM ?? "Kumo <onboarding@resend.dev>";
  const { error } = await new Resend(key).emails.send({ from, to: m.to, subject: m.subject, html: m.html, text: m.text });
  if (error) throw new Error(`email failed: ${error.message}`);
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
/** Minimal branded layout (paper background, ink text, one button). */
export function layout(opts: { title: string; body: string; cta?: { label: string; url: string }; footer?: string }): { html: string; text: string } {
  const html = `<!doctype html><html><body style="margin:0;background:#FBF8F3;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#14213D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#fff;border-radius:20px;padding:32px;border:1px solid #EDE6DA">
<tr><td style="font-size:14px;letter-spacing:.02em;color:#D64545;font-weight:600">Kumo</td></tr>
<tr><td style="padding-top:12px;font-family:Georgia,serif;font-size:26px;line-height:1.2">${esc(opts.title)}</td></tr>
<tr><td style="padding-top:12px;font-size:16px;line-height:1.55;color:#3A4560">${opts.body}</td></tr>
${opts.cta ? `<tr><td style="padding-top:24px"><a href="${esc(opts.cta.url)}" style="display:inline-block;background:#14213D;color:#fff;text-decoration:none;font-weight:600;padding:14px 22px;border-radius:12px">${esc(opts.cta.label)}</a></td></tr>` : ""}
${opts.footer ? `<tr><td style="padding-top:24px;font-size:13px;color:#6B7280">${esc(opts.footer)}</td></tr>` : ""}
</table></td></tr></table></body></html>`;
  const text = `${opts.title}\n\n${opts.body.replace(/<[^>]+>/g, "")}\n\n${opts.cta ? `${opts.cta.label}: ${opts.cta.url}\n\n` : ""}${opts.footer ?? ""}`;
  return { html, text };
}
