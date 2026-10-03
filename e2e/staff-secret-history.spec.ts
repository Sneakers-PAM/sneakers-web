import { expect, test } from "@playwright/test";

import { signInAsAlice } from "./signIn";

test("the history lists every change without values, and explains the recovery role", async ({
  page,
}) => {
  await signInAsAlice(page, "/secret/mock-secret-db-admin");
  const history = page.getByRole("region", { name: "History" });
  await expect(history.getByText("Version 3")).toBeVisible();
  await expect(history.getByText("Changed: username")).toHaveCount(2);
  await expect(history.getByText("Created")).toBeVisible();
  await expect(history.getByText(/recovery role, which a site admin grants/)).toBeVisible();

  await history.getByRole("button", { name: "Prior values of version 2" }).click();
  await expect(history.getByRole("button", { name: /^Restore/ })).toHaveCount(0);
  await history.getByRole("button", { name: "Reveal Username, version 2" }).click();
  await expect(history.getByText(/Prior values need the recovery role/)).toBeVisible();
  await expect(history).not.toContainText(/mock-v\d-/);
});
