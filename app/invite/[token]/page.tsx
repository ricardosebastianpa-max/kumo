import { getTranslations } from "next-intl/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { getSession } from "@/lib/server/session";
import { Kumo } from "@/components/kumo";
import { ButtonLink } from "@/components/ui";
import { AcceptButton } from "./accept";

export const dynamic = "force-dynamic";
export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const tc = await getTranslations("common");
  const [row] = await db.select({ i: s.invitation, w: s.workspace, u: s.user }).from(s.invitation)
    .innerJoin(s.workspace, eq(s.workspace.id, s.invitation.workspaceId)).innerJoin(s.user, eq(s.user.id, s.invitation.invitedBy))
    .where(and(eq(s.invitation.token, token), isNull(s.invitation.acceptedAt), isNull(s.invitation.revokedAt), gt(s.invitation.expiresAt, new Date())));
  const session = await getSession();
  return (
    <main id="main" className="mx-auto grid min-h-dvh max-w-md content-center gap-6 px-4 py-10">
      <Kumo state={row ? "cheering" : "resting"} size={96} className="text-ink" />
      {!row ? <p className="text-xl">{t("expired")}</p> : (
        <>
          <div className="grid gap-2">
            <h1 className="text-4xl">{t("title", { inviter: row.u.name })}</h1>
            <p className="text-ink-2 text-lg">{t("lead", { role: tc(`roles.${row.i.role}`).toLowerCase(), space: row.w.name })}</p>
            {row.i.message ? <blockquote className="mt-2 border-l-2 border-[var(--lacquer)] pl-4 italic text-ink-2">“{row.i.message}”</blockquote> : null}
          </div>
          {!session ? (
            <>
              <p className="text-ink-2">{t("signInFirst", { email: row.i.email })}</p>
              <ButtonLink href={`/login?next=/invite/${token}`} size="lg">{t("accept")}</ButtonLink>
            </>
          ) : session.user.email.toLowerCase() !== row.i.email.toLowerCase() ? (
            <p role="alert" className="text-[var(--lacquer)]">{t("wrongEmail", { email: row.i.email })}</p>
          ) : <AcceptButton token={token} label={t("accept")} />}
        </>
      )}
    </main>
  );
}
