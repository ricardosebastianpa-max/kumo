"use client";
import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { inviteMember, revokeInvitation } from "@/app/actions";
import { Button, Card, Field, inputCls } from "@/components/ui";

type Preview = Record<"guardian" | "mentor", { see: string[]; approve: string[]; help: string }>;
export function InviteForm({ preview }: { preview: Preview }) {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const [role, setRole] = useState<"guardian" | "mentor">("guardian");
  const [state, action, pending] = useActionState(inviteMember, {});
  const p = preview[role];
  return (
    <Card className="grid gap-5 p-6">
      <form action={action} className="grid gap-4">
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-bold text-ink-2">{t("role")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["guardian", "mentor"] as const).map((r) => (
              <label key={r} className={`grid min-h-14 cursor-pointer content-center rounded-xl border px-4 py-3 ${role === r ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                <span className="font-bold">{tc(`roles.${r}`)}</span>
              </label>
            ))}
          </div>
          <p className="text-sm text-mute">{p.help}</p>
        </fieldset>
        <Field id="inv-email" label={t("email")} error={state?.error}>
          <input id="inv-email" name="email" type="email" required autoComplete="off" className={inputCls} aria-invalid={!!state?.error} />
        </Field>
        <Field id="inv-msg" label={t("message")}>
          <textarea id="inv-msg" name="message" rows={2} placeholder={t("messagePlaceholder")} className={`${inputCls} py-3`} />
        </Field>
        <div className="rounded-xl bg-paper-2 p-4 text-sm">
          <p className="mb-2 font-bold">{t("previewTitle")}</p>
          <p><span className="text-mute">{t("canSee")}:</span> {p.see.join(", ")}</p>
          {p.approve.length > 0 && <p><span className="text-mute">{t("canApprove")}:</span> {p.approve.join(", ")}</p>}
          <p><span className="text-mute">{t("never")}:</span> {t("neverList")}</p>
        </div>
        <Button type="submit" size="lg" disabled={pending} className="justify-self-start">{pending ? t("sending") : t("send")}</Button>
        {state?.sent ? <p role="status" className="font-bold text-[var(--conf-confirmed)]">{state.sent}</p> : null}
        {state?.link ? <ShareLink link={state.link} /> : null}
      </form>
    </Card>
  );
}
export function RevokeButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return <Button variant="danger" disabled={pending} onClick={() => start(() => revokeInvitation(id))}>{label}</Button>;
}

/** Copy / WhatsApp share for an invitation link (works without any email provider). */
export function ShareLink({ link, compact = false }: { link: string; compact?: boolean }) {
  const t = useTranslations("members");
  const [copied, setCopied] = useState(false);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t("shareText")} ${link}`)}`;
  return (
    <div className="grid gap-2">
      {!compact && <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} aria-label={t("copy")} className={`${inputCls} font-mono text-sm`} data-testid="invite-link" />}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: the field stays selectable */ } }}>
          {copied ? t("copied") : t("copy")}
        </Button>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-line bg-card px-4 text-[0.9375rem] font-bold hover:bg-paper-2">{t("whatsapp")}</a>
      </div>
    </div>
  );
}
