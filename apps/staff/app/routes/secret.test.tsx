import { MOCK_GATEWAY_URL, mockState, USERS } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import * as stepUpRoute from "@/routes/resources.step-up";
import * as secret from "@/routes/secret";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const api = graphql.link(`${MOCK_GATEWAY_URL}/graphql`);
const page = {
  action: secret.action,
  Component: secret.default,
  ErrorBoundary: secret.ErrorBoundary,
  loader: secret.loader,
  path: "/secret/:id",
};
const routes = [
  page,
  { action: stepUpRoute.action, path: "/resources/step-up" },
  { Component: () => <h1>Folder</h1>, path: "/browse/:folderId" },
];

const open = (id: string, user?: string) => renderRoute(`/secret/${id}`, routes, { user });
const row = (name: string) => screen.getByRole("group", { name });
const card = (name: string) => screen.getByRole("region", { name });
const menu = async (user: ReturnType<typeof userEvent.setup>, item: RegExp | string) => {
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
};

describe("the secret detail page", () => {
  it("shows a secret's fields, details and history, with sensitive values masked", async () => {
    open("mock-secret-db-admin");
    expect(await screen.findByRole("heading", { level: 1, name: /DB admin/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform / Databases" })).toHaveAttribute(
      "href",
      "/browse/mock-folder-databases",
    );
    expect(within(card("Details")).getByText("Database Account")).toBeInTheDocument();
    expect(within(row("Username")).getByText("postgres_admin")).toBeInTheDocument();
    const password = row("Password");
    expect(within(password).getByRole("button", { name: "Reveal Password" })).toBeInTheDocument();
    expect(password).not.toHaveTextContent("mock-Tongue-Eyelet-91");
    expect(within(card("Details")).getByText("Primary database")).toBeInTheDocument();
    expect(within(card("History")).getByText("Version 3")).toBeInTheDocument();
    expect(within(card("History")).getByText("Active")).toBeInTheDocument();
  });

  it("links to the editor and sharing from the Actions menu", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    await user.click(await screen.findByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menuitem", { name: "Edit" })).toHaveAttribute(
      "href",
      "/secret/mock-secret-db-admin/edit",
    );
    expect(screen.getByRole("menuitem", { name: "Manage access" })).toHaveAttribute(
      "href",
      "/secret/mock-secret-db-admin/sharing",
    );
  });

  it("reveals a value on request, spells it out on the keypad, copies it and hides it again", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    await user.click(await screen.findByRole("button", { name: "Reveal Password" }));
    const password = row("Password");
    expect(await within(password).findByText("mock-Tongue-Eyelet-91")).toBeInTheDocument();

    await user.click(within(password).getByRole("button", { name: "Phonetic" }));
    const keypad = within(password).getByRole("list", { name: "Password, spelled out" });
    const cells = within(keypad).getAllByRole("listitem");
    expect(cells).toHaveLength("mock-Tongue-Eyelet-91".length);
    expect(cells[0]).toHaveTextContent(/^1m.*mike$/);
    expect(cells[5]).toHaveTextContent(/T.*tango \(cap\)/);
    expect(cells[4]).toHaveTextContent(/dash/);

    await user.click(within(password).getByRole("button", { name: "Copy Password" }));
    expect(await navigator.clipboard.readText()).toBe("mock-Tongue-Eyelet-91");

    await user.click(within(password).getByRole("button", { name: "Hide" }));
    expect(password).not.toHaveTextContent("mock-Tongue-Eyelet-91");
    expect(within(password).queryByRole("list")).toBeNull();
  });

  it("asks for a fresh second factor before a copy where the folder requires one", async () => {
    const databases = mockState.world.folders.find((f) => f.id === "mock-folder-databases");
    if (databases) databases.revealStepUp = "require";
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    const password = await screen.findByRole("group", { name: "Password" });
    await user.click(within(password).getByRole("button", { name: "Copy Password" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    expect(dialog).toHaveTextContent("Revealing Password needs a fresh second factor.");
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await vi.waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe("mock-Tongue-Eyelet-91"),
    );
  });

  it("asks for a fresh second factor before a super-sensitive reveal", async () => {
    const user = userEvent.setup();
    open("mock-secret-portal-cert");
    const key = await screen.findByRole("group", { name: "Private key" });
    await user.click(within(key).getByRole("button", { name: "Reveal Private key" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    expect(
      await within(key).findByText("mock•••••••••••••••••••••••••••• key"),
    ).toBeInTheDocument();
    await user.click(within(key).getByRole("button", { name: "Show all" }));
    expect(within(key).getByText("mock certificate key, not a real key")).toBeInTheDocument();
  });

  it("shows someone without access that the secret exists, and where to ask for it", async () => {
    open("mock-secret-helpdesk", "mock-user-bob");
    expect(
      await screen.findByRole("heading", { level: 1, name: /Helpdesk reset account/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request access" })).toHaveAttribute(
      "href",
      "/requests?new=mock-secret-helpdesk",
    );
    expect(within(row("Password")).getByText("Request access to reveal")).toBeInTheDocument();
    expect(within(row("Account Name")).queryByText("helpdesk-reset")).toBeNull();
    expect(screen.queryByRole("region", { name: "History" })).toBeNull();
  });

  it("says a secret isn't there when the person can't see it", async () => {
    open("mock-secret-alice-wifi", "mock-user-bob");
    expect(await screen.findByText("Secret not found")).toBeInTheDocument();
    expect(screen.queryByText("Lab wifi")).toBeNull();
  });

  it("offers Retry when the gateway can't answer, and recovers", async () => {
    server.use(
      api.query("SecretDetail", () =>
        HttpResponse.json({ errors: [{ extensions: { code: "UNAVAILABLE" }, message: "down" }] }),
      ),
    );
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    expect(await screen.findByText("Couldn't load this secret")).toBeInTheDocument();
    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { level: 1, name: /DB admin/ })).toBeInTheDocument();
  });

  it("says when there are no earlier versions yet", async () => {
    open("mock-secret-db-reporting");
    expect(
      await within(await screen.findByRole("region", { name: "History" })).findByText(
        "No earlier versions yet.",
      ),
    ).toBeInTheDocument();
  });

  it("breaks glass with a reason and a code, refusing a wrong code", async () => {
    const user = userEvent.setup();
    open("mock-secret-acme-vpn");
    await screen.findByRole("heading", { level: 1, name: /Acme VPN/ });
    await menu(user, /Break glass/);
    const dialog = await screen.findByRole("dialog", { name: "Break glass on Acme VPN?" });
    const go = within(dialog).getByRole("button", { name: "Break glass" });
    expect(go).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Reason/), "Directory outage, need the account.");
    await user.type(within(dialog).getByLabelText("6-digit code"), "000000");
    await user.click(go);
    expect(
      await within(dialog).findByText("That code didn't work. Try again."),
    ).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("6-digit code"));
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await user.click(within(dialog).getByRole("button", { name: "Break glass" }));
    const reveal = await screen.findByRole("region", { name: "Break-glass reveal" });
    expect(within(reveal).getByText("mock-Lace-Up-4417")).toBeInTheDocument();
    expect(screen.getByText("Break glass active")).toBeInTheDocument();
    await user.click(within(reveal).getByRole("button", { name: "Hide and end" }));
    expect(screen.queryByText("mock-Lace-Up-4417")).toBeNull();
  });

  it("retires a secret, locks its fields and restores it", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    await screen.findByRole("heading", { level: 1, name: /DB admin/ });
    await menu(user, "Retire");
    expect(await screen.findByText(/^Retired on /)).toBeInTheDocument();
    expect(within(row("Password")).getByText("Retired, restore to reveal")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Restore" })[0]!);
    await vi.waitFor(() => expect(screen.queryByText(/^Retired on /)).toBeNull());
  });

  it("asks for the name before deleting in production, then goes back to the folder", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    await screen.findByRole("heading", { level: 1, name: /DB admin/ });
    await menu(user, /Delete permanently/);
    const dialog = await screen.findByRole("dialog", { name: "Delete DB admin permanently?" });
    const go = within(dialog).getByRole("button", { name: "Delete permanently" });
    expect(go).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/to confirm/), "DB admin");
    await user.click(go);
    expect(await screen.findByRole("heading", { name: "Folder" })).toBeInTheDocument();
    expect(mockState.world.secrets.some((s) => s.id === "mock-secret-db-admin")).toBe(false);
  });

  it("rotates after a confirmation and lists the new version", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    await screen.findByRole("heading", { level: 1, name: /DB admin/ });
    await menu(user, /Rotate now/);
    const dialog = await screen.findByRole("alertdialog", {
      name: "Rotate credential for DB admin?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Rotate" }));
    expect(await within(card("History")).findByText("Version 4")).toBeInTheDocument();
  });

  it("turns automation and agent approval on and off", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    const heartbeat = await screen.findByRole("switch", { name: "Heartbeat validation" });
    expect(heartbeat).toBeChecked();
    await user.click(heartbeat);
    await vi.waitFor(() =>
      expect(screen.getByRole("switch", { name: "Heartbeat validation" })).not.toBeChecked(),
    );
    const levels = screen.getByRole("radiogroup", { name: "Approval for reveals" });
    await user.click(within(levels).getByRole("radio", { name: "Non-owners" }));
    expect(await screen.findByText("Non-owners need approval")).toBeInTheDocument();
    await user.click(within(levels).getByRole("radio", { name: "Everyone" }));
    expect(await screen.findByText("Every reveal needs approval")).toBeInTheDocument();
  });

  it("explains each approval level, and that service accounts are never held", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    const levels = await screen.findByRole("radiogroup", { name: "Approval for reveals" });
    expect(screen.getByText(/Anyone who can read this secret reveals it/)).toBeInTheDocument();
    expect(screen.getByText(/Service accounts are never held for approval/)).toBeInTheDocument();
    await user.click(within(levels).getByRole("radio", { name: "Everyone" }));
    expect(await screen.findByText(/owners' own included/)).toBeInTheDocument();
  });

  it("holds a non-owner's reveal of an approval-required secret until an owner decides", async () => {
    const user = userEvent.setup();
    open("mock-secret-build-ssh", "mock-user-bob");
    await user.click(await screen.findByRole("button", { name: "Reveal Passphrase" }));
    const held = await screen.findByText(/Waiting for an owner or approver of this secret/);
    expect(held).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See this task's requests" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/approvals\/run\/web_[0-9a-f]{32}$/),
    );
    const use = mockState.world.secretUses.find(
      (u) => u.ownerUserId === "mock-user-bob" && u.reveal,
    );
    expect(use).toMatchObject({ confirm: false, state: "pending" });
  });

  it("reveals an old version's value to the recovery role after a step-up", async () => {
    USERS.find((u) => u.id === "mock-user-alice")?.roles.push("recovery");
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    const history = await screen.findByRole("region", { name: "History" });
    await user.click(within(history).getByRole("button", { name: "Prior values of version 2" }));
    await user.click(within(history).getByRole("button", { name: "Reveal Username, version 2" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    expect(await within(history).findByText(/^mock-v2-username-/)).toBeInTheDocument();
  });

  it("says why an old value can't be shown without the recovery role", async () => {
    const user = userEvent.setup();
    open("mock-secret-db-admin");
    const history = await screen.findByRole("region", { name: "History" });
    await user.click(within(history).getByRole("button", { name: "Prior values of version 2" }));
    await user.click(within(history).getByRole("button", { name: "Reveal Username, version 2" }));
    expect(
      await within(history).findByText(/Prior values need the recovery role/),
    ).toBeInTheDocument();
  });
});

describe("a secret the gateway doesn't say can be read", () => {
  it("shows it locked when canRead is null, never as readable", async () => {
    const id = "mock-secret-edge-router";
    const w = mockState.world;
    const s = w.secrets.find((x) => x.id === id)!;
    const type = w.secretTypes.find((t) => t.id === s.typeId)!;
    server.use(
      api.query("SecretDetail", () =>
        HttpResponse.json({
          data: {
            folders: w.folders
              .filter((f) => f.scope !== "personal")
              .map((f) => ({
                id: f.id,
                name: f.name,
                parentId: f.parentId ?? null,
                scope: f.scope,
              })),
            secret: {
              canRead: null,
              expiresAt: null,
              folderId: s.folderId,
              heartbeatOptOut: false,
              id,
              lastAccessedAt: null,
              lastHeartbeatResult: null,
              lastRotationResult: null,
              name: s.name,
              nextRotationAt: null,
              requireTokenApproval: false,
              retired: false,
              retiredAt: "",
              rotatedAt: null,
              rotationIntervalDays: null,
              rotationOptOut: false,
              targetId: null,
              typeId: s.typeId,
              verifiedAt: null,
              viewCount: 0,
            },
            secretTypes: [
              {
                checkout: null,
                fields: type.fields.map((f) => ({
                  key: f.key,
                  kind: f.kind,
                  label: f.label,
                  options: null,
                  rotates: null,
                  sensitive: f.sensitive ?? null,
                  superSensitive: null,
                })),
                heartbeat: null,
                id: type.id,
                name: type.name,
                origin: type.origin,
                rotation: null,
                vendor: null,
              },
            ],
            targets: [],
          },
        }),
      ),
    );
    open(id);
    expect(
      await screen.findByRole("heading", { level: 1, name: /Edge router admin/ }),
    ).toBeInTheDocument();
    const password = row("Password");
    expect(within(password).getByText("Request access to reveal")).toBeInTheDocument();
    expect(within(password).queryByRole("button", { name: /Reveal/ })).toBeNull();
    expect(screen.getByRole("link", { name: "Request access" })).toHaveAttribute(
      "href",
      `/requests?new=${id}`,
    );
  });
});

describe("checking a secret out", () => {
  it("checks in and out, and asks for a check-out before revealing, as a workflow aid", async () => {
    const user = userEvent.setup();
    open("mock-secret-acme-vpn");
    const checkout = await screen.findByRole("region", { name: "Checkout" });
    expect(within(checkout).getByText("Checked out by you")).toBeInTheDocument();
    expect(within(row("Password")).getByRole("button", { name: "Reveal Password" })).toBeEnabled();

    await user.click(within(checkout).getByRole("button", { name: "Check in now" }));
    expect(
      await within(row("Password")).findByText("Check out first, so others know it's in use"),
    ).toBeInTheDocument();
    expect(within(card("Checkout")).getByText("Available")).toBeInTheDocument();

    await user.click(within(card("Checkout")).getByRole("radio", { name: "4h" }));
    await user.click(
      within(card("Checkout")).getByRole("button", { name: "Check out for 4 hours" }),
    );
    expect(await within(card("Checkout")).findByText("Checked out by you")).toBeInTheDocument();
    await user.click(within(row("Password")).getByRole("button", { name: "Reveal Password" }));
    expect(await within(row("Password")).findByText("mock-Lace-Up-4417")).toBeInTheDocument();
  });

  it("asks for a fresh second factor before checking out a sensitive type", async () => {
    const ad = mockState.world.secretTypes.find((t) => t.id === "type-active-directory");
    if (ad)
      ad.fields = ad.fields.map((f) => (f.key === "password" ? { ...f, superSensitive: true } : f));
    const user = userEvent.setup();
    open("mock-secret-acme-vpn");
    const checkout = await screen.findByRole("region", { name: "Checkout" });
    await user.click(within(checkout).getByRole("button", { name: "Check in now" }));
    expect(
      await within(row("Password")).findByText("Check out first, so others know it's in use"),
    ).toBeInTheDocument();
    await user.click(within(card("Checkout")).getByRole("button", { name: /^Check out for/ }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    expect(dialog).toHaveTextContent("Checking this secret out needs a fresh second factor.");
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(await within(card("Checkout")).findByText("Checked out by you")).toBeInTheDocument();
  });

  it("locks a secret someone else holds, and won't rotate it", async () => {
    const user = userEvent.setup();
    open("mock-secret-build-ssh");
    const checkout = await screen.findByRole("region", { name: "Checkout" });
    expect(within(checkout).getByText(/Someone else has it checked out/)).toBeInTheDocument();
    expect(within(row("Passphrase")).getByText("Checked out by someone else")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Checked out" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Actions" }));
    expect(await screen.findByRole("menuitem", { name: /Break glass/ })).toBeInTheDocument();
  });
});

describe("a certificate", () => {
  it("shows its details and how soon it expires", async () => {
    open("mock-secret-portal-cert");
    const cert = await screen.findByRole("region", { name: "Certificate" });
    expect(within(cert).getByText("CN=portal.example.org")).toBeInTheDocument();
    expect(within(cert).getByText(/Expiring · [45]d/)).toBeInTheDocument();
    expect(screen.getByText(/^Expires in [45] days$/)).toBeInTheDocument();
  });

  it("exports in a chosen format", async () => {
    const user = userEvent.setup();
    const created = vi.fn(() => "blob:mock");
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    open("mock-secret-portal-cert");
    await user.click(await screen.findAllByRole("button", { name: "Export…" }).then((r) => r[0]!));
    const dialog = await screen.findByRole("dialog", { name: "Export certificate" });
    await user.click(within(dialog).getByRole("radio", { name: /PKCS#12/ }));
    expect(within(dialog).getByRole("button", { name: "Export" })).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/New passphrase/), "mock-passphrase");
    await user.click(within(dialog).getByRole("button", { name: "Export" }));
    await vi.waitFor(() => expect(created).toHaveBeenCalled());
  });

  it("replaces the certificate with a new file", async () => {
    const user = userEvent.setup();
    open("mock-secret-portal-cert");
    await user.click(await screen.findAllByRole("button", { name: "Replace…" }).then((r) => r[0]!));
    const dialog = await screen.findByRole("dialog", { name: "Replace certificate" });
    const file = new File(["mock certificate, reissued"], "portal.pem", { type: "text/plain" });
    await user.upload(within(dialog).getByLabelText(/Drop a file or choose one/), file);
    await user.click(within(dialog).getByRole("button", { name: "Replace" }));
    await vi.waitFor(() =>
      expect(within(card("History")).getByText("Version 2")).toBeInTheDocument(),
    );
  });
});
