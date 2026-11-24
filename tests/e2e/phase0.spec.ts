import { expect, test, type Page } from "@playwright/test";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// Wrong-password path is covered below.
const DATA = process.env.KUMO_PRIVATE_DATA ?? "private/data";
const stamp = Date.now();
const student = `student-${stamp}@example.test`;
const dad = `dad-${stamp}@example.test`;

async function signUp(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}&mode=signup` : "/login?mode=signup");
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("kumo-test-pass-1");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

test("phase 0 acceptance: sign up, space, import, invite guardian", async ({ browser }) => {
  const s = await (await browser.newContext({ locale: "es-ES", timezoneId: "America/Managua" })).newPage();
  await signUp(s, student);
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
  const invite = await s.getByTestId("invite-link").inputValue();
  expect(invite).toMatch(/\/invite\/[a-f0-9]{64}$/);

  // Dad opens the shared link, creates his account, accepts.
  const d = await (await browser.newContext({ locale: "es-ES" })).newPage();
  await d.goto(invite);
  await expect(d.getByRole("heading", { name: /ricardo te invita/i })).toBeVisible();
  await d.getByRole("link", { name: /aceptar invitación/i }).click();
  await d.getByLabel(/correo/i).fill(dad);
  await d.getByLabel("Contraseña", { exact: true }).fill("kumo-test-pass-1");
  await d.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(d.getByRole("heading", { name: /ricardo te invita/i })).toBeVisible();
  await d.getByRole("button", { name: /aceptar invitación/i }).click();
  await expect(d).toHaveURL(/\/app$/);
  await expect(d.getByText(/como familia/i)).toBeVisible();
  // Guardian cannot reach owner-only screens.
  await d.goto("/app/import");
  await expect(d).toHaveURL(/\/app$/);
  await d.goto("/app/members");
  await expect(d).toHaveURL(/\/app$/);
});

test("wrong password shows a calm, specific error", async ({ browser }) => {
  const page = await (await browser.newContext({ locale: "es-ES" })).newPage();
  const email = `nobody-${Date.now()}@example.test`;
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "El correo o la contraseña no coinciden." })).toBeVisible();
});
