import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { boardCards } from "@/lib/server/list";
import { dateInZone } from "@/lib/domain/time";
import { Board } from "./board";

export async function generateMetadata() { return { title: (await getTranslations("list"))("title") }; }
export default async function ListPage() {
  const ctx = await requireWorkspace();
  const ws = ctx.workspace.id;
  if (!can(ctx.actor, "view", { workspaceId: ws, module: "list" })) redirect("/app");
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const cards = (await boardCards(ws, tz)).filter((c) => c.stage !== "exploring");
  return <Board cards={cards} today={dateInZone(new Date(), tz)} canEdit={can(ctx.actor, "edit", { workspaceId: ws, module: "list" })} />;
}
