import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ApplianceAbout } from "@/components/ApplianceAbout";
import { status } from "@/lib/osadmin/client";
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
});
