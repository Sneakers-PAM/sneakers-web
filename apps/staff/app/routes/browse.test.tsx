import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import * as browse from "@/routes/browse";
import * as stepUpRoute from "@/routes/resources.step-up";
import * as secret from "@/routes/secret";
import { renderRoute, type StubRoute } from "@/test/routeStub";

withMockGateway();

const page = {
  action: browse.action,
  Component: browse.default,
  ErrorBoundary: browse.ErrorBoundary,
  loader: browse.loader,
};

const ROUTES = [
  { ...page, id: "routes/browse", path: "/browse" },
  { ...page, id: "routes/browse-folder", path: "/browse/:folderId" },
  { action: secret.action, loader: secret.loader, path: "/secret/:id" },
  { action: stepUpRoute.action, path: "/resources/step-up" },
] as StubRoute[];

const open = (url: string, user?: string) => renderRoute(url, ROUTES, { user });

const folder = (id: string) => mockState.world.folders.find((f) => f.id === id);

const folderMenu = async (item: string) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Folder actions" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
  return user;
};

describe("the browse page", () => {
  it("lists a folder's secrets, linking each to its page", async () => {
    open("/browse/mock-folder-databases");
    expect(await screen.findByRole("heading", { name: "Databases" })).toBeInTheDocument();
    expect(screen.getByText("Secret · Platform")).toBeInTheDocument();
    expect(screen.getByText("2 secrets · shared folder")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "DB admin" })).toHaveAttribute(
      "href",
      "/secret/mock-secret-db-admin",
    );
    expect(screen.getByRole("link", { name: "Share" })).toHaveAttribute(
      "href",
      "/folder/mock-folder-databases/sharing",
    );
    const row = screen.getByRole("row", { name: /Reporting reader/ });
    expect(within(row).getByText("Database Account")).toBeInTheDocument();
    expect(within(row).getByText("Unknown")).toBeInTheDocument();
  });

  it("shows a secret the user can't read as locked, with a way to ask for it", async () => {
    open("/browse/mock-folder-databases", "mock-user-bob");
    const row = await screen.findByRole("row", { name: /Reporting reader/ });
    expect(within(row).getByText("Locked")).toBeInTheDocument();
    expect(within(row).queryByRole("link", { name: "Reporting reader" })).toBeNull();
    expect(within(row).getByRole("link", { name: "Request access" })).toHaveAttribute(
      "href",
      "/requests?new=mock-secret-db-reporting",
    );
  });

  it("never treats an unknown read answer as readable", async () => {
    // The mock always knows the answer, so stand in for a gateway that doesn't.
    server.use(
      graphql.link(`${MOCK_GATEWAY_URL}/graphql`).query("BrowseSecrets", () =>
        HttpResponse.json({
          data: {
            secretsInFolder: mockState.world.secrets
              .filter((s) => s.folderId === "mock-folder-databases" && !s.retired)
              .map((s) => ({
                canRead: s.id === "mock-secret-db-admin" ? null : true,
                folderId: s.folderId,
                id: s.id,
                lastHeartbeatResult: s.lastHeartbeatResult ?? null,
                name: s.name,
                retired: s.retired,
                retiredAt: s.retiredAt ?? null,
                targetId: s.targetId ?? null,
                typeId: s.typeId,
              })),
            secretTypes: mockState.world.secretTypes.map(({ fields, id, name }) => ({
              fields,
              id,
              name,
            })),
          },
        }),
      ),
    );
    open("/browse/mock-folder-databases");
    const row = await screen.findByRole("row", { name: /DB admin/ });
    expect(within(row).getByText("Access unknown")).toBeInTheDocument();
    expect(within(row).queryByRole("link", { name: "DB admin" })).toBeNull();
  });

  it("asks for a folder when none is open", async () => {
    open("/browse");
    expect(await screen.findByText("Pick a folder")).toBeInTheDocument();
  });

  it("says when there are no folders at all, with the check-icon empty state", async () => {
    mockState.world.folders = [];
    open("/browse");
    expect(await screen.findByText("No folders yet")).toBeInTheDocument();
    expect(
      screen.getByText(/appears once you create your first secret or folder/),
    ).toBeInTheDocument();
    // The /requests "nothing to approve" pattern: a check icon, not the sneaker-loader mark a
    // generic EmptyState shows, which this page isn't actually waiting on anything for.
    expect(screen.queryByRole("img", { name: "Sneakers-PAM" })).not.toBeInTheDocument();
  });

  it("says when a folder holds no secrets", async () => {
    open("/browse/mock-folder-alice");
    expect(await screen.findByText("No secrets here yet")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "New secret" })) {
      expect(link).toHaveAttribute("href", "/secret/new?folderId=mock-folder-alice");
    }
  });

  it("explains a folder the user can't open, naming its owner", async () => {
    open("/browse/mock-folder-finance", "mock-user-dave");
    expect(await screen.findByText("You can't open this folder")).toBeInTheDocument();
    expect(screen.getByText(/Bob owns it/)).toBeInTheDocument();
    expect(screen.queryByText("Payroll portal")).not.toBeInTheDocument();
  });

  it("answers not found for someone else's personal folder", async () => {
    open("/browse/mock-folder-bob");
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
  });

  it("offers Retry when the gateway fails, and recovers", async () => {
    server.use(
      graphql
        .link(`${MOCK_GATEWAY_URL}/graphql`)
        .query("BrowseFolders", () => HttpResponse.json({}, { status: 500 }), { once: true }),
    );
    open("/browse/mock-folder-databases");
    expect(await screen.findByText("This folder didn't load")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Databases" })).toBeInTheDocument();
  });

  it("filters, shows retired secrets on request and restores one", async () => {
    const user = userEvent.setup();
    open("/browse/mock-folder-archive", "mock-user-bob");
    expect(await screen.findByText("No secrets here yet")).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Show retired" }));
    const row = await screen.findByRole("row", { name: /Legacy portal/ });
    expect(within(row).getByText("Retired")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(
        mockState.world.secrets.find((s) => s.id === "mock-secret-legacy-portal")?.retired,
      ).toBe(false),
    );
  });

  it("filters the list by name", async () => {
    const user = userEvent.setup();
    open("/browse/mock-folder-databases");
    await screen.findByRole("heading", { name: "Databases" });
    await user.type(screen.getByRole("searchbox", { name: "Filter secrets" }), "report");
    expect(screen.queryByRole("link", { name: "DB admin" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reporting reader" })).toBeInTheDocument();
  });

  it("quick-copies a row's username and password straight from the grid, audited", async () => {
    const user = userEvent.setup();
    open("/browse/mock-folder-databases");
    const row = await screen.findByRole("row", { name: /DB admin/ });
    await user.click(within(row).getByRole("button", { name: "Copy Username for DB admin" }));
    await vi.waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe("postgres_admin"),
    );
    await user.click(within(row).getByRole("button", { name: "Copy Password for DB admin" }));
    await vi.waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe("mock-Tongue-Eyelet-91"),
    );
  });

  it("offers the same quick copies in the row's context menu", async () => {
    const user = userEvent.setup();
    open("/browse/mock-folder-databases");
    const row = await screen.findByRole("row", { name: /DB admin/ });
    await user.pointer({ keys: "[MouseRight]", target: row });
    await user.click(await screen.findByRole("menuitem", { name: "Copy Password" }));
    await vi.waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe("mock-Tongue-Eyelet-91"),
    );
  });

  it("asks for a fresh second factor before a quick copy where the folder requires one", async () => {
    const databases = folder("mock-folder-databases");
    if (databases) databases.revealStepUp = "require";
    const user = userEvent.setup();
    open("/browse/mock-folder-databases");
    const row = await screen.findByRole("row", { name: /DB admin/ });
    await user.click(within(row).getByRole("button", { name: "Copy Password for DB admin" }));
    const dialog = await screen.findByRole("dialog", { name: "Confirm it's you" });
    expect(dialog).toHaveTextContent("Copying Password needs a fresh second factor.");
    await user.type(within(dialog).getByLabelText("6-digit code"), "123456");
    await vi.waitFor(async () =>
      expect(await navigator.clipboard.readText()).toBe("mock-Tongue-Eyelet-91"),
    );
  });

  it("offers no quick copy for a row the user can't read", async () => {
    open("/browse/mock-folder-databases", "mock-user-bob");
    const row = await screen.findByRole("row", { name: /Reporting reader/ });
    expect(within(row).queryByRole("button", { name: /^Copy /i })).toBeNull();
  });
});

