import { expect, test } from "@playwright/test";
import { studentWithData } from "./helpers";

test("study library: import CSVs, tick a route step, see the next one on Today", async ({ browser }) => {
  const { page } = await studentWithData(browser);
  await page.goto("/app/import");
  await page.getByTestId("pack-input").setInputFiles(["seed/csca-library/ruta-0-100.csv", "seed/csca-library/profundizar.csv", "seed/csca-library/canales.csv"]);
  await expect(page.getByRole("row", { name: /Biblioteca de estudio/ })).toContainText(String(85 + 107 + 34));
  await page.getByRole("button", { name: "Importar ahora" }).click();
  await expect(page.getByText(/importamos todo sin errores/i)).toBeVisible({ timeout: 30_000 });

  await page.goto("/app/study");
  await expect(page.getByTestId("route-progress")).toHaveText("0 de 85 hechos");
  await page.getByRole("button", { name: /Marcar como hecho: Conviértete/ }).click();
  await expect(page.getByTestId("route-progress")).toHaveText("1 de 85 hechos");

  // Notes persist.
  await page.getByRole("button", { name: /^#2 División/ }).click();
  await page.getByLabel("Mis notas").fill("Practicar 20 divisiones");
  await page.getByLabel("Mis notas").blur();
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: /^#2 División/ }).click();
  await expect(page.getByLabel("Mis notas")).toHaveValue("Practicar 20 divisiones");

  await page.goto("/app");
  await expect(page.getByTestId("today-study")).toContainText("#2 · División");

  await page.goto("/app/study?tab=deep");
  await expect(page.getByTestId("study-row").first()).toBeVisible();
  await page.goto("/app/study?tab=channel");
  await expect(page.getByText("3Blue1Brown")).toBeVisible();
});
