import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireWorkspace } from "@/lib/server/session";
import { LocaleSwitch } from "@/components/client/locale-switch";
import { SignOut } from "@/components/client/sign-out";
import { can } from "@/lib/domain/permissions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const tc = await getTranslations("common");
  const owner = can(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "members" });
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-4">
        <Link href="/app" className="flex min-h-11 items-center gap-3">
          <span className="font-display text-2xl">Kumo</span>
          <span className="hidden truncate text-sm text-mute sm:inline">{ctx.workspace.name}</span>
        </Link>
        <nav className="flex items-center gap-1" aria-label="Kumo">
          {owner ? <Link href="/app/members" className="min-h-11 content-center rounded-xl px-3 text-sm font-semibold text-ink-2 hover:bg-paper-2">{tc("people")}</Link> : null}
          <LocaleSwitch />
          <SignOut label={tc("signOut")} />
        </nav>
      </header>
      <main id="main" className="pb-24">{children}</main>
    </div>
  );
}
