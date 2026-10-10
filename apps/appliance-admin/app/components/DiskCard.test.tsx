import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepUpDialog } from "@/components/StepUpDialog";
import { status } from "@/lib/osadmin/client";
import { applyMockScenario } from "@/mock/edge.mock";
import * as world from "@/mock/world";
import Home from "@/routes/home";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

describe("the Disk card on Status", () => {
  it("lists each volume with its level, and product data on the state volume", async () => {
    renderPage(Home);
    const card = within(await screen.findByRole("region", { name: "Disk" }));
    const volumes = within(card.getByRole("list", { name: "Volumes" }));
    expect(volumes.getByText("State")).toBeInTheDocument();
    expect(volumes.getByText("20.0 GB of 100.0 GB (20%)")).toBeInTheDocument();
    expect(volumes.getAllByText("OK")).toHaveLength(2);
    expect(volumes.getByText("on the state volume")).toBeInTheDocument();
    expect(card.getByText(/The database: 3.0 GB, growing 50.0 MB\/day/)).toBeInTheDocument();
    expect(card.getByText(/write-ahead log 192.0 MB of its 1.0 GB limit/)).toBeInTheDocument();
    expect(card.getByText(/cleans up every hour/)).toBeInTheDocument();
  });

  it("shows a volume over 80% as a warning", async () => {
    applyMockScenario("disk-warning");
    renderPage(Home);
    const card = within(await screen.findByRole("region", { name: "Disk" }));
    expect(card.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText(/The state volume is 85% full/)).toBeInTheDocument();
    expect(screen.getByText(/fills in about 2 days/)).toBeInTheDocument();
  });

  it("shows a volume over 90% as critical, in a red alert", async () => {
    applyMockScenario("disk-critical");
    renderPage(Home);
    const card = within(await screen.findByRole("region", { name: "Disk" }));
    expect(card.getByText("Critical")).toBeInTheDocument();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/93% full/);
  });

  it("cleans up now after a fresh code, and the warning clears", async () => {
    signInAs("alice");
    applyMockScenario("disk-critical");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(() => (
      <>
        <Home />
        <StepUpDialog />
      </>
    ));
    const region = await screen.findByRole("region", { name: "Disk" });
    await user.click(within(region).getByRole("button", { name: "Clean up now" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Authenticator code"), "123456");
    await user.click(dialog.getByRole("button", { name: "Verify code" }));
    await vi.waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const card = within(await screen.findByRole("region", { name: "Disk" }));
    expect(
      await card.findByText(/Last cleanup just now, on request by alice: freed 60.0 GB/),
    ).toBeInTheDocument();
    expect(card.queryByText("Critical")).not.toBeInTheDocument();
  });

  it("keeps the critical alert when nothing could be freed", async () => {
    applyMockScenario("disk-stuck");
    const user = userEvent.setup();
    renderPage(Home);
    const region = await screen.findByRole("region", { name: "Disk" });
    await user.click(within(region).getByRole("button", { name: "Clean up now" }));
    expect(await screen.findByText("Cleanup done: freed 4.0 KB.")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/93% full/);
    expect(screen.getByText(/write-ahead log is 1.4 GiB/)).toBeInTheDocument();
  });

  it("shows the old state-volume line on a box from before the disk guard", async () => {
    vi.spyOn(status, "get").mockResolvedValue({ ...world.status(), dataPaths: [], volumes: [] });
    renderPage(Home);
    const card = within(await screen.findByRole("region", { name: "Disk" }));
    expect(card.getByText(/20.0 GB of 100.0 GB used, growing 10.0 MB\/day/)).toBeInTheDocument();
    expect(card.queryByRole("button", { name: "Clean up now" })).not.toBeInTheDocument();
  });
});
