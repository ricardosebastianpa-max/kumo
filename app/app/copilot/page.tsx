import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/lib/server/session";
import { CopilotClient } from "./client";
import { aiStatus } from "@/lib/server/ai";
export async function generateMetadata() { return { title: (await getTranslations("ai"))("title") }; }
export default async function Copilot() {
  const ctx = await requireWorkspace();
  return <CopilotClient status={await aiStatus(ctx.workspace.id)} owner={ctx.role === "owner"} />;
}
