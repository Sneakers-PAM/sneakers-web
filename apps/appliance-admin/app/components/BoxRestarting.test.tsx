import { render, screen } from "@testing-library/react";

import { BoxRestarting } from "@/components/BoxRestarting";
import { signIn, status } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { boxAnswer } from "@/lib/osadmin/restart";

const session = { session: { admin: "alice" } } as Awaited<ReturnType<typeof signIn.getSession>>;
const signedOut = () => new OsadminError("unauthenticated", "ACCESS_SESSION: sign in first");

describe("boxAnswer", () => {
  it("tells a box still on this session from one that restarted and one that's down", async () => {
    const getSession = vi.spyOn(signIn, "getSession");
    getSession.mockResolvedValueOnce(session);
    expect(await boxAnswer()).toBe("session");
    getSession.mockRejectedValueOnce(signedOut());
    expect(await boxAnswer()).toBe("signed-out");
    getSession.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await boxAnswer()).toBe("down");
    getSession.mockRejectedValueOnce(new OsadminError("unknown", "osadmin answered 502"));
    expect(await boxAnswer()).toBe("down");
  });

  it("asks the public phase first: no phase answer means the box is down", async () => {
    vi.spyOn(signIn, "getSession").mockResolvedValue(session);
    vi.spyOn(status, "getPhase").mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await boxAnswer()).toBe("down");
  });
});

describe("BoxRestarting", () => {
  it("waits for the box to go down and come back, then goes on", async () => {
    vi.spyOn(signIn, "getSession")
      .mockResolvedValueOnce(session)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockRejectedValue(signedOut());
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} />);
    expect(screen.getByRole("heading", { name: "The box is restarting" })).toBeInTheDocument();
    expect(await screen.findByText(/down while it restarts/)).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "The box is back" })).toBeInTheDocument();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting while the box still answers on the old session", async () => {
    vi.spyOn(signIn, "getSession").mockResolvedValue(session);
    const onBack = vi.fn();
    render(<BoxRestarting onBack={onBack} pollMs={5} />);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText(/Waiting for the box to go down/)).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("offers a reload when the box takes too long, instead of a dead page", async () => {
    vi.spyOn(signIn, "getSession").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<BoxRestarting onBack={vi.fn()} pollMs={5} slowMs={20} />);
    expect(await screen.findByText("This is taking longer than usual")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
