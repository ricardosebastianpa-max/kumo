import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/server/session";
import { OnboardingForm } from "./form";

export async function generateMetadata() { return { title: (await getTranslations("onboarding"))("spaceTitle") }; }
export default async function Onboarding() {
  const ctx = await getContext();
  if (!ctx) redirect("/login");
  if (ctx.workspace) redirect("/app");
  return <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center px-4 py-10"><OnboardingForm defaultName={ctx.user.name && !ctx.user.name.includes("@") ? ctx.user.name : ""} /></main>;
}
