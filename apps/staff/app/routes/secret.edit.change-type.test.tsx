import { mockState } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as changeType from "@/routes/resources.change-type";
import * as editor from "@/routes/secret.edit";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const routes = [
  {
    action: editor.action,
    Component: editor.default,
    loader: editor.loader,
    path: "/secret/:id/edit",
  },
  { action: changeType.action, loader: changeType.loader, path: "/resources/change-type" },
];

const ROUTER = "mock-secret-edge-router";
const DB = "mock-secret-db-admin";
const stored = (id: string) => mockState.world.secrets.find((s) => s.id === id);

const startChange = async (user: ReturnType<typeof userEvent.setup>, type: string) => {
  await user.click(await screen.findByRole("button", { name: "Change type…" }));
  const dialog = await screen.findByRole("dialog");
  await user.click(await within(dialog).findByRole("combobox", { name: /New type/ }));
  await user.click(await screen.findByRole("option", { name: type }));
  await user.click(within(dialog).getByRole("button", { name: "Continue" }));
  return dialog;
};

describe("changing a secret's type from the edit form", () => {
  it("previews, asks for the new required field, and keeps username, password and notes", async () => {
    const user = userEvent.setup();
    const kept = { ...stored(ROUTER)?.fields };
    renderRoute(`/secret/${ROUTER}/edit`, routes);
    const dialog = await startChange(user, "Password Account (SSH)");

    const table = await within(dialog).findByRole("table", { name: "Where each field goes" });
    for (const label of ["Username", "Password", "Notes"]) {
      const row = within(table).getByRole("row", { name: new RegExp(`^${label} `) });
      expect(row).toHaveTextContent("Carried over");
    }
    expect(within(dialog).getByText("Rotation")).toBeInTheDocument();
    expect(within(dialog).getByText("Heartbeat")).toBeInTheDocument();
    expect(within(dialog).getByText("Target")).toBeInTheDocument();
    expect(dialog).not.toHaveTextContent("mock-Vamp-Collar-63");
    expect(dialog).not.toHaveTextContent("Console only.");

    const confirm = within(dialog).getByRole("button", { name: "Change type" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox", { name: /Host/ }), "router.example.org");
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(stored(ROUTER)?.typeId).toBe("type-unix-ssh");
    expect(stored(ROUTER)?.fields).toEqual({ ...kept, host: "router.example.org" });
    expect(await screen.findByRole("textbox", { name: /Host/ })).toHaveValue("router.example.org");
  });

  it("blocks a lossy change naming the field, until the person says where it goes", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${DB}/edit`, routes);
    const dialog = await startChange(user, "API Token");

    const refused = await within(dialog).findByRole("alert");
    expect(refused).toHaveTextContent("Password");
    const row = within(dialog).getByRole("row", { name: /^Password / });
    expect(row).toHaveTextContent("Blocked");
    expect(within(dialog).getByRole("row", { name: /^Username / })).toHaveTextContent(
      "Moved to notes",
    );
    const confirm = within(dialog).getByRole("button", { name: "Change type" });
    expect(confirm).toBeDisabled();

    await user.click(within(row).getByRole("combobox", { name: "Where Password goes" }));
    await user.click(await screen.findByRole("option", { name: "Token" }));
    await waitFor(() => expect(confirm).toBeEnabled());
    expect(within(dialog).queryByRole("alert")).not.toBeInTheDocument();
    await user.click(confirm);

    await waitFor(() => expect(stored(DB)?.typeId).toBe("type-api-token"));
    expect(stored(DB)?.fields.token).toBe("mock-Tongue-Eyelet-91");
    expect(stored(DB)?.fields.notes).toContain("[moved from username]");
  });

  it("leaves the secret alone when the person cancels", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${DB}/edit`, routes);
    const dialog = await startChange(user, "API Token");
    await within(dialog).findByRole("table", { name: "Where each field goes" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(stored(DB)?.typeId).toBe("type-database-account");
  });

  it("names the refusal when the person can't change it", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${DB}/edit`, routes, { user: "mock-user-bob" });
    const dialog = await startChange(user, "API Token");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "You don't have permission to do that.",
    );
    expect(within(dialog).getByRole("button", { name: "Change type" })).toBeDisabled();
  });
});
