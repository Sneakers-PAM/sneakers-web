import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("browse a folder, make a subfolder, move it and delete it", async ({ page }) => {
  await signInAsAlice(page, "/browse/mock-folder-databases");
  await expect(page.getByRole("heading", { name: "Databases" })).toBeVisible();
  await expect(page.getByRole("link", { name: "DB admin" })).toHaveAttribute(
    "href",
    "/secret/mock-secret-db-admin",
  );

  const folders = page.getByRole("navigation", { name: "Folders" });
  await folders.getByRole("button", { name: "Up from Platform" }).click();
  await folders.getByRole("link", { name: /Platform/ }).click();
  await expect(page.getByRole("heading", { name: "Platform" })).toBeVisible();

  await page.getByRole("button", { name: "Folder actions" }).click();
  await page.getByRole("menuitem", { name: "New folder…" }).click();
  await page.getByLabel("Name").fill("Staging");
  await page.getByRole("button", { name: "Create" }).click();
  const staging = folders.getByRole("link", { name: /Staging/ });
  await expect(staging).toBeVisible();

  await staging.click();
  await expect(page.getByRole("heading", { name: "Staging" })).toBeVisible();
  await expect(page.getByText("No secrets here yet")).toBeVisible();

  await page.getByRole("button", { name: "Folder actions" }).click();
  await page.getByRole("menuitem", { name: "Move…" }).click();
  await page.getByRole("radio", { name: "Platform / Network" }).click();
  await page.getByRole("button", { name: "Move here" }).click();
  await expect(page.getByText("Secret · Platform / Network")).toBeVisible();

  await page.getByRole("button", { name: "Folder actions" }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete folder" }).click();
  await expect(page.getByRole("heading", { name: "Network" })).toBeVisible();
  await expect(folders.getByRole("link", { name: /Staging/ })).toHaveCount(0);
});

test("a folder without access says who owns it", async ({ page }) => {
  await signInAsAlice(page, "/browse/mock-folder-finance");
  await expect(page.getByText("You can't open this folder")).toBeVisible();
  await expect(page.getByText(/Bob owns it/)).toBeVisible();
});
