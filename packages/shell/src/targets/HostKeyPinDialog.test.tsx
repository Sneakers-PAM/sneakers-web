import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { HOST_KEY_PIN_ROUTE, HostKeyPinDialog } from "#shell/targets/HostKeyPinDialog";

// Reported bug: a host key's SHA256 fingerprint (one unbroken token, no spaces to break at) sat
// in a `dl.grid-cols-[auto_1fr]` row with no min-width or wrap on its `dd`, so the fingerprint's
// own min-content size pushed the grid, and the dialog, wider than the viewport.
const longFingerprint = `SHA256:${"A".repeat(300)}`;

const stub = ({
  fingerprint = longFingerprint,
  pinnedFingerprints = [] as string[],
  posts = [] as Record<string, string>[],
} = {}) =>
  createRoutesStub([
    {
      Component: () => (
        <HostKeyPinDialog
          hostname="box.example.org"
          onOpenChange={() => {}}
          onPinned={() => {}}
          open
          targetId="t1"
        />
      ),
      path: "/",
    },
    {
      action: async ({ request }) => {
        const form = Object.fromEntries(await request.formData()) as Record<string, string>;
        posts.push(form);
        if (form.intent === "pin") return { publicKey: "ssh-ed25519 BBBB", view: "pinned" };
        return {
          pinnedFingerprints,
          scan: {
            address: "box.example.org:22",
            fingerprint,
            keyType: "ssh-ed25519",
            pinned: false,
            publicKey: `ssh-ed25519 ${"B".repeat(300)}`,
            targetId: "t1",
          },
          view: "scanned",
        };
      },
      path: HOST_KEY_PIN_ROUTE,
    },
  ]);

describe("HostKeyPinDialog", () => {
  it("wraps a long fingerprint inside the dialog instead of letting it overflow", async () => {
    const Stub = stub();
    render(<Stub initialEntries={["/"]} />);
    const fingerprint = await screen.findByText(longFingerprint);
    expect(fingerprint).toHaveClass("min-w-0", "flex-1", "wrap-anywhere");
    // The dialog's own panel stays within the viewport regardless of what it holds.
    expect(screen.getByRole("dialog")).toHaveClass("max-w-[34rem]");
  });

  it("shows the address the scan dialled", async () => {
    const Stub = stub({ fingerprint: "SHA256:new" });
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByText("box.example.org:22")).toBeInTheDocument();
  });

  it("pins a first key on one click, with no typed confirm", async () => {
    const posts: Record<string, string>[] = [];
    const Stub = stub({ fingerprint: "SHA256:new", posts });
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);
    await screen.findByText("SHA256:new");
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Pin this key" }));
    await vi.waitFor(() =>
      expect(posts.at(-1)).toMatchObject({ fingerprint: "SHA256:new", intent: "pin" }),
    );
  });

  // #318: a key that changed shows the old and new side by side and needs a typed confirm.
  it("shows a changed key beside the pinned one and pins only after the hostname is typed", async () => {
    const posts: Record<string, string>[] = [];
    const Stub = stub({ fingerprint: "SHA256:new", pinnedFingerprints: ["SHA256:old"], posts });
    const user = userEvent.setup();
    render(<Stub initialEntries={["/"]} />);
    const before = await screen.findByRole("group", { name: "Pinned now" });
    expect(within(before).getByText("SHA256:old")).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Offered now" })).getByText("SHA256:new"),
    ).toBeInTheDocument();
    expect(screen.getByText(/offers a different key/)).toBeInTheDocument();
    const pin = screen.getByRole("button", { name: "Pin this key" });
    expect(pin).toBeDisabled();
    await user.type(screen.getByLabelText("Type box.example.org to confirm"), "box.example");
    expect(pin).toBeDisabled();
    await user.type(screen.getByLabelText("Type box.example.org to confirm"), ".org");
    expect(pin).toBeEnabled();
    await user.click(pin);
    await vi.waitFor(() =>
      expect(posts.at(-1)).toMatchObject({ fingerprint: "SHA256:new", intent: "pin" }),
    );
  });
});
