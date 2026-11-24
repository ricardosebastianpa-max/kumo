import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpen, Bot, CalendarPlus, ClipboardCheck, Download, FileText, Gauge, HeartHandshake, NotebookPen, Palette, Timer, TrendingUp, Upload, UserRoundPen, Users } from "lucide-react";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { Card } from "@/components/ui";
import { LocaleSwitch } from "@/components/client/locale-switch";
import { SignOut } from "@/components/client/sign-out";

export default async function More() {
  const ctx = await requireWorkspace();
  const [t, tc] = await Promise.all([getTranslations("nav"), getTranslations("common")]);
  const owner = can(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "members" });
  const links = [
    { href: "/app/applications", label: t("applications"), icon: ClipboardCheck },
    { href: "/app/documents", label: t("documents"), icon: FileText },
    { href: "/app/people", label: t("people"), icon: UserRoundPen },
    { href: "/app/family", label: t("family"), icon: HeartHandshake },
    { href: "/app/study", label: t("study"), icon: BookOpen },
    { href: "/app/progress", label: t("progress"), icon: TrendingUp },
    { href: "/app/focus", label: t("focus"), icon: Timer },
    { href: "/app/essays", label: t("essays"), icon: NotebookPen },
    { href: "/app/copilot", label: t("copilot"), icon: Bot },
    { href: "/app/model", label: t("model"), icon: Gauge },
    ...(owner ? [{ href: "/app/members", label: (await getTranslations("members"))("title"), icon: Users }, { href: "/app/import", label: t("import"), icon: Upload }, { href: "/app/subscribe", label: t("subscribe"), icon: CalendarPlus }, { href: "/api/export", label: t("export"), icon: Download }] : []),
    { href: "/design", label: "Design system", icon: Palette },
  ];
  return (
    <div className="grid max-w-xl gap-6 pt-2">
      <h1 className="text-4xl">{(await getTranslations("more"))("title")}</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {links.map(({ href, label, icon: Icon }, k) => {
          const c = ["var(--sky)", "#4FB3BF", "#FF8FA3", "#FF6F91", "#FF9F43", "var(--leaf)", "#7C6CF2", "#A570FF", "var(--brand)", "#8D99AE", "var(--sun)", "#4FB3BF"][k % 12];
          return (
            <Link key={href} href={href} className="btn3d grid min-h-28 content-between gap-3 rounded-3xl border-2 border-line bg-card p-4">
              <span className="grid size-11 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${c} 18%, transparent)` }}><Icon size={24} strokeWidth={2.25} aria-hidden style={{ color: c }} /></span>
              <span className="font-extrabold leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
      <Card className="flex items-center justify-between gap-3 p-4"><span className="font-bold">{tc("language")}</span><LocaleSwitch /></Card>
      <Card className="flex items-center justify-between gap-3 p-4"><span className="text-sm text-mute">{ctx.user.email}</span><SignOut label={tc("signOut")} /></Card>
    </div>
  );
}
