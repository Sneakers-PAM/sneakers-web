import { edge } from "@sneakers-web/edge";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { network } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import Network from "@/routes/network";
import { renderPage } from "@/test/renderPage";

const unreachable = () => {
  const request = edge.request.bind(edge);
  vi.spyOn(edge, "request").mockImplementation((service, method, body) =>
    method === "ConfirmNetwork"
      ? Promise.reject(
          new OsadminError("unavailable", "The appliance can't be reached at this address."),
        )
      : request(service, method, body),
  );
};

describe("Network", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the management address and settings", async () => {
    renderPage(Network);
    expect(await screen.findByText("Network")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("appliance.example.org")).toBeInTheDocument();
  });

  it("applies a change, counts down from the box's answer and confirms it", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.clear(screen.getByLabelText("Hostname"));
    await user.type(screen.getByLabelText("Hostname"), "box.example.org");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(
      await screen.findByText(/reverts in 1[12]\d seconds unless confirmed/),
    ).toBeInTheDocument();
    expect(screen.getByText(/makes a new certificate/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findAllByText("Confirmed.")).not.toHaveLength(0);
    expect(screen.queryByText(/A network change is pending/)).not.toBeInTheDocument();
  });

  it("keeps Confirm and the time left after a reload", async () => {
    const user = userEvent.setup();
    const current = await network.get();
    await network.set({ ...current.settings!, hostname: "box.example.org" });
    renderPage(Network);
    expect(
      await screen.findByText(/reverts in 1[12]\d seconds unless confirmed/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findAllByText("Confirmed.")).not.toHaveLength(0);
    const after = await network.get();
    expect(after.pending).toBe(false);
  });

  it("names the new address when the change moves the box", async () => {
    const user = userEvent.setup();
    const current = await network.get();
    const settings = current.settings!;
    vi.spyOn(network, "set").mockResolvedValue({
      movesManagement: true,
      newUrl: "https://192.0.2.60:8443/",
      revertAfterSeconds: 120,
      token: "t-1",
    });
    vi.spyOn(network, "get").mockResolvedValue({
      managementAddresses: ["192.0.2.50"],
      ntpOffsetMs: "4",
      ntpSynced: true,
      pending: true,
      revertSecondsLeft: 118,
      serviceAddresses: [],
      settings,
    });
    unreachable();
    renderPage(Network);
    await screen.findByText("Network");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("link", { name: "https://192.0.2.60:8443/" })).toHaveAttribute(
      "href",
      "https://192.0.2.60:8443/",
    );
    expect(screen.getByText(/sign in and confirm there/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(
      await screen.findAllByText(
        /can't be reached at this address\. The change reverts in 1[01]\d seconds unless confirmed from the new address \(https:\/\/192\.0\.2\.60:8443\/\)/,
      ),
    ).not.toHaveLength(0);
  });

  it("says plainly when Confirm can't reach the box", async () => {
    const user = userEvent.setup();
    const current = await network.get();
    await network.set({ ...current.settings!, hostname: "box.example.org" });
    unreachable();
    renderPage(Network);
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(
      await screen.findAllByText(
        /The box can't be reached at this address\. The change reverts in 1[12]\d seconds unless confirmed from the new address\./,
      ),
    ).not.toHaveLength(0);
  });

  it("colours each check by its result and shows the code and detail", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.click(screen.getByRole("button", { name: "Run checks" }));
    await screen.findByText("link");
    const row = (name: string) =>
      within(screen.getAllByRole("row").find((r) => within(r).queryByText(name))!);
    expect(row("link").getByText("OK")).toHaveClass("bg-ok-soft");
    expect(row("ntp").getByText("Warning")).toHaveClass("bg-warn-soft");
    expect(row("dns").getByText("Failed")).toHaveClass("bg-danger-soft");
    expect(row("dns").getByText(/NET_DNS/)).toBeInTheDocument();
    expect(row("dns").getByText(/no DNS server answered/)).toBeInTheDocument();
  });
});
