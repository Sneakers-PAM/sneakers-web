import { mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "react-router";

import * as edit from "@/routes/secret.edit";
import * as create from "@/routes/secret.new";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const Landed = () => <h1>Landed on {useParams().id}</h1>;

const routes = [
  { action: edit.action, Component: edit.default, loader: edit.loader, path: "/secret/:id/edit" },
  { action: create.action, Component: create.default, loader: create.loader, path: "/secret/new" },
  { Component: Landed, path: "/secret/:id" },
];

type User = ReturnType<typeof userEvent.setup>;

const secret = (id: string) => mockState.world.secrets.find((s) => s.id === id);

const pickFolder = async (user: User, name: RegExp | string) => {
  await user.click(screen.getByRole("combobox", { name: /Folder/ }));
  await user.click(await screen.findByRole("option", { name }));
};

describe("moving a secret from the edit form", () => {
  it("moves it straight away between shared folders the user manages", async () => {
    const user = userEvent.setup();
    renderRoute("/secret/mock-secret-db-admin/edit", routes);
    await screen.findByRole("heading", { level: 1, name: "Edit DB admin" });
    await pickFolder(user, "Platform / Network");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(
      await screen.findByRole("heading", { name: "Landed on mock-secret-db-admin" }),
    ).toBeInTheDocument();
    expect(secret("mock-secret-db-admin")?.folderId).toBe("mock-folder-network");
  });

  it("asks before a personal secret moves into a shared folder", async () => {
    const user = userEvent.setup();
    renderRoute("/secret/mock-secret-alice-wifi/edit", routes);
    await screen.findByRole("heading", { level: 1, name: "Edit Lab wifi" });
    await pickFolder(user, "Platform");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Share this secret?" });
    expect(secret("mock-secret-alice-wifi")?.folderId).toBe("mock-folder-alice-lab");
    await user.click(within(dialog).getByRole("button", { name: "Share and save" }));
    expect(
      await screen.findByRole("heading", { name: "Landed on mock-secret-alice-wifi" }),
    ).toBeInTheDocument();
    expect(secret("mock-secret-alice-wifi")?.folderId).toBe("mock-folder-platform");
  });

  it("files a move request when a shared secret goes into someone's personal folder", async () => {
    const user = userEvent.setup();
    renderRoute("/secret/mock-secret-payroll/edit", routes, { user: "mock-user-bob" });
    await screen.findByRole("heading", { level: 1, name: "Edit Payroll portal" });
    await pickFolder(user, /My secrets/);
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Request a move to a personal folder",
    });
    const submit = within(dialog).getByRole("button", { name: "Send request" });
    expect(submit).toBeDisabled();
    await user.type(
      within(dialog).getByRole("textbox", { name: /Reason/ }),
      "Only I use this login now.",
    );
    await user.click(submit);
    expect(
      await screen.findByRole("heading", { name: "Landed on mock-secret-payroll" }),
    ).toBeInTheDocument();
    expect(secret("mock-secret-payroll")?.folderId).toBe("mock-folder-finance");
    expect(mockState.world.requests.at(-1)).toMatchObject({
      destParentId: "mock-folder-bob",
      kind: "secret_move",
      reason: "Only I use this login now.",
      secretId: "mock-secret-payroll",
    });
  });
});

describe("the key format", () => {
  it("makes a new key pair when the format changes", async () => {
    const user = userEvent.setup();
    renderRoute("/secret/new?folder=mock-folder-platform", routes);
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await user.click(screen.getByRole("combobox", { name: /Type/ }));
    await user.click(await screen.findByRole("option", { name: "SSH Key" }));
    const keys = screen.getByRole("region", { name: "Key pair" });
    const publicKey = () =>
      (within(keys).getByRole("textbox", { name: "Public key" }) as HTMLInputElement).value;
    await user.click(within(keys).getByRole("combobox", { name: "Key format" }));
    await user.click(await screen.findByRole("option", { name: "RSA 2048" }));
    expect(publicKey()).toBe("");
    await user.click(within(keys).getByRole("button", { name: "Generate key pair" }));
    await waitFor(() => expect(publicKey()).toMatch(/^ssh-rsa /));
    const first = publicKey();
    await user.click(within(keys).getByRole("combobox", { name: "Key format" }));
    await user.click(await screen.findByRole("option", { name: "Ed25519" }));
    await waitFor(() => expect(publicKey()).toMatch(/^ssh-ed25519 /));
    expect(publicKey()).not.toBe(first);
  });
});
