import { mockState } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as browse from "@/routes/browse";
import * as changeType from "@/routes/secret.change-type";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const routes = [
  {
    action: browse.action,
    Component: browse.default,
    loader: browse.loader,
    path: "/browse/:folderId",
  },
  {
    action: changeType.action,
    Component: changeType.default,
    loader: changeType.loader,
    path: "/secret/:id/change-type",
  },
];

const ROUTER = "mock-secret-edge-router";
const LAB = "mock-secret-incomplete-ssh";
const stored = (id: string) => mockState.world.secrets.find((s) => s.id === id);

const pickType = async (user: ReturnType<typeof userEvent.setup>, type: string) => {
  await user.click(await screen.findByRole("combobox", { name: /New type/ }));
  await user.click(
    await screen.findByRole("option", {
      name: new RegExp(`^${type.replaceAll(/[()]/g, String.raw`\$&`)}`),
    }),
  );
};

const lineUpAndReview = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByRole("textbox", { name: /Host/ }), "router.example.org");
  const next = screen.getByRole("button", { name: "Next: review" });
  await waitFor(() => expect(next).toBeEnabled());
  await user.click(next);
  const confirm = screen.getByRole("button", { name: "Change type" });
  await waitFor(() => expect(confirm).toBeEnabled());
  await user.click(confirm);
};

describe("changing a type from the list", () => {
  it("changes one secret from its row menu, keeping username, password and notes", async () => {
    const user = userEvent.setup();
    const kept = { ...stored(ROUTER)?.fields };
    renderRoute("/browse/mock-folder-network", routes);
    fireEvent.contextMenu(await screen.findByRole("link", { name: "Edge router admin" }));
    await user.click(await screen.findByRole("menuitem", { name: "Change type…" }));
    await pickType(user, "Password Account (SSH)");
    await lineUpAndReview(user);
    // Back on the list it came from.
    expect(await screen.findByRole("link", { name: "Edge router admin" })).toBeInTheDocument();
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
    await pickType(user, "Password Account (SSH)");

    expect(await screen.findByText(/Secret 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText("Edge router admin")).toBeInTheDocument();
    await lineUpAndReview(user);

    expect(await screen.findByText(/Secret 2 of 2/)).toBeInTheDocument();
    expect(screen.getByText("Lab switch (incomplete)")).toBeInTheDocument();
    await screen.findByRole("region", { name: "Check" });
    await user.click(screen.getByRole("button", { name: "Skip" }));

    const results = await screen.findByRole("table", { name: "Results" });
    expect(within(results).getByRole("row", { name: /Edge router admin/ })).toHaveTextContent(
      "Changed",
    );
    expect(within(results).getByRole("row", { name: /Lab switch/ })).toHaveTextContent("Skipped");
    expect(stored(ROUTER)?.typeId).toBe("type-unix-ssh");
    expect(stored(LAB)?.typeId).toBe("type-password");
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(await screen.findByRole("link", { name: "Edge router admin" })).toBeInTheDocument();
  });
});
