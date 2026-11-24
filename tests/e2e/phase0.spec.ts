import { expect, test } from "@playwright/test";
import { PASS, signUp, studentWithData } from "./helpers";

test("phase 0 acceptance: sign up, space, import, invite guardian", async ({ browser }) => {
  const { page: s, nInst } = await studentWithData(browser);
  await s.goto("/app/universities");
  await expect(s.getByText(`${nInst} de ${nInst}`)).toBeVisible();

  const dad = `dad-${Date.now()}@example.test`;
  await s.goto("/app/members");
  await s.getByLabel("Correo").fill(dad);
  await s.getByLabel(/mensaje/i).fill("Papá, así vas a poder ver cómo voy.");
  await s.getByRole("button", { name: /enviar invitación/i }).click();
  const invite = await s.getByTestId("invite-link").inputValue();
  expect(invite).toMatch(/\/invite\/[a-f0-9]{64}$/);

  const d = await (await browser.newContext({ locale: "es-ES" })).newPage();
  await d.goto(invite);
  await expect(d.getByRole("heading", { name: /ricardo te invita/i })).toBeVisible();
  await d.getByRole("link", { name: /aceptar invitación/i }).click();
  await d.getByLabel(/correo/i).fill(dad);
  await d.getByLabel("Contraseña", { exact: true }).fill(PASS);
  await d.getByRole("button", { name: "Crear cuenta" }).click();
  await d.getByRole("button", { name: /aceptar invitación/i }).click();
  await expect(d).toHaveURL(/\/app\/family$/);
  await expect(d.getByRole("note")).toContainText(/como familia/i);
  for (const url of ["/app/import", "/app/members", "/app/subscribe"]) { await d.goto(url); await expect(d).toHaveURL(/\/app(\/family)?$/); }
  // Guardians see the calendar but cannot capture or edit.
  await expect(d.getByRole("button", { name: "Capturar" })).toHaveCount(0);
});

test("wrong password shows a calm, specific error", async ({ browser }) => {
  const page = await (await browser.newContext({ locale: "es-ES" })).newPage();
  await page.goto("/login");
  await page.getByLabel(/correo/i).fill(`nobody-${Date.now()}@example.test`);
  await page.getByLabel("Contraseña", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "El correo o la contraseña no coinciden." })).toBeVisible();
  void signUp;
});
