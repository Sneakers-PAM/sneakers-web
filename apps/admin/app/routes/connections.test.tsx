import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as connections from "@/routes/connections";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [{ module: connections, path: "/connections" }];

describe("connections", () => {
  it("shows each connection with how many targets use it", async () => {
    renderAdmin(ROUTES, "/connections");
    const ssh = await screen.findByRole("form", { name: "Connection SSH" });
    expect(within(ssh).getByText("Used by 2 targets")).toBeInTheDocument();
    expect(within(ssh).getByLabelText("Port")).toHaveValue(22);
  });

  it("blocks deleting a connection in use and names the targets", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/connections");
    await user.click(await screen.findByRole("button", { name: "Delete SSH" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "SSH is used by Build host and Edge router. Move them to another connection first.",
    );
  });

  it("edits a connection inline: Save appears once something changes", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/connections");
    const card = await screen.findByRole("form", { name: "Connection LDAPS" });
    expect(within(card).queryByRole("button", { name: "Save LDAPS" })).not.toBeInTheDocument();
    const description = within(card).getByLabelText("Description");
    await user.clear(description);
    await user.type(description, "Corp directory over LDAPS");
    await user.click(within(card).getByRole("button", { name: "Save LDAPS" }));
    expect(await screen.findByText("Saved LDAPS.")).toBeInTheDocument();
  });

  it("adds a connection, and deletes one nothing uses", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/connections");
    await user.click(await screen.findByRole("button", { name: "Add connection" }));
    const card = screen.getByRole("form", { name: "New connection" });
    await user.type(within(card).getByLabelText("Name"), "Kerberos KDC");
    await user.click(within(card).getByRole("button", { name: "Save the new connection" }));
    const saved = await screen.findByRole("form", { name: "Connection Kerberos KDC" });
    expect(within(saved).getByText("Not used by any target")).toBeInTheDocument();
    await user.click(within(saved).getByRole("button", { name: "Delete Kerberos KDC" }));
    expect(await screen.findByText("Deleted Kerberos KDC.")).toBeInTheDocument();
  });
});
