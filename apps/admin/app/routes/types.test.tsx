import { mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as types from "@/routes/types";
import * as type from "@/routes/types.$id";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: types, path: "/types" },
  { module: type, path: "/types/new" },
  { module: type, path: "/types/:id" },
];

describe("secret types", () => {
  it("lists types with their source and capabilities", async () => {
    renderAdmin(ROUTES, "/types");
    const database = await screen.findByRole("row", { name: /Active Directory Account/ });
    expect(within(database).getByText("Built-in")).toBeInTheDocument();
    expect(within(database).getByText("Checkout")).toBeInTheDocument();
    expect(within(database).queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    const acme = screen.getByRole("row", { name: /Acme VPN Profile/ });
    expect(within(acme).getByText("Extension · Acme")).toBeInTheDocument();
  });

  it("refuses to delete a type secrets use, with the count", async () => {
    // Put three of the world's secrets on the custom type, as if they'd been made with it.
    for (const secret of mockState.world.secrets.slice(0, 3)) secret.typeId = "type-door-code";
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/types");
    await user.click(await screen.findByRole("button", { name: "Delete Break-room Door Code" }));
    expect(await screen.findByText("3 secrets use this type")).toBeInTheDocument();
  });

  it("installs a pack and rejects broken pasted JSON", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/types");
    await user.click(await screen.findByRole("button", { name: "Import extension pack…" }));
    await user.click(screen.getByRole("button", { name: "Install Generic IoT" }));
    expect(await screen.findByText("Installed Generic IoT.")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: "Install Generic IoT" })).not.toBeInTheDocument(),
    );
    await user.type(screen.getByLabelText("Or paste a pack"), '{{"name": "x"');
    expect(screen.getByRole("alert")).toHaveTextContent(/^Invalid JSON at line 1/);
    expect(screen.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  it("clones a built-in type into an editable copy", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/types");
    await user.click(await screen.findByRole("button", { name: "Clone SSH Key" }));
    // Clone, then the list reloads, then the editor loads: allow for a loaded test run.
    expect(
      await screen.findByRole("button", { name: "Save type" }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Type name/)).toHaveValue("SSH Key (copy)");
  });

  it("explains what checkout means for an MCP agent", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/types/type-password");
    await user.click(
      await screen.findByRole("button", { name: "What checkout means for an MCP agent" }),
    );
    expect(
      screen.getByText(/An MCP agent must check this secret out before it can reveal/),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "How approvals work" })).toHaveAttribute(
      "href",
      "/agents#how-approvals-work",
    );
  });

  it("shows a built-in type read-only", async () => {
    renderAdmin(ROUTES, "/types/type-password");
    expect(await screen.findByText(/can't be changed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save type" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Field 1 label")).toBeDisabled();
  });

  it("builds a new type: names a missing label, then saves", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/types/new");
    await user.type(await screen.findByLabelText(/Type name/), "Alarm Panel");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await user.click(screen.getByRole("button", { name: "Save type" }));
    expect(await screen.findByText("Field 1 needs a label.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Field 1 label"), "Code");
    await user.click(screen.getByRole("button", { name: "Add field" }));
    await user.type(screen.getByLabelText("Field 2 label"), "Zone");
    await user.click(screen.getByRole("button", { name: "Move field 2 up" }));
    expect(screen.getByLabelText("Field 1 label")).toHaveValue("Zone");
    await user.click(screen.getByRole("button", { name: "Save type" }));
    expect(await screen.findByRole("link", { name: "Alarm Panel" })).toBeInTheDocument();
  });
});
