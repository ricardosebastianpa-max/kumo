import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Kumo } from "@/components/kumo";
import { ButtonLink, Card, Eyebrow } from "@/components/ui";
import { LocaleSwitch } from "@/components/client/locale-switch";
import { getSession } from "@/lib/server/session";

export default async function Landing() {
  if (await getSession()) redirect("/app");
  const t = await getTranslations("landing");
  const points = [["p1t", "p1d"], ["p2t", "p2d"], ["p3t", "p3d"]] as const;
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between py-4">
        <span className="font-display text-2xl">Kumo</span>
        <div className="flex items-center gap-1"><LocaleSwitch /><ButtonLink href="/login" variant="ghost">{t("signIn")}</ButtonLink></div>
      </header>
      <main id="main" className="grid gap-12 pb-20 pt-10 sm:pt-16">
        <section className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-5 enter">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1 className="text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.02]">{t("title")}</h1>
            <p className="max-w-[54ch] text-lg leading-relaxed text-ink-2">{t("lead")}</p>
            <div className="flex flex-wrap gap-3 pt-2"><ButtonLink href="/login" size="lg">{t("cta")}</ButtonLink></div>
          </div>
          <div className="relative grid place-items-center">
            <div aria-hidden className="absolute inset-6 rounded-full bg-paper-2" />
            <Kumo state="awake" size={300} className="kumo-float relative text-ink" />
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-3">
          {points.map(([a, b]) => (
            <Card key={a} className="grid gap-2 p-6">
              <h2 className="text-xl">{t(a)}</h2>
              <p className="text-ink-2 leading-relaxed">{t(b)}</p>
            </Card>
          ))}
        </section>
      </main>
    </div>
  );
}
