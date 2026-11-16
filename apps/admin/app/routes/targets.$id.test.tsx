import { mockState } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as hostKeyPinRoute from "@/routes/resources.host-key-pin";
import * as tlsCertPinRoute from "@/routes/resources.tls-cert-pin";
import * as target from "@/routes/targets.$id";
import { renderAdmin, type RouteModule } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: target, path: "/targets/:id" },
  {
    module: { ...hostKeyPinRoute, default: () => null } as RouteModule,
    path: "/resources/host-key-pin",
  },
  {
    module: { ...tlsCertPinRoute, default: () => null } as RouteModule,
    path: "/resources/tls-cert-pin",
  },
];

describe("the target editor's host-key pin flow", () => {
  it("scans the build host's offered key and pins it on confirm", async () => {
    const build = mockState.world.targets.find((t) => t.id === "mock-target-build1")!;
    build.sshHostKeys = [];
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/targets/mock-target-build1");
    await user.click(await screen.findByRole("button", { name: "Scan and pin…" }));
    expect(await screen.findByRole("heading", { name: "Pin the host key" })).toBeInTheDocument();
    expect(await screen.findByText(/SHA256:/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pin this key" }));
    // A scan carries no comment, so the draft shows the bare "type blob" line.
    const bare = build.offeredHostKey!.split(" ").slice(0, 2).join(" ");
    await vi.waitFor(() => expect(screen.getByLabelText("Pinned keys")).toHaveValue(bare));
    expect(build.sshHostKeys).toHaveLength(1);
  });
});

describe("the target editor's TLS certificate pin flow", () => {
  it("scans the database's chain and pins its own certificate on confirm", async () => {
    const database = mockState.world.targets.find((t) => t.id === "mock-target-db1")!;
    database.tlsCertPins = [];
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/targets/mock-target-db1");
    expect(await screen.findByText(/No certificate is pinned/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Scan and pin TLS certificate…" }));
    expect(
      await screen.findByRole("heading", { name: "Pin the TLS certificate" }),
    ).toBeInTheDocument();
    const pin = await screen.findByRole("button", { name: "Pin this certificate" });
    await user.click(pin);
    await vi.waitFor(() => expect(database.tlsCertPins).toHaveLength(1));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("has no TLS section for an SSH target", async () => {
    renderAdmin(ROUTES, "/targets/mock-target-build1");
    await screen.findByRole("button", { name: "Scan and pin…" });
    expect(screen.queryByRole("button", { name: "Scan and pin TLS certificate…" })).toBeNull();
  });
});
