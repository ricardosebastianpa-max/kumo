import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/session";
import { LoginForm } from "./form";
import { Kumo } from "@/components/kumo";

export async function generateMetadata() { return { title: (await getTranslations("login"))("title") }; }

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; mode?: string }> }) {
  const { next, mode } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
  if (await getSession()) redirect(safeNext);
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <Kumo state="awake" size={88} className="text-ink" />
      <LoginForm next={safeNext} initialMode={mode === "signup" || safeNext.startsWith("/invite") ? "signup" : "signin"} />
    </main>
  );
}
