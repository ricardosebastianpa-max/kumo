import { expect, test } from "@playwright/test";
import { PRIVATE, studentWithData } from "./helpers";

test("phase 1 acceptance: today, calendar edit with audit, capture, catalogs, ICS", async ({ browser }) => {
  const { page, nInst } = await studentWithData(browser);

  // Today: one main thing, calm copy.
  await page.goto("/app");
  await expect(page.getByText("Lo más importante ahora")).toBeVisible();

  // Catalog: all institutions, ranked; HIT first with the research score.
  await page.goto("/app/universities");
  await expect(page.getByText(`${nInst} de ${nInst}`)).toBeVisible();
  if (PRIVATE) await expect(page.getByTestId("uni-card").first()).toContainText("Harbin Institute of Technology");
  if (PRIVATE) await expect(page.getByTestId("uni-card").first().getByRole("img", { name: "Puntaje: 79.4" })).toBeVisible();

  // Edit a deadline from its sheet → change lands in history (audit log).
  await page.goto("/app/calendar?view=agenda&d=2026-11-01");
  await page.getByTestId("cal-event").first().click();
  const dateInput = page.getByTestId("ev-date");
  await expect(dateInput).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  await dateInput.fill("2027-01-15");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();
  await page.goto("/app/calendar?view=agenda&d=2027-01-15");
  await page.getByTestId("cal-event").first().click();
  await expect(page.getByTestId("ev-history")).toContainText(/cambió fecha/);

  // Quick capture with natural language.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.getByTestId("capture-input").fill("examen IELTS el 14 de feb a las 8 am");
  await expect(page.getByText(/14 de febrero · 08:00/)).toBeVisible();
  await page.getByRole("button", { name: "Agregar" }).click();
  await expect(page.getByText("Agregado: examen IELTS")).toBeVisible();

  // ICS feed: subscribable, contains imported and captured events.
  await page.goto("/app/subscribe");
  const url = await page.getByTestId("ics-url").inputValue();
  const res = await page.request.get(url);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const ics = await res.text();
  expect(ics).toContain("BEGIN:VCALENDAR");
  expect(ics).toContain("examen IELTS");
  expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBeGreaterThanOrEqual(PRIVATE ? 56 : 3);
});
