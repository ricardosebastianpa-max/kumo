import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { AppNav } from "@/components/client/app-nav";
import { Capture } from "@/components/client/capture";
import { ToastProvider } from "@/components/client/toast";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const canEdit = can(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "calendar" });
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const [th, tc] = await Promise.all([getTranslations("home"), getTranslations("common")]);
  return (
    <ToastProvider>
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="flex items-center gap-3 py-4">
          <Link href="/app" className="flex min-h-11 items-center gap-3">
            <span className="font-display text-2xl">Kumo</span>
            <span className="hidden truncate text-sm text-mute sm:inline">{ctx.workspace.name}</span>
          </Link>
        </header>
        {ctx.role !== "owner" && <p className="mb-4 rounded-2xl bg-paper-2 px-4 py-3 text-sm text-ink-2" role="note">{th("viewerNote", { name: ctx.workspace.name, role: tc(`roles.${ctx.role}`).toLowerCase() })}</p>}
        <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
          <AppNav />
          <main id="main" className="min-w-0 pb-32 lg:pb-16">{children}</main>
        </div>
      </div>
      {canEdit ? <Capture timezone={tz} /> : null}
    </ToastProvider>
  );
}
