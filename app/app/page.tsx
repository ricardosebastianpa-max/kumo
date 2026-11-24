import { getTranslations } from "next-intl/server";
import { and, asc, count, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { Kumo } from "@/components/kumo";
import { ButtonLink, Card, ConfidenceBadge } from "@/components/ui";
import { daysBetween, dateInZone } from "@/lib/domain/time";

export default async function Home() {
  const ctx = await requireWorkspace();
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const ws = ctx.workspace.id;
  const isOwner = ctx.role === "owner";
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const [[inst], [sch], [ev]] = await Promise.all([
    db.select({ n: count() }).from(s.institution).where(and(eq(s.institution.workspaceId, ws), isNull(s.institution.deletedAt))),
    db.select({ n: count() }).from(s.scholarship).where(and(eq(s.scholarship.workspaceId, ws), isNull(s.scholarship.deletedAt))),
    db.select({ n: count() }).from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt))),
  ]);
  const canCal = can(ctx.actor, "view", { workspaceId: ws, module: "calendar" });
  const upcoming = canCal ? await db.select().from(s.event).where(and(eq(s.event.workspaceId, ws), isNull(s.event.deletedAt), gte(s.event.startsAt, new Date(Date.now() - 86400000)))).orderBy(asc(s.event.startsAt)).limit(5) : [];
  const today = dateInZone(new Date(), tz);
  const fmt = (d: Date, zone: string, allDay: boolean) => new Intl.DateTimeFormat(ctx.user.locale === "en" ? "en" : "es", allDay ? { timeZone: zone, day: "numeric", month: "short" } : { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(d);
  const owner = ctx.memberships.find((m) => m.w.id === ws);
  return (
    <div className="grid gap-8 pt-6">
      <section className="flex items-center gap-5 enter">
        <Kumo state={inst.n ? "cheering" : "awake"} size={84} className="shrink-0 text-ink" />
        <div className="grid gap-1">
          <h1 className="text-[clamp(2rem,5vw,3rem)] leading-tight">{t("greeting", { name: (ctx.user.name || "").split(" ")[0] })}</h1>
          <p className="text-ink-2 text-lg">{isOwner ? (inst.n ? t("stats", { institutions: inst.n, scholarships: sch.n, events: ev.n }) : t("lead")) : t("viewerNote", { name: owner?.w.name ?? "", role: tc(`roles.${ctx.role}`).toLowerCase() })}</p>
        </div>
      </section>

      {upcoming.length > 0 && (
        <section className="grid gap-3" aria-labelledby="next">
          <h2 id="next" className="text-2xl">{t("nextUp")}</h2>
          <Card className="divide-y divide-[var(--line)]">
            {upcoming.map((e) => {
              const d = daysBetween(today, dateInZone(e.startsAt, e.allDay ? e.timezone : tz));
              return (
                <div key={e.id} className="flex items-start gap-4 p-4 sm:items-center">
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-display text-2xl leading-none">{d <= 0 ? "0" : d}</p>
                    <p className="text-xs text-mute">{t("daysLeft", { n: Math.max(d, 0) })}</p>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <p className="font-semibold leading-snug">{e.title}</p>
                    <p className="text-sm text-mute" title={e.allDay ? undefined : `${fmt(e.startsAt, e.timezone, false)} (${e.timezone})`}>
                      {fmt(e.startsAt, e.timezone, e.allDay)}{!e.allDay && e.timezone !== tz ? ` · ${new Intl.DateTimeFormat(ctx.user.locale === "en" ? "en" : "es", { timeZone: e.timezone, hour: "2-digit", minute: "2-digit" }).format(e.startsAt)} ${e.timezone.split("/")[1]?.replace("_", " ")}` : ""}
                    </p>
                    <span className="sm:hidden"><ConfidenceBadge level={e.confidence} label={tc(`confidence.${e.confidence}`)} /></span>
                  </div>
                  <span className="hidden shrink-0 sm:inline-flex"><ConfidenceBadge level={e.confidence} label={tc(`confidence.${e.confidence}`)} /></span>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {isOwner && (
        <section className="grid gap-4 sm:grid-cols-2">
          <Card className="grid gap-3 p-6">
            <h2 className="text-2xl">{t("importTitle")}</h2>
            <p className="text-ink-2 leading-relaxed">{t("importBody")}</p>
            <ButtonLink href="/app/import" className="justify-self-start">{t("importCta")}</ButtonLink>
          </Card>
          <Card className="grid gap-3 p-6">
            <h2 className="text-2xl">{t("inviteTitle")}</h2>
            <p className="text-ink-2 leading-relaxed">{t("inviteBody")}</p>
            <ButtonLink href="/app/members" variant="secondary" className="justify-self-start">{t("inviteCta")}</ButtonLink>
          </Card>
        </section>
      )}
      {!inst.n && !isOwner ? <p className="text-mute">{t("noData")}</p> : null}
    </div>
  );
}
