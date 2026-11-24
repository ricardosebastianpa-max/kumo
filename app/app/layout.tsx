import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/lib/server/session";
import { can } from "@/lib/domain/permissions";
import { AppNav } from "@/components/client/app-nav";
import { Capture } from "@/components/client/capture";
import { ToastProvider } from "@/components/client/toast";
import { Kumo } from "@/components/kumo";

/** App shell: a real sidebar on desktop (logo, space, navigation), a compact top bar + bottom tabs on phones. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const canEdit = can(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "calendar" });
  const tz = ctx.user.timezone || ctx.workspace.timezone;
  const [th, tc] = await Promise.all([getTranslations("home"), getTranslations("common")]);
  const brand = (
    <Link href="/app" className="flex min-h-11 items-center gap-2">
      <Kumo size={30} className="text-ink" />
      <span className="font-display text-xl">Kumo</span>
    </Link>
  );
  return (
    <ToastProvider>
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[248px_1fr]">
        <aside className="hidden border-r border-line lg:block">
          <div className="sticky top-0 grid gap-6 px-4 py-6">
            <div className="grid gap-1 px-2">{brand}<p className="truncate text-sm text-mute">{ctx.workspace.name}</p></div>
            <AppNav part="desktop" />
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex items-center justify-between px-4 py-3 lg:hidden">{brand}<span className="truncate text-sm text-mute">{ctx.workspace.name}</span></header>
          <main id="main" className="mx-auto w-full max-w-[1440px] px-4 pb-32 pt-2 sm:px-8 lg:pb-16 lg:pt-8">
            {ctx.role !== "owner" && <p className="mb-6 rounded-xl bg-paper-2 px-4 py-3 text-sm text-ink-2" role="note">{th("viewerNote", { name: ctx.workspace.name, role: tc(`roles.${ctx.role}`).toLowerCase() })}</p>}
            {children}
          </main>
        </div>
      </div>
      <AppNav part="mobile" />
      {canEdit ? <Capture timezone={tz} /> : null}
    </ToastProvider>
  );
}
