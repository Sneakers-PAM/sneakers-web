import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApplianceAbout } from "@/components/ApplianceAbout";
import { UNREACHABLE } from "@/lib/edge.live";
import { status } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import { signInAs } from "@/test/session";

describe("ApplianceAbout", () => {
  beforeEach(() => signInAs("alice"));

  it("reports this build, the signed-in admin, the box and its service health, with no gateway section", async () => {
    render(<ApplianceAbout onOpenChange={() => {}} open />);
    expect(
      await screen.findByText(`appliance-admin ${__APP_VERSION__} (${__APP_COMMIT__})`),
    ).toBeInTheDocument();
    expect(screen.getByText("alice (owner)")).toBeInTheDocument();
    expect(screen.getByText("full")).toBeInTheDocument();
    expect(screen.getByText("on")).toBeInTheDocument();
    expect(screen.getByText("accessd")).toBeInTheDocument();
    expect(screen.queryByText(/gateway/i)).not.toBeInTheDocument();
  });

  it("copies the diagnostics text to the clipboard", async () => {
    // userEvent.setup() installs its own clipboard stub, so the mock has to go on after it.
    const user = userEvent.setup();
    const writeText: ReturnType<typeof vi.fn> = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ApplianceAbout onOpenChange={() => {}} open />);
    const button = await screen.findByRole("button", { name: "Copy diagnostics" });
    await screen.findByText("alice (owner)");
    await user.click(button);
    expect(writeText).toHaveBeenCalledOnce();
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain("Signed in as: alice (owner)");
    expect(text.toLowerCase()).not.toContain("gateway");
  });

  it("shows the box couldn't be read when Status refuses", async () => {
    vi.spyOn(status, "get").mockRejectedValueOnce(new Error("offline"));
    render(<ApplianceAbout onOpenChange={() => {}} open />);
    await screen.findByText("alice (owner)");
    expect(screen.queryByText("full")).not.toBeInTheDocument();
  });

  it("says why Status failed with the box's code, and the copied report carries it", async () => {
    applyMockScenario("status-fails");
    const user = userEvent.setup();
    const writeText: ReturnType<typeof vi.fn> = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ApplianceAbout onOpenChange={() => {}} open />);
    expect(
      await screen.findByText(
        "couldn't be read (unavailable: the appliance services are unavailable; try again shortly)",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy diagnostics" }));
    const text = writeText.mock.calls[0]![0] as string;
    expect(text).toContain(
      "Box: couldn't be read (unavailable: the appliance services are unavailable; try again shortly)",
    );
  });

  it("says the box can't be reached when Status never arrives", async () => {
    vi.spyOn(status, "get").mockRejectedValueOnce(new OsadminError("unavailable", UNREACHABLE));
    render(<ApplianceAbout onOpenChange={() => {}} open />);
    expect(
      await screen.findByText(`couldn't be read (unavailable: ${UNREACHABLE})`),
    ).toBeInTheDocument();
  });

  it("reads Status again on Retry", async () => {
    const user = userEvent.setup();
    vi.spyOn(status, "get").mockRejectedValueOnce(
      new OsadminError("unavailable", "the appliance services are unavailable; try again shortly"),
    );
    render(<ApplianceAbout onOpenChange={() => {}} open />);
    await screen.findByText(/couldn't be read \(unavailable/);
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("full")).toBeInTheDocument();
    expect(screen.queryByText(/couldn't be read/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
