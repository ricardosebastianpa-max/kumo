import { expect, type Browser, type Page } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const DATA = process.env.KUMO_PRIVATE_DATA ?? "private/data";
export const PRIVATE = existsSync(DATA);
export const PASS = "kumo-test-pass-1";

export async function signUp(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}&mode=signup` : "/login?mode=signup");
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(PASS);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
}

/** New student with a space and the seed data imported (private pack locally, demo pack in CI). */
export async function studentWithData(browser: Browser, name = "Ricardo") {
  const page = await (await browser.newContext({ locale: "es-ES", timezoneId: "America/Managua" })).newPage();
  const email = `student-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`;
  await signUp(page, email);
  await expect(page).toHaveURL(/onboarding/);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/cómo te llamas/i).fill(name);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/tu espacio/i).fill("Universidad 2027");
  await page.getByRole("button", { name: /crear mi espacio/i }).click();
  await expect(page.getByText(new RegExp(`, ${name}$`))).toBeVisible();
  await page.goto("/app/import");
  await page.getByTestId("pack-input").setInputFiles(PRIVATE ? readdirSync(DATA).filter((f) => f.endsWith(".json")).map((f) => join(DATA, f)) : ["seed/demo-pack.json"]);
  await page.getByRole("button", { name: "Importar ahora" }).click();
  await expect(page.getByText(/importamos todo sin errores/i)).toBeVisible({ timeout: 30_000 });
  return { page, email, nInst: PRIVATE ? 65 : 4 };
}
