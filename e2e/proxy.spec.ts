import { expect, test } from "@playwright/test";

// The staff server runs with TRUST_PROXY=1 and the admin server without it (playwright.config.ts),
// so these posts arrive as they would from a TLS-terminating edge in front of each.
const STAFF = "http://127.0.0.1:4176";
const ADMIN = "http://127.0.0.1:4177";
const EDGE_HOST = "pam.example.org";

const signIn = (base: string, path: string, headers: Record<string, string>) =>
  fetch(`${base}${path}`, {
    body: new URLSearchParams({ identifier: "alice", intent: "login", next: "/", password: "any" }),
    headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers },
    method: "POST",
    redirect: "manual",
  });

const forwarded = { "X-Forwarded-Host": EDGE_HOST, "X-Forwarded-Proto": "https" };

test("behind a trusted proxy, a same-origin https form post goes through", async () => {
  const response = await signIn(STAFF, "/sign-in", {
    ...forwarded,
    Origin: `https://${EDGE_HOST}`,
  });
  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Enter your code");
});

test("behind a trusted proxy, a post from another origin is still refused", async () => {
  const response = await signIn(STAFF, "/sign-in", {
    ...forwarded,
    Origin: "https://elsewhere.example.org",
  });
  expect(response.status).toBe(400);
});

test("without TRUST_PROXY, forwarded headers are ignored", async () => {
  const response = await signIn(ADMIN, "/admin/sign-in", {
    ...forwarded,
    Origin: `https://${EDGE_HOST}`,
  });
  expect(response.status).toBe(400);
});

test("a direct same-origin post still works without a proxy", async () => {
  const response = await signIn(ADMIN, "/admin/sign-in", { Origin: ADMIN });
  expect(response.status).toBe(200);
});

test("behind a trusted proxy, a forwarded host with its own port works too", async () => {
  const response = await signIn(STAFF, "/sign-in", {
    Origin: `https://${EDGE_HOST}:8443`,
    "X-Forwarded-Host": `${EDGE_HOST}:8443`,
    "X-Forwarded-Proto": "https",
  });
  expect(response.status).toBe(200);
});
