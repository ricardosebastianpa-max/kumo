"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpen, CalendarDays, ClipboardCheck, Compass, Heart, MoreHorizontal, Sun } from "lucide-react";

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
      {part !== "mobile" && <nav aria-label={t("main")} className="hidden flex-col gap-0.5 lg:flex">
        {ITEMS.map(({ href, key, icon: Icon, ...r }) => {
          const on = active(href, "exact" in r, "also" in r ? r.also : undefined);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`flex h-9 items-center gap-2.5 rounded-lg px-2 text-[0.9375rem] transition-colors ${on ? "bg-paper-2 font-medium text-ink" : "text-ink-2 hover:bg-paper-2/60 hover:text-ink"}`}>
              <Icon size={18} strokeWidth={1.5} aria-hidden className={on ? "text-ink" : "text-mute"} />{t(key)}
            </Link>
          );
        })}
      </nav>}
      {part !== "desktop" && <nav aria-label={t("main")} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.filter((x) => !("desktopOnly" in x)).map(({ href, key, icon: Icon, ...r }) => {
            const on = active(href, "exact" in r, "also" in r ? r.also : undefined);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${on ? "text-ink" : "text-mute"}`}>
                  <Icon size={20} strokeWidth={1.5} aria-hidden />{t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>}
    </>
  );
}
