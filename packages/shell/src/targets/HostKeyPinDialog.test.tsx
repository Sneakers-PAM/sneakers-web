import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import { HOST_KEY_PIN_ROUTE, HostKeyPinDialog } from "#shell/targets/HostKeyPinDialog";

// Reported bug: a host key's SHA256 fingerprint (one unbroken token, no spaces to break at) sat
// in a `dl.grid-cols-[auto_1fr]` row with no min-width or wrap on its `dd`, so the fingerprint's
// own min-content size pushed the grid, and the dialog, wider than the viewport.
const longFingerprint = `SHA256:${"A".repeat(300)}`;

const stub = () =>
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
      action: () => ({
        scan: {
          fingerprint: longFingerprint,
          keyType: "ssh-ed25519",
          pinned: false,
          publicKey: `ssh-ed25519 ${"B".repeat(300)}`,
          targetId: "t1",
        },
        view: "scanned",
      }),
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
});
