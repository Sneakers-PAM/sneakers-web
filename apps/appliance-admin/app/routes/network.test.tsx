import { edge } from "@sneakers-web/edge";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepUpDialog } from "@/components/StepUpDialog";
import { network } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import Network from "@/routes/network";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const NetworkWithStepUp = () => (
  <>
    <Network />
    <StepUpDialog />
  </>
);

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

  it("says a DNS or NTP change was kept at once, with nothing to confirm", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.clear(screen.getByLabelText("DNS servers"));
    await user.type(screen.getByLabelText("DNS servers"), "192.0.2.54");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findAllByText(/kept at once/)).not.toHaveLength(0);
    expect(screen.queryByText(/A network change is pending/)).not.toBeInTheDocument();
    const saved = await network.get();
    expect(saved.settings?.dns).toEqual(["192.0.2.54"]);
  });

  it("after a step-up, asks in the same dialog to keep the change", async () => {
    signInAs("alice");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(NetworkWithStepUp);
    await screen.findByText("Network");
    await user.clear(screen.getByLabelText("Hostname"));
    await user.type(screen.getByLabelText("Hostname"), "box.example.org");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Authenticator code"), "123456");
    await user.click(dialog.getByRole("button", { name: "Verify code" }));
    expect(await dialog.findByText("Keep this change?")).toBeInTheDocument();
    expect(dialog.getByText(/reverts in 1[12]\d seconds/)).toBeInTheDocument();
    await user.click(dialog.getByRole("button", { name: "Keep this change" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(await screen.findAllByText("Kept.")).not.toHaveLength(0);
    const after = await network.get();
    expect(after.pending).toBe(false);
  });

  it("says when the last change was undone, and when that was at a restart", async () => {
    applyMockScenario("network-reverted-at-start");
    renderPage(Network);
    expect(
      await screen.findByText(/The last network change \(net-6\) wasn't kept, so the box undid it/),
    ).toBeInTheDocument();
    expect(screen.getByText(/restarted before it was kept/)).toBeInTheDocument();
  });

  it("shows the DNS and search domains DHCP gave the box, next to the typed ones", async () => {
    renderPage(Network);
    expect(await screen.findByText("From DHCP, DNS: 192.0.2.1")).toBeInTheDocument();
    expect(screen.getByText("From DHCP, search domains: example.org")).toBeInTheDocument();
    expect(screen.getByText("The clock asks: 192.0.2.123")).toBeInTheDocument();
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
