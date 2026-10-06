import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { BreakGlassBanner, type BreakGlassState } from "#shell/layout/BreakGlassBanner";

const SESSION: BreakGlassState = {
  expiresAt: "2030-01-15T08:15:00Z",
  id: "bgs-1",
  openedAt: "2030-01-15T08:00:00Z",
  reason: "Owner unreachable",
};

const stub = (session: BreakGlassState | null, exited: FormData[]) =>
  createRoutesStub([
    {
      Component: () => (
        <BreakGlassBanner browse={{ href: "/break-glass", inApp: true }} session={session} />
      ),
      path: "/",
    },
    {
      action: async ({ request }) => {
        exited.push(await request.formData());
        return null;
      },
      path: "/resources/break-glass",
    },
  ]);

describe("BreakGlassBanner", () => {
  it("says the admin is in break-the-glass mode, with the way back to every secret", async () => {
    const Stub = stub(SESSION, []);
    render(<Stub initialEntries={["/"]} />);
    const banner = await screen.findByRole("status", { name: "Break-the-glass mode" });
    expect(banner).toHaveTextContent("You're in break-the-glass mode.");
    expect(banner).toHaveTextContent("the secret's owners are alerted");
    expect(screen.getByRole("link", { name: "All secrets" })).toHaveAttribute(
      "href",
      "/break-glass",
    );
  });

  it("ends the session from Exit", async () => {
    const exited: FormData[] = [];
    const Stub = stub(SESSION, exited);
    render(<Stub initialEntries={["/"]} />);
    await userEvent.click(await screen.findByRole("button", { name: "Exit break-glass" }));
    await vi.waitFor(() => expect(exited).toHaveLength(1));
    expect(exited[0]?.get("id")).toBe("bgs-1");
  });

  it("shows nothing outside break-the-glass mode", async () => {
    const Stub = stub(null, []);
    render(<Stub initialEntries={["/"]} />);
    await screen.findByText((_, element) => element?.tagName === "BODY");
    expect(screen.queryByRole("status", { name: "Break-the-glass mode" })).toBeNull();
  });
});
