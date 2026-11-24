import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import * as s from "@/db/schema";
import { audit } from "./audit";

const DEFAULT_STEPS = ["Crear cuenta en el portal", "Confirmar la carrera y los requisitos", "Examen de idioma (IELTS/TOEFL)", "Resultado del CSCA", "Notas y diploma", "Pasaporte", "Ensayo / carta de motivación", "Cartas de recomendación", "Pagar la tasa (con aprobación)", "Enviar la solicitud", "Confirmar recepción"];

/** Called when an option becomes "pursuing": one application with the default checklist (idempotent). */
export async function ensureApplication(ws: string, userId: string, kind: "institution" | "scholarship", refId: string) {
  const col = kind === "institution" ? s.application.institutionId : s.application.scholarshipId;
  const [exists] = await db.select({ id: s.application.id }).from(s.application).where(and(eq(s.application.workspaceId, ws), eq(col, refId), isNull(s.application.deletedAt))).limit(1);
  if (exists) return exists.id;
  const table = kind === "institution" ? s.institution : s.scholarship;
  const [ref] = await db.select({ name: table.name }).from(table).where(eq(table.id, refId));
  const [tpl] = await db.select().from(s.requirementTemplate).where(eq(s.requirementTemplate.workspaceId, ws)).limit(1);
  const steps = tpl?.items.length ? tpl.items.map((i) => ({ key: i.key, label: i.label, dependsOn: i.dependsOn ?? [] })) : DEFAULT_STEPS.map((label, i) => ({ key: `s${i + 1}`, label, dependsOn: [] as string[] }));
  const [app] = await db.insert(s.application).values({ workspaceId: ws, title: ref?.name ?? "Solicitud", createdBy: userId, ...(kind === "institution" ? { institutionId: refId } : { scholarshipId: refId }) }).returning({ id: s.application.id });
  await db.insert(s.applicationItem).values(steps.map((st, i) => ({ applicationId: app.id, key: st.key, label: st.label, dependsOn: st.dependsOn, position: i })));
  await audit({ workspaceId: ws, actorId: userId, action: "create", resourceType: "application", resourceId: app.id });
  return app.id;
}
