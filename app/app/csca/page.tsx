import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { cscaProgress } from "@/lib/server/csca";
import { CSCA } from "@/lib/csca/data";
import { CscaView } from "./view";

export const metadata = { title: "CSCA" };
export default async function CscaPage({ searchParams }: { searchParams: Promise<{ tab?: string; k?: string }> }) {
  const ctx = await requireWorkspace();
  if (!can(ctx.actor, "view", { workspaceId: ctx.workspace.id, module: "study" })) redirect("/app");
  const progress = await cscaProgress(ctx.workspace.id, ctx.user.id);
  const sp = await searchParams;
  return <CscaView items={CSCA} progress={progress} canEdit={can(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "study" })} tab={sp.tab === "deep" || sp.tab === "channel" ? sp.tab : "route"} initialKey={sp.k ?? null} />;
}
