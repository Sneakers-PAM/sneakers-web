import { mockState } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as browse from "@/routes/browse";
import * as changeType from "@/routes/resources.change-type";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const routes = [
  {
    action: browse.action,
    Component: browse.default,
    loader: browse.loader,
    path: "/browse/:folderId",
  },
  { action: changeType.action, loader: changeType.loader, path: "/resources/change-type" },
];

const ROUTER = "mock-secret-edge-router";
const LAB = "mock-secret-incomplete-ssh";
const stored = (id: string) => mockState.world.secrets.find((s) => s.id === id);

const pickType = async (user: ReturnType<typeof userEvent.setup>, type: string) => {
  const dialog = await screen.findByRole("dialog");
  await user.click(await within(dialog).findByRole("combobox", { name: /New type/ }));
  await user.click(await screen.findByRole("option", { name: type }));
  await user.click(within(dialog).getByRole("button", { name: "Continue" }));
  return dialog;
};

describe("changing a type from the list", () => {
  it("changes one secret from its row menu, keeping username, password and notes", async () => {
    const user = userEvent.setup();
    const kept = { ...stored(ROUTER)?.fields };
    renderRoute("/browse/mock-folder-network", routes);
    fireEvent.contextMenu(await screen.findByRole("link", { name: "Edge router admin" }));
    await user.click(await screen.findByRole("menuitem", { name: "Change type…" }));
    const dialog = await pickType(user, "Password Account (SSH)");
    await user.type(
      await within(dialog).findByRole("textbox", { name: /Host/ }),
      "router.example.org",
    );
    const confirm = within(dialog).getByRole("button", { name: "Change type" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(stored(ROUTER)?.typeId).toBe("type-unix-ssh");
    expect(stored(ROUTER)?.fields).toEqual({ ...kept, host: "router.example.org" });
  });

  it("runs a selection one at a time, previewing each, and reports each result", async () => {
    const user = userEvent.setup();
    renderRoute("/browse/mock-folder-network", routes);
    await user.click(await screen.findByRole("checkbox", { name: "Select Edge router admin" }));
    await user.click(screen.getByRole("checkbox", { name: "Select Lab switch (incomplete)" }));
    const bar = screen.getByRole("region", { name: "Selected secrets" });
    await user.click(within(bar).getByRole("button", { name: "Change type…" }));
    const dialog = await pickType(user, "Password Account (SSH)");

    expect(await within(dialog).findByText(/1 of 2/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Edge router admin");
    await user.type(
      await within(dialog).findByRole("textbox", { name: /Host/ }),
      "router.example.org",
    );
    const confirm = within(dialog).getByRole("button", { name: "Change type" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(await within(dialog).findByText(/2 of 2/)).toBeInTheDocument();
    expect(dialog).toHaveTextContent("Lab switch (incomplete)");
    await within(dialog).findByRole("table", { name: "Where each field goes" });
    await user.click(within(dialog).getByRole("button", { name: "Skip" }));

    const results = await within(dialog).findByRole("table", { name: "Results" });
    expect(within(results).getByRole("row", { name: /Edge router admin/ })).toHaveTextContent(
      "Changed",
    );
    expect(within(results).getByRole("row", { name: /Lab switch/ })).toHaveTextContent("Skipped");
    expect(stored(ROUTER)?.typeId).toBe("type-unix-ssh");
    expect(stored(LAB)?.typeId).toBe("type-password");
  });
});
