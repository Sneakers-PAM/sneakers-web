import { test } from "@playwright/test";

import { signInAsAlice } from "./signIn";
import { checkTextSizes } from "./textSize";

test("every text size changes what the staff app renders, and sticks", async ({ page }) => {
  await signInAsAlice(page, "/");
  await checkTextSizes(page);
});
