import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { ErrorBoundary } from "@/root";
import { signInAs } from "@/test/session";

const stub = (status: number) => {
  const Stub = createRoutesStub([
    {
      ErrorBoundary,
      loader: () => {
        throw new Response("boom", { status });
      },
      path: "/",
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

describe("ErrorBoundary", () => {
  it("shows the sign-in-again page for a 401", async () => {
    stub(401);
    expect(await screen.findByText("Sign in again")).toBeInTheDocument();
  });

  it("shows the not-allowed page for a 403", async () => {
    stub(403);
    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });

  it("shows the box-had-a-problem page for a 500", async () => {
    stub(500);
    expect(await screen.findByText("The box had a problem")).toBeInTheDocument();
  });

  it("still shows the not-found page for a 404", async () => {
    stub(404);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
  });
});

const Crash = () => {
  throw new TypeError("Cannot read properties of undefined (reading 'map')");
};

describe("the error screens' Copy diagnostics", () => {
  let writeText: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("no product server here")));
    signInAs("alice");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.history.pushState({}, "", "/");
  });

  const copied = async (): Promise<string> => {
    await userEvent.click(await screen.findByRole("button", { name: "Copy diagnostics" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    return writeText.mock.calls[0]![0] as string;
  };

  it("copies the appliance report for a crash, not the product's", async () => {
    // The browser router's page is the window's; the memory router here doesn't move it.
    globalThis.history.pushState({}, "", "/access");
    const Stub = createRoutesStub([{ Component: Crash, ErrorBoundary, path: "/access" }]);
    render(<Stub initialEntries={["/access"]} />);
    const text = await copied();
    expect(text).toContain("Sneakers-PAM appliance admin diagnostics");
    expect(text).toContain("Problem: Page crashed: TypeError");
    expect(text).toContain("Page: /access");
    expect(text).toContain(`App: appliance-admin ${__APP_VERSION__} (${__APP_COMMIT__})`);
    expect(text).toContain("Signed in as: alice (owner)");
    expect(text).toContain("Box version: ");
    expect(text).toContain("Browser: ");
    expect(text).not.toContain("not appliance");
    expect(text.toLowerCase()).not.toContain("gateway");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("copies the appliance report from the not-found and sign-in-again pages too", async () => {
    stub(404);
    expect(await copied()).toContain("Problem: Page not found");
    writeText.mockClear();
    stub(401);
    const buttons = await screen.findAllByRole("button", { name: "Copy diagnostics" });
    await userEvent.click(buttons.at(-1)!);
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0]![0]).toContain("Sneakers-PAM appliance admin diagnostics");
  });
});
