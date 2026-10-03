import { MOCK_GATEWAY_URL, mockState } from "@sneakers-web/mock-gateway";
import { server, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse } from "msw";
import { graphql } from "msw/graphql";
import { useParams } from "react-router";

import { armored } from "@/features/editors/sshKey";
import * as editor from "@/routes/secret.new";
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

const open = (url = "/secret/new?folder=mock-folder-databases", user?: string) =>
  renderRoute(url, routes, { user });
const card = (name: string) => screen.getByRole("region", { name });
const created = (name: string) => mockState.world.secrets.find((s) => s.name === name);

type User = ReturnType<typeof userEvent.setup>;

const pickType = async (user: User, name: RegExp | string) => {
  await user.click(screen.getByRole("combobox", { name: /Type/ }));
  await user.click(await screen.findByRole("option", { name }));
};

describe("the new secret page", () => {
  it("groups every type by where it comes from, extensions and custom types included", async () => {
    const user = userEvent.setup();
    open();
    expect(
      await screen.findByRole("heading", { level: 1, name: "New secret" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("combobox", { name: /Type/ }));
    const system = await screen.findByRole("group", { name: "System" });
    expect(within(system).getByRole("option", { name: "Database Account" })).toBeInTheDocument();
    const extension = screen.getByRole("group", { name: "Extensions" });
    expect(within(extension).getByRole("option", { name: /Acme Router Admin/ })).toHaveTextContent(
      "Acme",
    );
    expect(within(extension).getByRole("option", { name: /Acme VPN Profile/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Custom" })).getByRole("option", {
        name: "Break-room Door Code",
      }),
    ).toBeInTheDocument();
  });

  it("builds the form from the type, creates the secret and opens it", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    expect(screen.getByText("Secret · Platform / Databases")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Reporting writer");
    await pickType(user, "Database Account");
    const fields = card("Fields");
    await user.type(within(fields).getByRole("textbox", { name: /Server/ }), "db1.example.org");
    await user.type(within(fields).getByRole("textbox", { name: /Username/ }), "report_writer");
    expect((within(fields).getByLabelText(/^Password/) as HTMLInputElement).value).toMatch(
      /.{14,}/,
    );
    await user.click(screen.getByRole("button", { name: "Create secret" }));
    expect(
      await screen.findByRole("heading", { name: /Landed on mock-secret-/ }),
    ).toBeInTheDocument();
    expect(created("Reporting writer")).toMatchObject({
      folderId: "mock-folder-databases",
      typeId: "type-database-account",
    });
  });

  it("names every field that needs attention before anything is sent", async () => {
    const user = userEvent.setup();
    const before = mockState.world.secrets.length;
    open();
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await pickType(user, "Database Account");
    await user.clear(within(card("Fields")).getByLabelText(/^Password/));
    await user.click(screen.getByRole("button", { name: "Create secret" }));
    const banner = await screen.findByRole("region", { name: "Fields that need attention" });
    expect(banner).toHaveTextContent("Name is required");
    expect(banner).toHaveTextContent("Server is required");
    expect(within(card("Fields")).getByText("Enter the server.")).toBeInTheDocument();
    expect(mockState.world.secrets).toHaveLength(before);
  });

  it("holds a strict policy field to its policy, and regenerates to it", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await pickType(user, "Break-room Door Code");
    const fields = card("Fields");
    expect(within(fields).getByText(/PIN policy, strict/)).toBeInTheDocument();
    const code = within(fields).getByLabelText(/^Code/);
    await user.clear(code);
    await user.type(code, "12");
    const chips = within(fields).getByRole("list", { name: "Must contain" });
    expect(within(chips).getByText("6+ characters")).toHaveAttribute("data-met", "false");
    await user.click(within(fields).getByRole("button", { name: /Regenerate/ }));
    expect(within(chips).getByText("6+ characters")).toHaveAttribute("data-met", "true");
    expect((code as HTMLInputElement).value).toMatch(/^\d{6,8}$/);
  });

  it("generates an SSH key pair and keeps the private key out of sight", async () => {
    const user = userEvent.setup();
    open("/secret/new?folder=mock-folder-platform");
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await pickType(user, "SSH Key");
    const keys = card("Key pair");
    await user.click(within(keys).getByRole("button", { name: "Generate key pair" }));
    expect(await within(keys).findByDisplayValue(/^ssh-ed25519 /)).toBeInTheDocument();
    expect(within(keys).getByText(/Private key generated/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("BEGIN OPENSSH PRIVATE KEY");
  });

  it("checks an imported key: the passphrase of an encrypted key, and that the halves match", async () => {
    const user = userEvent.setup();
    open("/secret/new?folder=mock-folder-platform");
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await pickType(user, "SSH Key");
    await user.click(within(card("Key pair")).getByRole("button", { name: /Import existing key/ }));
    const dialog = await screen.findByRole("dialog", { name: "Import SSH key" });
    await user.click(within(dialog).getByRole("textbox", { name: /Private key/ }));
    await user.paste(armored("ENCRYPTED PRIVATE KEY", "TW9jaw=="));
    await user.click(within(dialog).getByRole("button", { name: "Import" }));
    expect(
      await within(dialog).findByText("This key is encrypted. Enter its passphrase."),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Passphrase/), "mock-passphrase");
    await user.click(within(dialog).getByRole("button", { name: "Import" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(card("Key pair")).getByText(/Private key imported/)).toBeInTheDocument();
  });

  it("makes a personal target inline and picks it", async () => {
    const user = userEvent.setup();
    open();
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await pickType(user, "Database Account");
    await user.click(screen.getByRole("button", { name: "New target" }));
    const dialog = await screen.findByRole("dialog", { name: "New target" });
    await user.type(within(dialog).getByRole("textbox", { name: /Name/ }), "reports-db");
    await user.type(
      within(dialog).getByRole("textbox", { name: /Hostname/ }),
      "reports.example.org",
    );
    await user.click(within(dialog).getByRole("button", { name: "Create target" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("combobox", { name: /Target/ })).toHaveTextContent("reports-db");
  });

  it("imports a certificate from a file", async () => {
    const user = userEvent.setup();
    open("/secret/new?folder=mock-folder-certificates");
    await screen.findByRole("heading", { level: 1, name: "New secret" });
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "api.example.org");
    await pickType(user, /SSL\/PKI Certificate/);
    const file = new File(
      ["-----BEGIN CERTIFICATE-----\nmock\n-----END CERTIFICATE-----"],
      "api.pem",
      { type: "application/x-pem-file" },
    );
    await user.upload(within(card("Certificate")).getByLabelText(/Certificate file/), file);
    await user.click(screen.getByRole("button", { name: "Import certificate" }));
    expect(
      await screen.findByRole("heading", { name: /Landed on mock-secret-/ }),
    ).toBeInTheDocument();
    expect(created("api.example.org")?.typeId).toBe("type-ssl-cert");
  });

  it("says so when there's no folder the person can add to", async () => {
    open("/secret/new", "mock-user-erin");
    expect(await screen.findByText("There's nowhere you can add a secret yet")).toBeInTheDocument();
  });

  it("offers Retry when the form couldn't load", async () => {
    let fail = true;
    server.use(
      graphql.link(`${MOCK_GATEWAY_URL}/graphql`).query("EditorsPickers", () =>
        fail
          ? HttpResponse.json({
              errors: [{ extensions: { code: "UNAVAILABLE" }, message: "down" }],
            })
          : undefined,
      ),
    );
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Couldn't load the form")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "New secret" }),
    ).toBeInTheDocument();
  });
});
