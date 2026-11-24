import { getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { Card } from "@/components/ui";
import { SubscribeClient } from "./client";

export async function generateMetadata() { return { title: (await getTranslations("ics"))("title") }; }
export default async function Subscribe() {
  const ctx = await requireWorkspace();
  if (!can(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "settings" })) redirect("/app");
  const t = await getTranslations("ics");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const https = `${h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")}://${host}/api/ics/${ctx.workspace.icsToken}.ics`;
  return (
    <div className="grid max-w-2xl gap-6 pt-2">
      <div className="grid gap-2"><h1 className="text-4xl">{t("title")}</h1><p className="text-lg text-ink-2">{t("lead")}</p></div>
      <Card className="grid gap-4 p-6"><SubscribeClient url={https} /></Card>
    </div>
  );
}
