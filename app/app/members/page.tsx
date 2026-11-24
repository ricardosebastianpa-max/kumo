import { getTranslations } from "next-intl/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { allowedActions, can } from "@/lib/domain/permissions";
import { Card } from "@/components/ui";
import { headers } from "next/headers";
import { InviteForm, RevokeButton, ShareLink } from "./client";

const PREVIEW_MODULES = ["today", "calendar", "catalog", "list", "applications", "documents", "people", "finance", "study", "writing"] as const;

export async function generateMetadata() { return { title: (await getTranslations("members"))("title") }; }
export default async function Members() {
  const ctx = await requireWorkspace();
  if (!can(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "members" })) redirect("/app");
  const t = await getTranslations("members");
  const tc = await getTranslations("common");
  const ws = ctx.workspace.id;
  const [members, pending] = await Promise.all([
    db.select({ m: s.membership, u: s.user }).from(s.membership).innerJoin(s.user, eq(s.user.id, s.membership.userId)).where(eq(s.membership.workspaceId, ws)),
    db.select().from(s.invitation).where(and(eq(s.invitation.workspaceId, ws), isNull(s.invitation.acceptedAt), isNull(s.invitation.revokedAt), gt(s.invitation.expiresAt, new Date()))),
  ]);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}`;
  const preview = Object.fromEntries((["guardian", "mentor"] as const).map((r) => [r, {
    see: PREVIEW_MODULES.filter((m) => allowedActions(r, m).includes("view")).map((m) => t(`modules.${m}`)),
    approve: PREVIEW_MODULES.filter((m) => allowedActions(r, m).includes("approve")).map((m) => t(`modules.${m}`)),
    help: t(`roleHelp.${r}`),
  }])) as Record<"guardian" | "mentor", { see: string[]; approve: string[]; help: string }>;
  return (
    <div className="grid max-w-2xl gap-8 pt-6">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-ink-2 text-lg">{t("lead")}</p></div>
      <Card className="divide-y divide-[var(--line)]">
        {members.map(({ m, u }) => (
          <div key={m.id} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0"><p className="truncate font-semibold">{u.name}{u.id === ctx.user.id ? ` · ${t("you")}` : ""}</p><p className="truncate text-sm text-mute">{u.email}</p></div>
            <span className="shrink-0 rounded-full bg-paper-2 px-3 py-1 text-sm font-semibold">{tc(`roles.${m.role}`)}</span>
          </div>
        ))}
      </Card>
      {pending.length > 0 && (
        <section className="grid gap-3"><h2 className="text-2xl">{t("pending")}</h2>
          <Card className="divide-y divide-[var(--line)]">
            {pending.map((p) => (
              <div key={p.id} className="grid gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold">{p.email}</p><p className="text-sm text-mute">{tc(`roles.${p.role}`)}</p></div>
                  <RevokeButton id={p.id} label={t("revoke")} />
                </div>
                <ShareLink link={`${origin}/invite/${p.token}`} compact />
              </div>
            ))}
          </Card>
        </section>
      )}
      <section className="grid gap-3"><h2 className="text-2xl">{t("inviteTitle")}</h2><InviteForm preview={preview} /></section>
    </div>
  );
}
