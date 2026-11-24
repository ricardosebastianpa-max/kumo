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
          <legend className="mb-1 text-sm font-semibold text-ink-2">{t("role")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["guardian", "mentor"] as const).map((r) => (
              <label key={r} className={`grid min-h-14 cursor-pointer content-center rounded-xl border px-4 py-3 ${role === r ? "border-[var(--ink)] bg-paper-2" : "border-line"}`}>
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
                <span className="font-semibold">{tc(`roles.${r}`)}</span>
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
          <p className="mb-2 font-semibold">{t("previewTitle")}</p>
          <p><span className="text-mute">{t("canSee")}:</span> {p.see.join(", ")}</p>
          {p.approve.length > 0 && <p><span className="text-mute">{t("canApprove")}:</span> {p.approve.join(", ")}</p>}
          <p><span className="text-mute">{t("never")}:</span> {t("neverList")}</p>
        </div>
        <Button type="submit" size="lg" disabled={pending} className="justify-self-start">{pending ? t("sending") : t("send")}</Button>
        {state?.sent ? <p role="status" className="font-semibold text-[var(--conf-confirmed)]">{state.sent}</p> : null}
      </form>
    </Card>
  );
}
export function RevokeButton({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  return <Button variant="danger" disabled={pending} onClick={() => start(() => revokeInvitation(id))}>{label}</Button>;
}
