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
      <Card className="divide-y divide-[var(--line)]">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex min-h-14 items-center gap-3 px-4 font-medium hover:bg-paper-2"><Icon size={20} aria-hidden className="text-ink-2" />{label}</Link>
        ))}
      </Card>
      <Card className="flex items-center justify-between gap-3 p-4"><span className="font-medium">{tc("language")}</span><LocaleSwitch /></Card>
      <Card className="flex items-center justify-between gap-3 p-4"><span className="text-sm text-mute">{ctx.user.email}</span><SignOut label={tc("signOut")} /></Card>
    </div>
  );
}
