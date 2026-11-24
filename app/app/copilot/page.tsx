import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/lib/server/session";
import { CopilotClient } from "./client";
export async function generateMetadata() { return { title: (await getTranslations("ai"))("title") }; }
export default async function Copilot() {
  await requireWorkspace();
  return <CopilotClient aiOn={!!process.env.ANTHROPIC_API_KEY} />;
}
