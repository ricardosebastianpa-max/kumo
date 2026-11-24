import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function ExploreTabs({ active }: { active: "unis" | "schs" }) {
  const t = await getTranslations("explore");
  const tab = (k: "unis" | "schs", href: string) => (
    <Link href={href} role="tab" aria-selected={active === k} className={`min-h-11 content-center rounded-xl px-4 font-medium ${active === k ? "bg-brand text-brand-ink" : "text-ink-2 hover:bg-paper-2"}`}>{t(k)}</Link>
  );
  return <div role="tablist" aria-label={t("title")} className="flex w-fit rounded-2xl border border-line bg-card p-1">{tab("unis", "/app/universities")}{tab("schs", "/app/scholarships")}</div>;
}
