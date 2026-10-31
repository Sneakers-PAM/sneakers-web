import { edge } from "@sneakers-web/edge";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { GetNetworkResponse } from "@/lib/osadmin/types";

import { StepUpDialog } from "@/components/StepUpDialog";
import { network } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import Network from "@/routes/network";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const read = async <T,>(pick: (now: GetNetworkResponse) => T) => pick(await network.get());

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

  it("stages an edit, changing nothing live until it's committed", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.clear(screen.getByLabelText("Hostname"));
    await user.type(screen.getByLabelText("Hostname"), "box.example.org");
    await user.click(screen.getByRole("button", { name: "Stage change" }));
    expect(await screen.findByText("A network change is staged")).toBeInTheDocument();
    expect(screen.getByText(/may change once this is kept/)).toBeInTheDocument();
    expect(screen.getByLabelText("Hostname")).toHaveValue("box.example.org");
    const staged = await network.get();
    expect(staged.settings?.hostname).toBe("appliance.example.org");
    expect(staged.staged?.hostname).toBe("box.example.org");
    await user.click(screen.getByRole("button", { name: "Commit" }));
    expect(await screen.findByText(/Committed and kept/)).toBeInTheDocument();
    expect(screen.queryByText("A network change is staged")).not.toBeInTheDocument();
    const after = await network.get();
    expect(after.settings?.hostname).toBe("box.example.org");
    expect(after.staged).toBeUndefined();
    expect(after.pending).toBe(false);
  });

  it("discards what's staged and puts the fields back", async () => {
    applyMockScenario("network-staged");
    const user = userEvent.setup();
    renderPage(Network);
    expect(await screen.findByLabelText("Hostname")).toHaveValue("box.example.org");
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await vi.waitFor(() =>
      expect(screen.getByLabelText("Hostname")).toHaveValue("appliance.example.org"),
    );
    expect(screen.queryByText("A network change is staged")).not.toBeInTheDocument();
    expect(await read((n) => n.staged)).toBeUndefined();
  });

  it("asks for a fresh code before it commits", async () => {
    signInAs("alice");
    applyMockScenario("network-staged");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(NetworkWithStepUp);
    await user.click(await screen.findByRole("button", { name: "Commit" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Authenticator code"), "123456");
    await user.click(dialog.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText(/Committed and kept/)).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("stages DHCP, then a static IPv4 address and gateway", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.click(within(screen.getByRole("radiogroup", { name: "IPv4" })).getByText("DHCP"));
    expect(screen.queryByLabelText("IPv4 address")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stage change" }));
    await screen.findByText("A network change is staged");
    const dhcp = await read((n) => n.staged?.management);
    expect(dhcp).toMatchObject({ ipv4: { mode: "IPV4_MODE_DHCP" }, name: "eth0" });
    expect(dhcp?.ipv4?.address).toBeUndefined();
    await user.click(within(screen.getByRole("radiogroup", { name: "IPv4" })).getByText("Static"));
    await user.type(screen.getByLabelText("IPv4 address"), "192.0.2.60/24");
    await user.type(screen.getByLabelText("IPv4 gateway"), "192.0.2.1");
    await user.click(screen.getByRole("button", { name: "Stage change" }));
    await vi.waitFor(async () =>
      expect(await read((n) => n.staged?.management?.ipv4)).toEqual({
        address: "192.0.2.60/24",
        gateway: "192.0.2.1",
        mode: "IPV4_MODE_STATIC",
      }),
    );
  });

  it("offers each IPv6 mode and stages a static address", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    const ipv6 = within(screen.getByRole("radiogroup", { name: "IPv6" }));
    for (const mode of ["SLAAC", "DHCPv6", "Off"]) expect(ipv6.getByText(mode)).toBeInTheDocument();
    await user.click(ipv6.getByText("Static"));
    await user.type(screen.getByLabelText("IPv6 address"), "2001:db8::10/64");
    await user.type(screen.getByLabelText("IPv6 gateway"), "fe80::1");
    await user.click(screen.getByRole("button", { name: "Stage change" }));
    await screen.findByText("A network change is staged");
    expect(await read((n) => n.staged?.management?.ipv6)).toEqual({
      address: "2001:db8::10/64",
      gateway: "fe80::1",
      mode: "IPV6_MODE_STATIC",
    });
  });

  it("shows the box's refusal of a bad address, and stages nothing", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.clear(screen.getByLabelText("IPv4 address"));
    await user.type(screen.getByLabelText("IPv4 address"), "not an address");
    await user.click(screen.getByRole("button", { name: "Stage change" }));
    expect(await screen.findAllByText(/management\.ipv4\.address/i)).not.toHaveLength(0);
    expect(await read((n) => n.staged)).toBeUndefined();
  });

  it("warns that a moved address drops the page, and names where to reconnect", async () => {
    applyMockScenario("network-staged-moves");
    renderPage(Network);
    expect(await screen.findByText(/this page will drop/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://192.0.2.60:8443/" })).toHaveAttribute(
      "href",
      "https://192.0.2.60:8443/",
    );
  });

  it("says the page drops on a move to DHCP, with no address to name", async () => {
    applyMockScenario("network-staged-dhcp");
    renderPage(Network);
    expect(await screen.findByText(/this page will drop/)).toBeInTheDocument();
    expect(screen.getByText(/find it on the box's console/)).toBeInTheDocument();
  });

  it("warns when the change touches the allow-list", async () => {
    applyMockScenario("network-staged-allow-list");
    renderPage(Network);
    expect(await screen.findByText(/Recover access/)).toBeInTheDocument();
  });

  it("treats a dropped commit on a moved address as expected, not an error", async () => {
    applyMockScenario("network-staged-moves");
    applyMockScenario("network-commit-drops");
    const user = userEvent.setup();
    renderPage(Network);
    await user.click(await screen.findByRole("button", { name: "Commit" }));
    expect(await screen.findByText(/stopped answering here/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://192.0.2.60:8443/" })).toBeInTheDocument();
    expect(screen.queryByText("A network change is staged")).not.toBeInTheDocument();
    expect(screen.queryByText(/can't be reached/)).not.toBeInTheDocument();
  });

  it("says to accept the new certificate when a new name drops the page", async () => {
    applyMockScenario("network-staged");
    applyMockScenario("network-commit-drops");
    const user = userEvent.setup();
    renderPage(Network);
    await user.click(await screen.findByRole("button", { name: "Commit" }));
    expect(await screen.findByText(/stopped answering here/)).toBeInTheDocument();
    expect(screen.getByText(/accept the new certificate/)).toBeInTheDocument();
    expect(screen.queryByText("A network change is staged")).not.toBeInTheDocument();
  });

  it("points to the new address when the box answers a commit that moved it", async () => {
    applyMockScenario("network-staged-moves");
    const user = userEvent.setup();
    const get = vi.spyOn(network, "get");
    renderPage(Network);
    await user.click(await screen.findByRole("button", { name: "Commit" }));
    expect(await screen.findByText(/Committed and kept/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "https://192.0.2.60:8443/" })).toBeInTheDocument();
    expect(screen.queryByText("A network change is staged")).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("shows a refused gateway test, with the change still staged", async () => {
    applyMockScenario("network-staged-moves");
    applyMockScenario("network-gateway-dead");
    const user = userEvent.setup();
    renderPage(Network);
    await user.click(await screen.findByRole("button", { name: "Commit" }));
    expect(
      await screen.findByText(
        /The gateway 192\.0\.2\.1 doesn't answer from 192\.0\.2\.60\/24, so nothing was changed/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("A network change is staged")).toBeInTheDocument();
    expect(await read((n) => n.settings?.management?.ipv4?.address)).toBe("192.0.2.50/24");
  });

  it("says plainly when the box's base has no stage and commit", async () => {
    applyMockScenario("network-old-base");
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.click(screen.getByRole("button", { name: "Stage change" }));
    expect(
      await screen.findByText(/base OS doesn't have stage and commit yet/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Hostname")).toBeInTheDocument();
  });

  it("still confirms a change waiting in its window, such as an allow-list reset", async () => {
    applyMockScenario("network-pending");
    const user = userEvent.setup();
    renderPage(Network);
    expect(await screen.findByText(/reverts in 9\d seconds unless confirmed/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findAllByText("Confirmed.")).not.toHaveLength(0);
    expect(await read((n) => n.pending)).toBe(false);
  });

  it("says plainly when Confirm can't reach the box", async () => {
    applyMockScenario("network-pending");
    unreachable();
    const user = userEvent.setup();
    renderPage(Network);
    await user.click(await screen.findByRole("button", { name: "Confirm" }));
    expect(
      await screen.findAllByText(
        /The box can't be reached at this address\. The change reverts in 9\d seconds unless confirmed from the new address\./,
      ),
    ).not.toHaveLength(0);
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
