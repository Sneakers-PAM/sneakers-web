import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import type { DiagnosticsData } from "#shell/diagnostics/report";

import { AboutDialog } from "#shell/diagnostics/AboutDialog";

const component = (name: string, version: string, commit = "abc1234") => ({
  commit,
  dependencies: null,
  name,
  status: "OK" as const,
  version,
});

const onBox: DiagnosticsData = {
  app: { commit: "f00dfeed", name: "staff", version: "0.1.0" },
  gateway: {
    actor: { id: "user-1", roles: ["user"], username: "morgan" },
    appliance: "0.1.0-m",
    box: { baseOS: "0.1.0-m", baseWeb: "0.1.0-m2", fqdn: "box1.example.org" },
    gateway: component("gateway", "0.1.0", "c0ffee1"),
    generatedAt: "2026-10-05T12:00:00Z",
    productVersion: "0.1.0",
    publicUrl: "https://box1.example.org",
    services: [
      component("identity", "0.1.0", "1d1d1d1"),
      component("connector", "0.1.0", "c0c0c0c"),
      component("connector", "0.1.0", "c0c0c0c"),
    ],
    thirdParty: [component("kubernetes", "v1.36.4+k0s", "")],
    traceId: "1111",
  },
};

const renderAbout = (data: DiagnosticsData) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(data, { status: 200 })));
  const Stub = createRoutesStub([
    { Component: () => <AboutDialog onOpenChange={() => {}} open />, path: "/" },
  ]);
  render(<Stub initialEntries={["/"]} />);
};

describe("AboutDialog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the product once at the top, the box, and each service's own build", async () => {
    renderAbout(onBox);
    const dialog = await screen.findByRole("dialog", { name: "About and diagnostics" });
    const product = await within(dialog).findByText("Sneakers 0.1.0");
    const terms = within(dialog).getAllByRole("term");
    expect(terms[0]).toHaveTextContent("Product");
    expect(product).toBeInTheDocument();
    expect(within(dialog).getAllByText(/^Sneakers /)).toHaveLength(1);
    expect(within(dialog).getByText("0.1.0-m")).toBeInTheDocument();
    expect(within(dialog).getByText("0.1.0-m2")).toBeInTheDocument();
    expect(within(dialog).getByText("box1.example.org")).toBeInTheDocument();
    expect(within(dialog).getByText("0.1.0 (1d1d1d1)")).toBeInTheDocument();
    expect(within(dialog).getAllByText("0.1.0 (c0c0c0c)")).toHaveLength(2);
    expect(within(dialog).getByText("v1.36.4+k0s")).toBeInTheDocument();
    expect(within(dialog).queryByText(/not appliance/)).not.toBeInTheDocument();
  });

  it("says when it isn't an appliance and the product version isn't known", async () => {
    renderAbout({
      ...onBox,
      gateway: { ...onBox.gateway!, appliance: null, box: null, productVersion: null },
    });
    const dialog = await screen.findByRole("dialog", { name: "About and diagnostics" });
    expect(await within(dialog).findByText("Sneakers (version unknown)")).toBeInTheDocument();
    expect(within(dialog).getByText("not appliance")).toBeInTheDocument();
  });
});
