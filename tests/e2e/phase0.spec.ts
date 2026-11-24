import { expect, test, type Page } from "@playwright/test";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA = process.env.KUMO_PRIVATE_DATA ?? "private/data";
const stamp = Date.now();
const student = `student-${stamp}@example.test`;
const dad = `dad-${stamp}@example.test`;

async function magicSignIn(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel(/correo|email/i).fill(email);
  await page.getByRole("button", { name: /enlace|link/i }).click();
  await expect(page.getByRole("status")).toBeVisible();
  await page.goto("/dev/outbox");
  const link = page.locator('[data-testid="mail"]', { hasText: email }).first().locator('[data-testid="mail-link"]').first();
  await page.goto((await link.textContent())!);
}

test("phase 0 acceptance: sign up, space, import, invite guardian", async ({ browser }) => {
  const s = await (await browser.newContext({ locale: "es-ES", timezoneId: "America/Managua" })).newPage();
  await magicSignIn(s, student);
  await expect(s).toHaveURL(/onboarding/);
  await s.getByLabel(/cómo te llamas/i).fill("Ricardo");
  await s.getByRole("button", { name: "Continuar" }).click();
  await s.getByRole("button", { name: "Continuar" }).click();
  await s.getByLabel(/tu espacio/i).fill("Universidad 2027");
  await s.getByRole("button", { name: /crear mi espacio/i }).click();
  await expect(s.getByRole("heading", { name: /hola, ricardo/i })).toBeVisible();

  // Real private pack when present (local), fictional demo pack otherwise (CI).
  const priv = existsSync(DATA);
  const files = priv ? readdirSync(DATA).filter((f) => f.endsWith(".json")).map((f) => join(DATA, f)) : ["seed/demo-pack.json"];
  const nInst = priv ? 65 : 4;
  await s.goto("/app/import");
  await s.getByTestId("pack-input").setInputFiles(files);
  await expect(s.getByRole("heading", { name: "Vista previa" })).toBeVisible({ timeout: 30_000 });
  await expect(s.getByRole("row", { name: /universidades/i })).toContainText(String(nInst));
  await s.getByRole("button", { name: "Importar ahora" }).click();
  await expect(s.getByText(/importamos todo sin errores/i)).toBeVisible({ timeout: 30_000 });
  await s.goto("/app");
  await expect(s.getByText(new RegExp(`${nInst} universidades`))).toBeVisible();

  await s.goto("/app/members");
  await s.getByLabel("Correo").fill(dad);
  await s.getByLabel(/mensaje/i).fill("Papá, así vas a poder ver cómo voy.");
  await s.getByRole("button", { name: /enviar invitación/i }).click();
  await expect(s.getByText(`Invitación enviada a ${dad}.`)).toBeVisible();

  // Dad opens the invite from the email, signs in, accepts.
  const d = await (await browser.newContext({ locale: "es-ES" })).newPage();
  await d.goto("/dev/outbox");
  const invite = (await d.locator('[data-testid="mail"]', { hasText: dad }).first().locator('[data-testid="mail-link"]').first().textContent())!;
  await d.goto(invite);
  await expect(d.getByRole("heading", { name: /ricardo te invita/i })).toBeVisible();
  await magicSignIn(d, dad, new URL(invite).pathname);
  await d.getByRole("button", { name: /aceptar invitación/i }).click();
  await expect(d).toHaveURL(/\/app$/);
  await expect(d.getByText(/como familia/i)).toBeVisible();
  // Guardian cannot reach owner-only screens.
  await d.goto("/app/import");
  await expect(d).toHaveURL(/\/app$/);
  await d.goto("/app/members");
  await expect(d).toHaveURL(/\/app$/);
});
