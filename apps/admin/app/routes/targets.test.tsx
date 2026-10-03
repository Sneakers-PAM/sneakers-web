import { mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as targets from "@/routes/targets";
import * as target from "@/routes/targets.$id";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: targets, path: "/targets" },
  { module: target, path: "/targets/new" },
  { module: target, path: "/targets/:id" },
];

describe("targets", () => {
  it("lists targets with their connection, pins and use", async () => {
    renderAdmin(ROUTES, "/targets");
    const build = await screen.findByRole("row", { name: /Build host/ });
    expect(within(build).getByText("Personal")).toBeInTheDocument();
    expect(within(build).getByText("1 pin")).toBeInTheDocument();
    expect(within(build).getByText("SSH (ssh:22)")).toBeInTheDocument();
  });

  it("creates a target and warns about an unpinned SSH host", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/targets/new");
    await user.click(await screen.findByRole("button", { name: "Create target" }));
    expect(screen.getByText("Give the target a name.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Name/), "Jump host");
    await user.type(screen.getByLabelText(/^Hostname/), "jump.example.org");
    await user.click(screen.getByRole("combobox", { name: /Connection/ }));
    await user.click(await screen.findByRole("option", { name: "SSH (ssh:22)" }));
    expect(screen.getByText(/no pinned key/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Pinned keys"), "jump.example.org ssh-ed25519 AAAA");
    expect(screen.getByText(/Line 1 doesn't start with a key type/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Pinned keys"));
    await user.type(screen.getByLabelText("Pinned keys"), "ssh-ed25519 AAAAC3Nza jump");
    await user.click(screen.getByRole("button", { name: "Create target" }));
    const row = await screen.findByRole("row", { name: /Jump host/ });
    expect(within(row).getByText("1 pin")).toBeInTheDocument();
  });

  it("deletes an unused target and blocks one that secrets point at", async () => {
    // Nothing points at the edge router once its one secret moves off it.
    for (const s of mockState.world.secrets)
      if (s.targetId === "mock-target-edge-router") s.targetId = undefined;
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/targets");
    expect(await screen.findByRole("button", { name: "Delete Corp directory" })).toHaveAttribute(
      "aria-disabled",
    );
    await user.click(screen.getByRole("button", { name: "Delete Edge router" }));
    expect(await screen.findByText("Deleted Edge router.")).toBeInTheDocument();
  });

  it("edits a target and keeps its pinned keys", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/targets/mock-target-build1");
    expect(await screen.findByText(/Personal target/)).toBeInTheDocument();
    expect(screen.getByLabelText("Pinned keys")).toHaveValue(
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMockBuild1HostKeyNotReal build1",
    );
    await user.clear(screen.getByLabelText(/^Description/));
    await user.type(screen.getByLabelText(/^Description/), "CI build host");
    await user.click(screen.getByRole("button", { name: "Save target" }));
    const row = await screen.findByRole("row", { name: /Build host/ });
    expect(within(row).getByText("1 pin")).toBeInTheDocument();
  });
});
