import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";

import * as sharing from "@/routes/sharing";
import { renderRoute, type StubRoute } from "@/test/routeStub";

withMockGateway();

const page = {
  action: sharing.action,
  Component: sharing.default,
  ErrorBoundary: sharing.ErrorBoundary,
  loader: sharing.loader,
};

const ROUTES = [
  { ...page, id: "routes/sharing", path: "/folder/:id/sharing" },
  { ...page, id: "routes/sharing-secret", path: "/secret/:id/sharing" },
  { Component: () => <h1>Browse page</h1>, path: "/browse/:folderId" },
] as StubRoute[];

const open = (url: string, user?: string) => renderRoute(url, ROUTES, { user });

const DATABASES = "/folder/mock-folder-databases/sharing";

describe("the sharing page", () => {
  it("shows an owner the folder's ruleset to edit, and the simulator", async () => {
    open(DATABASES);
    expect(
      await screen.findByRole("heading", { name: "Platform / Databases" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Sharing · Folder")).toBeInTheDocument();
    expect(
      screen.getByText("2 secrets · rules apply to everything inside, including subfolders"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DB team: Reveal" })).toBeChecked();
    expect(screen.getByRole("heading", { name: "Simulator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("All changes saved.")).toBeInTheDocument();
  });

  it("saves an edit, then shows it saved", async () => {
    open(DATABASES);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "DB team: Approve" }));
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(
        mockState.world.folderRules.find(
          (r) => r.folderId === "mock-folder-databases" && r.subjectId === "mock-group-db",
        )?.grants.A,
      ).toBe("allow"),
    );
    expect(await screen.findByText("All changes saved.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).toBeChecked();
  });

  it("puts the draft back on Discard", async () => {
    open(DATABASES);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Remove Dave" }));
    expect(screen.queryByRole("row", { name: /Dave/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("row", { name: /Dave/ })).toBeInTheDocument();
  });

  it("says why a save was refused, keeping the edits", async () => {
    server.use(
      graphql.link(`${MOCK_GATEWAY_URL}/graphql`).mutation("SharingSetFolderRuleset", () =>
        HttpResponse.json({
          errors: [
            {
              extensions: { code: "PERMISSION_DENIED", reason: "NOT_FOLDER_OWNER" },
              message:
                "rpc error: code = PermissionDenied desc = only the folder's owner can do this",
            },
          ],
        }),
      ),
    );
    open(DATABASES);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "DB team: Approve" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't save.")).toBeInTheDocument();
    expect(
      within(alert).getByText(/Only an owner of this folder can do that./),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).toBeChecked();
  });

  it("simulates a person against the unsaved draft", async () => {
    open(DATABASES);
    const user = userEvent.setup();
    await screen.findByRole("heading", { name: "Simulator" });
    await user.click(screen.getByRole("button", { name: "Pick a person" }));
    await user.type(screen.getByPlaceholderText("Search people"), "dav");
    await user.click(await screen.findByRole("option", { name: /Dave/ }));
    expect(await screen.findByText("Reveal · No")).toBeInTheDocument();
    expect(screen.getByText("Informed · Yes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Dave" }));
    expect(await screen.findByText("Reveal · Yes")).toBeInTheDocument();
  });

  it("shows a reader who doesn't own it everything, view-only, without the simulator", async () => {
    open(DATABASES, "mock-user-bob");
    expect(await screen.findByText(/Only owners manage sharing\./)).toBeInTheDocument();
    expect(screen.getByText(/Alice and Carol are the owners\./)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DB team: Reveal" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Simulator" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
  });

  it("tells someone who can't read the folder who to ask", async () => {
    open(DATABASES, "mock-user-dave");
    expect(
      await screen.findByRole("heading", { name: "You don't have access to manage this folder" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ask Alice or Carol/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to folder" })).toHaveAttribute(
      "href",
      "/browse/mock-folder-databases",
    );
  });

  it("shares a secret without owners, with its folders' rules inherited", async () => {
    open("/secret/mock-secret-db-admin/sharing");
    expect(await screen.findByRole("heading", { name: "DB admin" })).toBeInTheDocument();
    expect(screen.getByText("Sharing · Secret")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Owners" })).toBeNull();
    expect(screen.getByRole("region", { name: "Inherited from Databases" })).toBeInTheDocument();
  });

  it("offers someone who can't read a secret a way to ask for it", async () => {
    mockState.world.secretRules.unshift({
      grants: { C: "deny", I: "deny", R: "deny" },
      id: "mock-rule-test",
      secretId: "mock-secret-db-admin",
      subjectKind: "user",
      subjectName: "mock-user-bob",
    });
    open("/secret/mock-secret-db-admin/sharing", "mock-user-bob");
    expect(
      await screen.findByRole("heading", { name: "You don't have access to manage this secret" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request access" })).toHaveAttribute(
      "href",
      "/requests?new=mock-secret-db-admin",
    );
  });

  it("says when the folder doesn't exist", async () => {
    open("/folder/mock-folder-nope/sharing");
    expect(await screen.findByText("Folder not found")).toBeInTheDocument();
  });

  it("offers Retry when the page didn't load", async () => {
    server.use(
      graphql
        .link(`${MOCK_GATEWAY_URL}/graphql`)
        .query("SharingFolderRuleset", () => HttpResponse.json({}, { status: 500 }), {
          once: true,
        }),
    );
    open(DATABASES);
    expect(await screen.findByText("Couldn't load sharing")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { name: "Platform / Databases" }),
    ).toBeInTheDocument();
  });

  it("asks before leaving with unsaved changes", async () => {
    open(DATABASES);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "DB team: Approve" }));
    await user.click(screen.getByRole("link", { name: "Back" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Leave without saving?" });
    await user.click(within(dialog).getByRole("button", { name: "Stay" }));
    expect(screen.getByRole("heading", { name: "Platform / Databases" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Back" }));
    await user.click(await screen.findByRole("button", { name: "Leave" }));
    expect(await screen.findByRole("heading", { name: "Browse page" })).toBeInTheDocument();
  });
});
