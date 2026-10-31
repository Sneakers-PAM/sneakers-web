import { describe, expect, it } from "vitest";

import type { BrowseSecret } from "@/features/browse/types";

import { heartbeatOf } from "@/features/browse/heartbeat";

describe("heartbeatOf", () => {
  it("keeps an untrusted certificate apart from unreachable", () => {
    const row = { lastHeartbeatResult: "untrustedCertificate", targetId: "t1" } as BrowseSecret;
    expect(heartbeatOf(row)).toBe("untrusted");
  });
});
