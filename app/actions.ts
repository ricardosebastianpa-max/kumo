"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { getContext, requireUser, requireWorkspace, WS_COOKIE } from "@/lib/server/session";
import { createWorkspace } from "@/lib/server/workspace";
import { assertCan, type Role } from "@/lib/domain/permissions";
import { importSeedPack, type ImportResult } from "@/lib/seed/import";
import { convertCentro, type CentroFiles } from "@/lib/seed/adapters/centro-v0";
import { PackPack } from "@/lib/seed/schema";
import { layout, sendMail } from "@/lib/email";

export async function setLocale(locale: "es" | "en") {
  (await cookies()).set("kumo_locale", locale === "en" ? "en" : "es", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await getContext();
  if (session) await db.update(s.user).set({ locale }).where(eq(s.user.id, session.user.id));
  revalidatePath("/", "layout");
}

const OnboardingInput = z.object({ name: z.string().trim().min(1).max(80), timezone: z.string().max(64), space: z.string().trim().max(80).optional() });
export async function completeOnboarding(_: unknown, form: FormData): Promise<{ error?: string }> {
  const user = await requireUser();
  const t = await getTranslations("onboarding");
  const parsed = OnboardingInput.safeParse({ name: form.get("name"), timezone: form.get("timezone"), space: form.get("space") || undefined });
  if (!parsed.success) return { error: t("nameRequired") };
  const { name, timezone, space } = parsed.data;
  await db.update(s.user).set({ name, timezone }).where(eq(s.user.id, user.id));
  const ws = await createWorkspace(db, user.id, { name: space || t("spacePlaceholder"), timezone, locale: ((await cookies()).get("kumo_locale")?.value as "es" | "en") ?? "es" });
  (await cookies()).set(WS_COOKIE, ws.id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  redirect("/app");
}

/** Accepts either a canonical Kumo pack ({schemaVersion:1,...}) or the Centro v0 data/ files keyed by filename. */
function toPack(files: Record<string, unknown>) {
  const vals = Object.values(files);
  const canonical = vals.find((v) => v && typeof v === "object" && (v as { schemaVersion?: number }).schemaVersion === 1);
  if (canonical) return PackPack.parse(canonical);
  const f = (n: string) => files[n] as never;
  const c: CentroFiles = {
    profile: f("profile.json"), universities: f("universities_china.json"), scholarshipsGlobal: f("scholarships_global.json"),
    localScholarships: f("china_local_scholarships.json"), cscaSessions: f("csca_sessions.json"), events: f("events.json"),
    chineseRoute: f("china_chinese_taught_route.json"), studyPlan: f("study_plan.json"), checklist: f("application_checklist_template.json"), model: f("model.json"),
  };
  if (!Object.values(c).some(Boolean)) throw new Error("unrecognised");
  return PackPack.parse(convertCentro(c, { slug: "centro-v0", version: new Date().toISOString().slice(0, 10), title: "Centro de Control" }));
}

export async function runImport(files: Record<string, unknown>, dryRun: boolean): Promise<{ ok: true; result: ImportResult } | { ok: false; error: string }> {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "edit", { workspaceId: ctx.workspace.id, module: "settings" });
  let pack;
  try { pack = toPack(files); } catch { return { ok: false, error: (await getTranslations("import"))("invalid") }; }
  const result = await importSeedPack(db, ctx.workspace.id, pack, { actorId: ctx.user.id, dryRun });
  if (!dryRun) revalidatePath("/app", "layout");
  return { ok: true, result };
}

const InviteInput = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["guardian", "mentor"]), message: z.string().max(500).optional() });
export async function inviteMember(_: unknown, form: FormData): Promise<{ error?: string; sent?: string }> {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "members" });
  const tm = await getTranslations("members");
  const parsed = InviteInput.safeParse({ email: form.get("email"), role: form.get("role"), message: form.get("message") || undefined });
  if (!parsed.success) return { error: tm("invalidEmail") };
  const { email, role, message } = parsed.data;
  // Re-inviting the same email replaces the pending invitation.
  await db.update(s.invitation).set({ revokedAt: new Date() }).where(and(eq(s.invitation.workspaceId, ctx.workspace.id), eq(s.invitation.email, email), isNull(s.invitation.acceptedAt), isNull(s.invitation.revokedAt)));
  const [inv] = await db.insert(s.invitation).values({ workspaceId: ctx.workspace.id, email, role, message: message ?? null, invitedBy: ctx.user.id, expiresAt: new Date(Date.now() + 14 * 86400000) }).returning();
  await db.insert(s.activityLog).values({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "create", resourceType: "invitation", resourceId: inv.id, meta: { email, role } });
  const ti = await getTranslations("invite");
  const tc = await getTranslations("common");
  const base = process.env.BETTER_AUTH_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  const url = `${base}/invite/${inv.token}`;
  const roleLabel = tc(`roles.${role}`).toLowerCase();
  const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const m = layout({
    title: ti("emailSubject", { inviter: ctx.user.name }),
    body: `${esc(ti("emailBody", { inviter: ctx.user.name, role: roleLabel }))}${message ? `<br><br><em>“${esc(message)}”</em>` : ""}`,
    cta: { label: ti("emailCta"), url },
  });
  await sendMail({ to: email, subject: ti("emailSubject", { inviter: ctx.user.name }), ...m });
  revalidatePath("/app/members");
  return { sent: tm("sent", { email }) };
}

export async function revokeInvitation(id: string) {
  const ctx = await requireWorkspace();
  assertCan(ctx.actor, "manage", { workspaceId: ctx.workspace.id, module: "members" });
  await db.update(s.invitation).set({ revokedAt: new Date() }).where(and(eq(s.invitation.id, id), eq(s.invitation.workspaceId, ctx.workspace.id)));
  await db.insert(s.activityLog).values({ workspaceId: ctx.workspace.id, actorId: ctx.user.id, action: "delete", resourceType: "invitation", resourceId: id });
  revalidatePath("/app/members");
}

export async function acceptInvitation(token: string): Promise<{ error?: "expired" | "wrongEmail" }> {
  const user = await requireUser();
  const [inv] = await db.select().from(s.invitation).where(and(eq(s.invitation.token, token), isNull(s.invitation.acceptedAt), isNull(s.invitation.revokedAt), gt(s.invitation.expiresAt, new Date())));
  if (!inv) return { error: "expired" };
  if (inv.email.toLowerCase() !== user.email.toLowerCase()) return { error: "wrongEmail" };
  await db.transaction(async (tx) => {
    await tx.insert(s.membership).values({ workspaceId: inv.workspaceId, userId: user.id, role: inv.role as Role, permissions: inv.permissions }).onConflictDoNothing();
    await tx.update(s.invitation).set({ acceptedAt: new Date() }).where(eq(s.invitation.id, inv.id));
    await tx.insert(s.activityLog).values({ workspaceId: inv.workspaceId, actorId: user.id, action: "accept", resourceType: "invitation", resourceId: inv.id });
  });
  (await cookies()).set(WS_COOKIE, inv.workspaceId, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  redirect("/app");
}

export async function switchWorkspace(id: string) {
  const ctx = await getContext();
  if (!ctx?.memberships.some((m) => m.w.id === id)) return;
  (await cookies()).set(WS_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  redirect("/app");
}
