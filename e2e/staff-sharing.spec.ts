import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("share a folder with a person, check it in the simulator, save it and take it back", async ({
  page,
}) => {
  await signInAsAlice(page, "/folder/mock-folder-network/sharing");
  await expect(page.getByRole("heading", { name: "Platform / Network" })).toBeVisible();
  await expect(page.getByText("All changes saved.")).toBeVisible();

  await page.getByRole("button", { name: "Pick a person" }).click();
  await page.getByPlaceholder("Search people").fill("bob");
  await page.getByRole("option", { name: /Bob/ }).click();
  await expect(page.getByText("Reveal · No")).toBeVisible();

  await page.getByRole("button", { name: "Add person or group" }).click();
  await page.getByPlaceholder("Search people and groups").fill("bob");
  await page.getByRole("option", { name: /Bob/ }).click();
  await expect(page.getByRole("checkbox", { name: "Bob: Reveal" })).toBeChecked();
  await expect(page.getByText("Unsaved changes")).toBeVisible();
  await expect(page.getByText("Reveal · Yes")).toBeVisible();

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Bob: Reveal" })).toBeChecked();

  await page.getByRole("radio", { name: "Advanced (RACI grid)" }).click();
  await page.getByRole("button", { name: "Delete rule 1" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("All changes saved.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rule 1, Bob, Reveal: allow" })).toHaveCount(0);
});
