import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { power } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import Power from "@/routes/power";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const HOSTNAME = ["appliance", "example", "org"].join(".");

const openPage = async () => {
  renderPage(Power);
  return screen.findByRole("heading", { name: "Power" });
};

const resetSection = () => screen.getByRole("region", { name: "Factory reset" });

describe("Power", () => {
  beforeEach(() => signInAs("alice"));

  it("shows the active session", async () => {
    await openPage();
    expect(screen.getByText(/alice from 192.0.2.10/)).toBeInTheDocument();
  });

  it("reboots gracefully by default", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Reboot" }));
    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(await screen.findByText(/Rebooting/)).toBeInTheDocument();
  });

  it("needs the second explicit confirmation to force a shutdown", async () => {
    const user = userEvent.setup();
    await openPage();
    await user.click(screen.getByRole("button", { name: "Shut down" }));
    await user.click(screen.getByRole("switch", { name: "Force (skip the drain)" }));
    expect(screen.getByRole("button", { name: "Confirm" })).toBeDisabled();
    await user.click(screen.getByText(/I understand sessions will be cut/));
    expect(screen.getByRole("button", { name: "Confirm" })).not.toBeDisabled();
  });

  describe("factory reset", () => {
    it("isn't offered with a single admin, and says why", async () => {
      applyMockScenario("single-admin");
      await openPage();
      const section = resetSection();
      expect(
        within(section).getByText(/needs a quorum of at least two admins/),
      ).toBeInTheDocument();
      expect(within(section).getByText(/delete and re-create, or re-flash/)).toBeInTheDocument();
      expect(
        within(section).queryByRole("button", { name: "Request factory reset" }),
      ).not.toBeInTheDocument();
    });

    it("lets an owner request it only after typing the host name, then shows the quorum", async () => {
      const user = userEvent.setup();
      await openPage();
      const section = resetSection();
      const request = within(section).getByRole("button", { name: "Request factory reset" });
      expect(request).toBeDisabled();
      await user.type(within(section).getByLabelText(`Type ${HOSTNAME} to confirm`), "wrong");
      expect(request).toBeDisabled();
      await user.clear(within(section).getByLabelText(`Type ${HOSTNAME} to confirm`));
      await user.type(within(section).getByLabelText(`Type ${HOSTNAME} to confirm`), HOSTNAME);
      await user.click(request);
      expect(await within(section).findByText("1 of 2 approvals")).toBeInTheDocument();
      expect(within(section).getByText(/Requested by alice/)).toBeInTheDocument();
      expect(
        within(section).getByRole("listitem", { name: "alice: approved" }),
      ).toBeInTheDocument();
      expect(within(section).getByRole("listitem", { name: "bob: waiting" })).toBeInTheDocument();
    });

    it("doesn't offer the requester a second approval", async () => {
      applyMockScenario("reset-pending");
      await openPage();
      const section = resetSection();
      expect(within(section).getByText(/Your approval is counted/)).toBeInTheDocument();
      expect(within(section).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    });

    it("has the server refuse a second approval from the same admin", async () => {
      applyMockScenario("reset-pending");
      await expect(power.approveFactoryReset("R-MOCK01")).rejects.toThrow(OsadminError);
      await expect(power.approveFactoryReset("R-MOCK01")).rejects.toThrow(/RESET_APPROVED/);
    });

    it("tells an admin they can't request one, only approve or cancel", async () => {
      signInAs("bob");
      await openPage();
      const section = resetSection();
      expect(
        within(section).getByText(/Only an owner can request a factory reset/),
      ).toBeInTheDocument();
      expect(
        within(section).queryByRole("button", { name: "Request factory reset" }),
      ).not.toBeInTheDocument();
    });

    it("starts the 10-minute countdown when another roster member approves", async () => {
      applyMockScenario("reset-pending");
      signInAs("bob");
      const user = userEvent.setup();
      await openPage();
      const section = resetSection();
      await user.click(within(section).getByRole("button", { name: "Approve" }));
      expect(await within(section).findByText(/Factory reset in/)).toBeInTheDocument();
      const timer = within(section).getByRole("timer");
      expect(timer.textContent).toMatch(/^(10:00|9:5\d)$/);
      expect(
        within(section).getByRole("button", { name: "Cancel the factory reset" }),
      ).toBeInTheDocument();
    });

    it("lets any admin cancel the countdown", async () => {
      applyMockScenario("reset-countdown");
      signInAs("bob");
      const user = userEvent.setup();
      await openPage();
      const section = resetSection();
      await user.click(within(section).getByRole("button", { name: "Cancel the factory reset" }));
      expect(
        await within(section).findByText("The factory reset was cancelled."),
      ).toBeInTheDocument();
      expect(within(section).queryByRole("timer")).not.toBeInTheDocument();
    });

    it("lets any admin cancel a request still waiting for approvals", async () => {
      applyMockScenario("reset-pending");
      signInAs("bob");
      const user = userEvent.setup();
      await openPage();
      await user.click(within(resetSection()).getByRole("button", { name: "Cancel the request" }));
      expect(await screen.findByText("The factory reset was cancelled.")).toBeInTheDocument();
    });
  });
});
