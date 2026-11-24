"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, CalendarDays, ClipboardCheck, Compass, Heart, MoreHorizontal, Sun } from "lucide-react";

const COLORS: Record<string, string> = { today: "var(--sun)", calendar: "var(--sky)", list: "var(--brand)", explore: "var(--leaf)", applications: "#A570FF", study: "#FF9F43", more: "var(--mute)" };
const ITEMS = [
  { href: "/app", key: "today", icon: Sun, exact: true },
  { href: "/app/calendar", key: "calendar", icon: CalendarDays },
  { href: "/app/list", key: "list", icon: Heart, also: ["/app/compare"] },
  { href: "/app/universities", key: "explore", icon: Compass, also: ["/app/scholarships"] },
  { href: "/app/applications", key: "applications", icon: ClipboardCheck, desktopOnly: true },
  { href: "/app/study", key: "study", icon: BookOpen, desktopOnly: true, also: ["/app/progress", "/app/focus"] },
  { href: "/app/more", key: "more", icon: MoreHorizontal },
] as const;

/** Desktop: left rail. Mobile: 5-item bottom bar in the thumb zone. */
export function AppNav({ part = "both" }: { part?: "desktop" | "mobile" | "both" }) {
  const t = useTranslations("nav");
  const path = usePathname();
  const under = (h: string) => path === h || path.startsWith(h + "/");
  const active = (href: string, exact?: boolean, also?: readonly string[]) => (exact ? path === href : under(href) || !!also?.some(under));
  return (
    <>
      {part !== "mobile" && <nav aria-label={t("main")} className="hidden flex-col gap-1 lg:flex">
        {ITEMS.map(({ href, key, icon: Icon, ...r }) => {
          const on = active(href, "exact" in r, "also" in r ? r.also : undefined);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-2xl border-2 px-3 text-[0.95rem] font-extrabold transition-colors ${on ? "border-[var(--sky)] bg-[var(--sky-soft)] text-[var(--sky-deep)]" : "border-transparent text-ink-2 hover:bg-paper-2"}`}>
              <Icon size={22} strokeWidth={2.25} aria-hidden style={{ color: COLORS[key] }} />{t(key)}
            </Link>
          );
        })}
      </nav>}
      {part !== "desktop" && <nav aria-label={t("main")} className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-line bg-card pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.filter((x) => !("desktopOnly" in x)).map(({ href, key, icon: Icon, ...r }) => {
            const on = active(href, "exact" in r, "also" in r ? r.also : undefined);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold ${on ? "text-[var(--sky-deep)]" : "text-mute"}`}>
                  <Icon size={24} strokeWidth={2.25} aria-hidden style={{ color: on ? "var(--sky)" : COLORS[key] }} />{t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>}
    </>
  );
}
