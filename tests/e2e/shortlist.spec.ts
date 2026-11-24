import { expect, test } from "@playwright/test";
import { PRIVATE, studentWithData } from "./helpers";

test("shortlist → ponder → pursue → compare → enrich → timeline", async ({ browser }) => {
  const { page } = await studentWithData(browser);

  // Explore gallery: mark two universities with the cloud.
  await page.goto("/app/universities");
  const cards = page.getByTestId("uni-card");
  await expect(cards.first()).toBeVisible();
  for (const i of [0, 1]) await cards.nth(i).getByRole("button", { name: "Me interesa" }).click();
  await expect(cards.nth(1).getByRole("button", { name: "Quitar de la lista" })).toBeVisible();

  // Scholarships: filter by country and shortlist one.
  await page.goto("/app/scholarships");
  const country = page.getByTestId("country");
  const firstCountry = await country.locator("option").nth(1).getAttribute("value");
  await country.selectOption(firstCountry!);
  await expect(page.getByText(/^\d+ de \d+$/)).toBeVisible();

  // Board shows both; ponder on the first.
  await page.goto("/app/list");
  await expect(page.getByTestId("board-card")).toHaveCount(2);
  await page.getByTestId("board-card").first().getByRole("link").nth(1).click();
  await page.getByRole("radio", { name: "Me encanta" }).click();
  await page.getByPlaceholder("Agrega algo a favor").fill("Ciudad con invierno de verdad");
  await page.getByPlaceholder("Agrega algo a favor").press("Enter");
  await page.getByRole("radio", { name: "Voy por ella" }).click();
  await expect(page.getByRole("radio", { name: "Voy por ella" })).toHaveAttribute("aria-checked", "true");

  // Enrich: photo upload (compressed in the browser), own fact, linked task.
  await page.getByTestId("photo-input").setInputFiles("tests/e2e/fixture-campus.jpg");
  await expect(page.getByTestId("photo")).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText("Portada", { exact: true })).toBeVisible();
  const img = await page.getByTestId("photo").locator("img").getAttribute("src");
  const res = await page.request.get(img!);
  expect(res.headers()["content-type"]).toBe("image/webp");
  expect((await res.body()).length).toBeLessThan(450 * 1024);
  await page.getByRole("button", { name: "Agregar dato" }).click();
  await page.getByLabel("Dato").fill("Residencia");
  await page.getByLabel("Valor").fill("¥1.200 al mes, habitación doble");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado").first()).toBeVisible();
  await page.getByTestId("task-input").fill("Escribir a admisiones sobre Duolingo el 10 de enero");
  await page.getByRole("button", { name: "Crear tarea" }).click();
  await expect(page.getByText("Escribir a admisiones sobre Duolingo", { exact: true }).first()).toBeVisible();

  // Board: card moved to "Voy por ella" with its cover photo.
  await page.goto("/app/list");
  await expect(page.getByText(/Vas por 1 opción/)).toBeVisible();
  await expect(page.getByRole("region", { name: /Voy por ella/ }).getByTestId("board-card").locator("img")).toHaveCount(1);

  // Compare the two.
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByTestId("compare-go").click();
  await expect(page.getByRole("heading", { name: "Comparar" })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Puntaje" })).toBeVisible();
  await expect(page.getByText("Mejor").first()).toBeVisible();

  // Timeline: the shortlisted options appear as rows (when they have dates).
  await page.goto("/app/calendar?view=timeline&d=2026-11-01");
  if (PRIVATE) await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByRole("link", { name: /Solo mi lista/ })).toBeVisible();
});
