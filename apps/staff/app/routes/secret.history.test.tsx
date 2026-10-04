import { mockState, USERS } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { Toaster } from "@sneakers-web/ui";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as stepUpRoute from "@/routes/resources.step-up";
import * as secret from "@/routes/secret";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const DB = "mock-secret-db-admin";
const BOB = "mock-user-bob";

const routes = [
  {
    action: secret.action,
    Component: () => (
      <>
        <secret.default />
        <Toaster />
      </>
    ),
    ErrorBoundary: secret.ErrorBoundary,
    loader: secret.loader,
    path: "/secret/:id",
  },
  { action: stepUpRoute.action, path: "/resources/step-up" },
];

const open = (user?: string) => renderRoute(`/secret/${DB}`, routes, { user });
const history = () => screen.findByRole("region", { name: "History" });
const grantRecovery = (userId = "mock-user-alice") =>
  USERS.find((u) => u.id === userId)?.roles.push("recovery");
const database = () => mockState.world.secrets.find((s) => s.id === DB)!;

type User = ReturnType<typeof userEvent.setup>;

/** Open version 2's prior values and confirm its restore. */
const restoreVersion2 = async (user: User) => {
  const card = await history();
  await user.click(within(card).getByRole("button", { name: "Prior values of version 2" }));
  await user.click(within(card).getByRole("button", { name: "Restore version 2" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Restore version 2?" });
  await user.click(within(dialog).getByRole("button", { name: "Restore version" }));
  return card;
};

const stepUp = async (user: User) => {
  const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
  await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
};

describe("the history on the secret page", () => {
  it("lists the changes to an everyday reader, with no values and no restore", async () => {
    const user = userEvent.setup();
    open(BOB);
    const card = await history();
    expect(within(card).getByText("Version 3")).toBeInTheDocument();
    expect(within(card).getAllByText("Changed: username")).toHaveLength(2);
    expect(within(card).getByText("Created")).toBeInTheDocument();
    expect(within(card).getAllByText(/^by Alice/)).toHaveLength(3);
    expect(within(card).getByText(/recovery role, which a site admin grants/)).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Prior values of version 2" }));
    expect(within(card).queryByRole("button", { name: /^Restore/ })).toBeNull();
    expect(card).not.toHaveTextContent(/mock-v\d-/);
    expect(card).not.toHaveTextContent(database().fields.username!);
  });

  it("restores a prior version for the recovery role, after a confirm and a step-up", async () => {
    grantRecovery();
    const user = userEvent.setup();
    open();
    const card = await restoreVersion2(user);
    await stepUp(user);
    expect(await within(card).findByText("Version 4")).toBeInTheDocument();
    expect(
      await screen.findByText("Version 2's values are the current ones now, as version 4."),
    ).toBeInTheDocument();
    expect(database().versions[0]).toMatchObject({ active: true, versionNo: 4 });
    expect(database().fields.username).toMatch(/^mock-v2-username-/);
  });

  it("leaves the history as it was when the confirm is cancelled", async () => {
    grantRecovery();
    const user = userEvent.setup();
    open();
    const card = await history();
    await user.click(within(card).getByRole("button", { name: "Prior values of version 2" }));
    await user.click(within(card).getByRole("button", { name: "Restore version 2" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Restore version 2?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(database().versions).toHaveLength(3);
  });

  it("names who holds the check-out that blocks a restore", async () => {
    grantRecovery();
    mockState.world.leases.push({
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      id: "mock-lease-history-bob",
      issuedAt: new Date().toISOString(),
      returned: false,
      secretId: DB,
      userId: BOB,
    });
    const user = userEvent.setup();
    open();
    const card = await restoreVersion2(user);
    expect(
      await within(card).findByText(
        "Bob has this secret checked out. Restore it after they check it in.",
      ),
    ).toBeInTheDocument();
    expect(database().versions).toHaveLength(3);
  });

  it("says when a rotation is under way", async () => {
    grantRecovery();
    database().lastRotationResult = "rotating";
    const user = userEvent.setup();
    open();
    const card = await restoreVersion2(user);
    await stepUp(user);
    expect(
      await within(card).findByText(
        "The secret is being rotated. Try again when the rotation finishes.",
      ),
    ).toBeInTheDocument();
  });

  it("explains the recovery role when the server says it's missing", async () => {
    grantRecovery();
    const user = userEvent.setup();
    open();
    await history();
    // The role was taken away after the page loaded.
    const alice = USERS.find((u) => u.id === "mock-user-alice")!;
    alice.roles = alice.roles.filter((r) => r !== "recovery");
    const card = await restoreVersion2(user);
    expect(
      await within(card).findByText(
        /Restoring needs the recovery role\. It lets a person reveal earlier values and bring one back, and a site admin grants it\./,
      ),
    ).toBeInTheDocument();
    expect(database().versions).toHaveLength(3);
  });
});

describe("folder moves on the secret page", () => {
  it("shows a move as a move, with both folders, and no new version", async () => {
    const s = database();
    s.moves.unshift({
      fromFolderId: "mock-folder-databases",
      movedAt: new Date().toISOString(),
      movedBy: "mock-user-alice",
      movedByName: "Alice",
      toFolderId: "mock-folder-network",
    });
    s.folderId = "mock-folder-network";
    open();
    const card = await history();
    expect(within(card).getByText("Moved")).toBeInTheDocument();
    expect(within(card).getByText(/From Databases/)).toHaveTextContent("From DatabasesNetwork");
    expect(within(card).getByLabelText("to")).toBeInTheDocument();
    expect(within(card).queryByText("Version 4")).toBeNull();
    expect(within(card).getAllByText("Changed: username")).toHaveLength(2);
  });

  it("names a folder the reader can't see without revealing it", async () => {
    const s = database();
    s.moves.unshift({
      fromFolderId: "mock-folder-bob",
      movedAt: new Date().toISOString(),
      movedBy: "mock-user-bob",
      movedByName: "Bob",
      toFolderId: "mock-folder-databases",
    });
    open();
    const card = await history();
    expect(within(card).getByText(/From a folder you can't see/)).toBeInTheDocument();
  });
});
