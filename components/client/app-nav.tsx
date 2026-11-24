"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarDays, GraduationCap, HandCoins, MoreHorizontal, Sun } from "lucide-react";

const ITEMS = [
  { href: "/app", key: "today", icon: Sun, exact: true },
  { href: "/app/calendar", key: "calendar", icon: CalendarDays },
  { href: "/app/universities", key: "universities", icon: GraduationCap },
  { href: "/app/scholarships", key: "scholarships", icon: HandCoins },
  { href: "/app/more", key: "more", icon: MoreHorizontal },
] as const;

/** Desktop: left rail. Mobile: 5-item bottom bar in the thumb zone. */
export function AppNav() {
  const t = useTranslations("nav");
  const path = usePathname();
  const active = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
  return (
    <>
      <nav aria-label={t("main")} className="sticky top-6 hidden h-fit flex-col gap-1 lg:flex">
        {ITEMS.map(({ href, key, icon: Icon, ...r }) => {
          const on = active(href, "exact" in r);
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 font-semibold transition-colors ${on ? "bg-card text-ink shadow-[var(--shadow-1)]" : "text-ink-2 hover:bg-paper-2"}`}>
              <Icon size={19} strokeWidth={on ? 2.4 : 2} aria-hidden />{t(key)}
            </Link>
          );
        })}
      </nav>
      <nav aria-label={t("main")} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_srgb,var(--paper)_92%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map(({ href, key, icon: Icon, ...r }) => {
            const on = active(href, "exact" in r);
            return (
              <li key={href}>
                <Link href={href} aria-current={on ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? "text-ink" : "text-mute"}`}>
                  <Icon size={21} strokeWidth={on ? 2.4 : 1.9} aria-hidden />{t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
