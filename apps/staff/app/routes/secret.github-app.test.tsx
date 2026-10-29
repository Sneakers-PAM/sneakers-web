import { mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "react-router";

import { armored } from "@/features/editors/sshKey";
import * as secret from "@/routes/secret";
import * as editor from "@/routes/secret.new";
import { appKeyPem } from "@/test/appKeys";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const Landed = () => <h1>Landed on {useParams().id}</h1>;

const routes = [
  {
    action: editor.action,
    Component: editor.default,
    ErrorBoundary: editor.ErrorBoundary,
    loader: editor.loader,
    path: "/secret/new",
  },
  { Component: Landed, path: "/secret/:id" },
];

type User = ReturnType<typeof userEvent.setup>;

const card = (name: string) => screen.getByRole("region", { name });
const row = (name: string) => screen.getByRole("group", { name });
const pemFile = (text: string, name = "release-bot.2026-10-29.private-key.pem") =>
  new File([text], name, { type: "application/x-pem-file" });

const start = async (user: User) => {
  renderRoute("/secret/new?folder=mock-folder-platform", routes);
  await screen.findByRole("heading", { level: 1, name: "New secret" });
  await user.type(screen.getByRole("textbox", { name: /Name/ }), "Docs bot");
  await user.click(screen.getByRole("combobox", { name: /Type/ }));
  await user.click(await screen.findByRole("option", { name: "GitHub App" }));
};

describe("a new GitHub App secret", () => {
  it("takes the App's .pem file and its details, and creates the secret", async () => {
    const user = userEvent.setup();
    await start(user);
    const app = card("GitHub App");
    await user.type(within(app).getByRole("textbox", { name: /App ID/ }), "2097152");
    await user.type(within(app).getByRole("textbox", { name: /Installation ID/ }), "777");
    await user.type(within(app).getByRole("textbox", { name: /Owner Org/ }), "example-org");
    const credentials = card("Credentials");
    await user.upload(
      within(credentials).getByLabelText(/Drop the App's .pem file/),
      pemFile(appKeyPem()),
    );
    expect(await within(credentials).findByText("RSA 2048-bit private key")).toBeInTheDocument();
    expect(
      within(credentials).getByText(/release-bot\.2026-10-29\.private-key\.pem/),
    ).toBeInTheDocument();
    expect(within(credentials).queryByText(/BEGIN/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create secret" }));
    expect(
      await screen.findByRole("heading", { name: /Landed on mock-secret-/ }),
    ).toBeInTheDocument();
    const secret = mockState.world.secrets.find((s) => s.name === "Docs bot");
    expect(secret?.typeId).toBe("type-github-app");
  });

  it("says an id takes digits as soon as it's typed", async () => {
    const user = userEvent.setup();
    await start(user);
    await user.type(
      within(card("GitHub App")).getByRole("textbox", { name: /App ID/ }),
      "docs-bot",
    );
    expect(await within(card("GitHub App")).findByText("Use digits only.")).toBeInTheDocument();
  });

  it("refuses a file that isn't the App's key, and takes a pasted one instead", async () => {
    const user = userEvent.setup();
    await start(user);
    const credentials = card("Credentials");
    await user.upload(
      within(credentials).getByLabelText(/Drop the App's .pem file/),
      pemFile(armored("OPENSSH PRIVATE KEY", "TW9jaw=="), "id_ed25519"),
    );
    expect(await within(credentials).findByRole("alert")).toHaveTextContent(
      "That's an SSH key. Use the .pem file GitHub downloaded for the App.",
    );
    await user.click(within(credentials).getByRole("button", { name: "Paste the key instead" }));
    const box = within(credentials).getByRole("textbox", { name: /Private Key/ });
    await user.clear(box);
    await user.click(box);
    await user.paste(appKeyPem(4096));
    expect(within(credentials).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the missing App ID, owner and key on save", async () => {
    const user = userEvent.setup();
    await start(user);
    await user.click(screen.getByRole("button", { name: "Create secret" }));
    expect(await screen.findByText(/3 fields need attention/)).toBeInTheDocument();
    expect(screen.getByText("Enter the private key (pem).")).toBeInTheDocument();
  });
});

describe("a GitHub App secret's page", () => {
  const page = {
    action: secret.action,
    Component: secret.default,
    ErrorBoundary: secret.ErrorBoundary,
    loader: secret.loader,
    path: "/secret/:id",
  };
  const show = () => renderRoute("/secret/mock-secret-release-bot", [page]);

  it("shows the App's details at a glance, its key and secrets masked", async () => {
    show();
    expect(
      await screen.findByRole("heading", { level: 1, name: /Release bot/ }),
    ).toBeInTheDocument();
    const app = card("GitHub App");
    for (const value of ["1048576", "52428800", "example-org", "Iv23mockClientId0001"])
      expect(within(app).getByText(value)).toBeInTheDocument();
    for (const name of ["Private Key (PEM)", "Client Secret", "Webhook Secret"])
      expect(within(row(name)).getByRole("button", { name: `Reveal ${name}` })).toBeInTheDocument();
    expect(app).not.toHaveTextContent("mock GitHub App key");
    expect(app).not.toHaveTextContent("mock-webhook-secret");
    const rest = card("Fields");
    expect(
      within(rest).getByText("Opens release PRs and tags in example-org."),
    ).toBeInTheDocument();
    expect(within(rest).queryByText("App ID")).not.toBeInTheDocument();
  });

  it("replaces the private key from a new .pem, keeping the old one in the history", async () => {
    const user = userEvent.setup();
    show();
    await screen.findByRole("heading", { level: 1, name: /Release bot/ });
    const before = mockState.world.secrets.find((s) => s.id === "mock-secret-release-bot")!;
    const versions = before.versions.length;
    await user.click(
      within(card("GitHub App")).getByRole("button", { name: "Replace private key…" }),
    );
    const dialog = await screen.findByRole("dialog", { name: "Replace private key" });
    expect(within(dialog).getByRole("button", { name: "Replace key" })).toBeDisabled();
    const pem = appKeyPem();
    await user.upload(within(dialog).getByLabelText(/Drop the App's .pem file/), pemFile(pem));
    expect(await within(dialog).findByText("RSA 2048-bit private key")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Replace key" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const after = mockState.world.secrets.find((s) => s.id === "mock-secret-release-bot")!;
    expect(after.fields.privateKey).toBe(pem.trim());
    expect(after.fields.appId).toBe("1048576");
    expect(after.versions).toHaveLength(versions + 1);
    expect(after.versions[0]?.changedFieldKeys).toEqual(["privateKey"]);
  });
});
