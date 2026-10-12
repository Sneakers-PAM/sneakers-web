import { closeMessage } from "@/features/targets/terminal/messages";

describe("the terminal's error card", () => {
  it("says why a session couldn't start when the broker says", () => {
    expect(
      closeMessage({
        detail: "can't reach 192.0.2.10:22: connection timed out",
        kind: "failed",
        started: false,
      }),
    ).toBe(
      "The SSH session couldn't start: can't reach 192.0.2.10:22: connection timed out. The key was not shown to anyone.",
    );
  });

  it("keeps the general sentence when there is no reason", () => {
    expect(closeMessage({ kind: "failed", started: false })).toBe(
      "The SSH session couldn't start: the ticket ran out, or the host didn't answer. The key was not shown to anyone.",
    );
  });
});
