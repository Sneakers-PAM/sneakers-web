import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SecretPage } from "@/features/secret/secret.server";

import { DetailsRows } from "@/features/secret/DetailsCard";

const REASON =
  "untrusted certificate: the certificate for dc01.example.org is signed by Example CA, which isn't in the trusted CA list";

const page = (secret: Partial<SecretPage["secret"]>) =>
  ({
    now: Date.parse("2026-10-31T12:00:00Z"),
    secret: { typeId: "ad", ...secret },
    target: { id: "t1" },
    type: { heartbeat: true, name: "Active Directory" },
  }) as unknown as SecretPage;

describe("the heartbeat line", () => {
  it("names an untrusted certificate and says why", () => {
    render(
      <DetailsRows
        page={page({ lastHeartbeatDetail: REASON, lastHeartbeatResult: "untrustedCertificate" })}
      />,
    );
    expect(screen.getByText("Untrusted certificate")).toBeInTheDocument();
    expect(screen.getByText(REASON)).toBeInTheDocument();
    expect(screen.queryByText("Unreachable")).not.toBeInTheDocument();
  });

  it("shows no reason for a check that passed", () => {
    render(
      <DetailsRows page={page({ lastHeartbeatDetail: "bound", lastHeartbeatResult: "ok" })} />,
    );
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByText("bound")).not.toBeInTheDocument();
  });
});