describe("folder operations", () => {
  it("creates a folder inside the open one", async () => {
    open("/browse/mock-folder-platform");
    const user = await folderMenu("New folder…");
    const dialog = await screen.findByRole("dialog", { name: "New folder" });
    expect(within(dialog).getByText("Platform")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Name"), "Staging");
    await user.click(within(dialog).getByRole("button", { name: "Create" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockState.world.folders.find((f) => f.name === "Staging")?.parentId).toBe(
      "mock-folder-platform",
    );
  });

  it("shows the gateway's refusal in the dialog", async () => {
    open("/browse/mock-folder-databases");
    const user = await folderMenu("Rename…");
    const dialog = await screen.findByRole("dialog", { name: "Rename folder" });
    const name = within(dialog).getByLabelText("Name");
    await user.clear(name);
    await user.type(name, "Network");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText(/already exists/)).toBeInTheDocument();
    expect(folder("mock-folder-databases")?.name).toBe("Databases");
  });

  it("hides folder changes from people who don't own the folder", async () => {
    open("/browse/mock-folder-databases", "mock-user-dave");
    expect(await screen.findByText("You can't open this folder")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Folder actions" })).not.toBeInTheDocument();
  });

  it("offers only folders the user manages as move destinations", async () => {
    open("/browse/mock-folder-archive", "mock-user-bob");
    await folderMenu("Move…");
    const dialog = await screen.findByRole("dialog", { name: "Move Archive" });
    expect(within(dialog).queryByRole("radio", { name: /Platform/ })).not.toBeInTheDocument();
  });

  it("moves a folder to another one the user manages", async () => {
    open("/browse/mock-folder-databases");
    const user = await folderMenu("Move…");
    const dialog = await screen.findByRole("dialog", { name: "Move Databases" });
    expect(
      within(dialog).getByRole("radio", { name: /Platform \/ Databases \(this folder\)/ }),
    ).toBeDisabled();
    // Alice is a site admin, so every shared folder is a destination for her.
    expect(within(dialog).getByRole("radio", { name: "Finance" })).toBeEnabled();
    await user.click(within(dialog).getByRole("radio", { name: "Platform / Network" }));
    await user.click(within(dialog).getByRole("button", { name: "Move here" }));
    await waitFor(() =>
      expect(folder("mock-folder-databases")?.parentId).toBe("mock-folder-network"),
    );
  });

  it("confirms before a personal folder moves into a shared one", async () => {
    open("/browse/mock-folder-alice-lab");
    const user = await folderMenu("Move…");
    await user.click(await screen.findByRole("radio", { name: "Platform / Network" }));
    await user.click(screen.getByRole("button", { name: "Move here" }));
    const confirm = await screen.findByRole("dialog", { name: "Share this folder?" });
    expect(
      within(confirm).getByText(/Once shared, the owner rules of Platform \/ Network apply/),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Share & move" }));
    await waitFor(() =>
      expect(folder("mock-folder-alice-lab")).toMatchObject({
        parentId: "mock-folder-network",
        scope: "group",
      }),
    );
  });

  it("files a request when a shared folder moves into a personal one", async () => {
    open("/browse/mock-folder-archive", "mock-user-bob");
    const user = await folderMenu("Move…");
    await user.click(await screen.findByRole("radio", { name: "Personal · My secrets" }));
    await user.click(screen.getByRole("button", { name: "Move here" }));
    const ask = await screen.findByRole("dialog", {
      name: "Ask to move this to your personal folder",
    });
    const submit = within(ask).getByRole("button", { name: "Submit request" });
    expect(submit).toBeDisabled();
    await user.type(within(ask).getByLabelText(/Reason/), "Only my old logins.");
    await user.click(submit);
    await waitFor(() =>
      expect(mockState.world.requests.at(-1)).toMatchObject({
        folderId: "mock-folder-archive",
        kind: "folder_move",
        status: "pending",
      }),
    );
    expect(folder("mock-folder-archive")?.parentId).toBe("mock-folder-finance");
  });

  it("deletes a folder that holds secrets by moving them first", async () => {
    open("/browse/mock-folder-databases");
    const user = await folderMenu("Delete…");
    const dialog = await screen.findByRole("dialog", { name: "Delete Platform / Databases?" });
    expect(within(dialog).getByText(/It still holds 2 secrets/)).toBeInTheDocument();
    const go = within(dialog).getByRole("button", { name: "Move 2 & delete folder" });
    expect(go).toBeDisabled();
    await user.click(within(dialog).getByRole("combobox", { name: /Move contents to/ }));
    await user.click(await screen.findByRole("option", { name: "Platform" }));
    expect(within(dialog).getByText("Sharing changes for the moved secrets")).toBeInTheDocument();
    await user.click(go);
    expect(await screen.findByRole("heading", { name: "Platform" })).toBeInTheDocument();
    expect(folder("mock-folder-databases")).toBeUndefined();
    expect(screen.getByRole("link", { name: "DB admin" })).toBeInTheDocument();
  });

  it("reorders a folder among its siblings", async () => {
    open("/browse/mock-folder-databases");
    await folderMenu("Move down");
    await waitFor(() => expect(folder("mock-folder-network")?.order).toBe(0));
    expect(folder("mock-folder-databases")?.order).toBe(1);
  });
});

describe("secret moves", () => {
  it("moves selected secrets from the bulk bar", async () => {
    const user = userEvent.setup();
    open("/browse/mock-folder-databases");
    await user.click(await screen.findByRole("checkbox", { name: "Select DB admin" }));
    expect(screen.getByText("1 secret selected")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Move…" }));
    const dialog = await screen.findByRole("dialog", { name: "Move 1 secret" });
    await user.click(within(dialog).getByRole("radio", { name: "Platform / Network" }));
    await user.click(within(dialog).getByRole("button", { name: "Move here" }));
    await waitFor(() =>
      expect(mockState.world.secrets.find((s) => s.id === "mock-secret-db-admin")?.folderId).toBe(
        "mock-folder-network",
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole("link", { name: "DB admin" })).not.toBeInTheDocument(),
    );
  });

  it("asks a site admin before a shared secret moves into a personal folder", async () => {
    const user = userEvent.setup();
    open("/browse/mock-folder-finance", "mock-user-bob");
    await user.click(await screen.findByRole("checkbox", { name: "Select Payroll portal" }));
    await user.click(screen.getByRole("button", { name: "Move…" }));
    await user.click(await screen.findByRole("radio", { name: "Personal · My secrets" }));
    await user.click(screen.getByRole("button", { name: "Move here" }));
    const ask = await screen.findByRole("dialog", {
      name: "Ask to move this to your personal folder",
    });
    await user.type(within(ask).getByLabelText(/Reason/), "Saved here by mistake.");
    await user.click(within(ask).getByRole("button", { name: "Submit request" }));
    await waitFor(() =>
      expect(mockState.world.requests.at(-1)).toMatchObject({
        kind: "secret_move",
        secretId: "mock-secret-payroll",
      }),
    );
  });
});
