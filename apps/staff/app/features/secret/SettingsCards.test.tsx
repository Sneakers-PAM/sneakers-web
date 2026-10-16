import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";

import type { SecretPage, SecretType, SecretView } from "@/features/secret/secret.server";

import { AutomationCard } from "@/features/secret/SettingsCards";

const secret = (overrides: Partial<SecretView>): SecretView =>
  ({
    alwaysRequireApproval: false,
    canRead: true,
    expiresAt: null,
    folderId: "f1",
    heartbeatBlockedReason: null,
    heartbeatOptOut: false,
    id: "s1",
    lastAccessedAt: null,
    lastHeartbeatResult: null,
    lastRotationResult: null,
    name: "svc",
    nextRotationAt: null,
    requireTokenApproval: false,
    retired: false,
    retiredAt: "",
    rotatedAt: null,
    rotationIntervalDays: null,
    rotationOptOut: false,
    targetId: "t1",
    typeId: "type-ssh-key",
    verifiedAt: null,
    viewCount: null,
    ...overrides,
  }) as SecretView;

const heartbeatType = { heartbeat: true, rotation: false } as SecretType;

const defaultTarget = { name: "app01" };

const page = (overrides: Partial<SecretView>, target: { name: string } | null = defaultTarget) =>
  ({
    access: { approve: true, informed: true, manage: true, read: true, reveal: true },
    secret: secret(overrides),
    target,
    type: heartbeatType,
  }) as unknown as SecretPage;

const renderCard = (p: SecretPage) => {
  const Stub = createRoutesStub([
    {
      action: async () => ({ done: "ok", intent: "automation", ok: true as const }),
      Component: () => <AutomationCard page={p} />,
      id: "routes/test",
      index: true,
      path: "/",
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
};

describe("AutomationCard heartbeat readiness", () => {
  it("shows the hourly check when heartbeat is already on", () => {
    renderCard(page({ heartbeatOptOut: false }));
    expect(screen.getByText("Checks the login on app01 hourly")).toBeInTheDocument();
  });

  it("names a missing target when heartbeat is off and blocked", () => {
    renderCard(page({ heartbeatBlockedReason: "no target", heartbeatOptOut: true }, null));
    expect(screen.getByText("Needs a target to check against.")).toBeInTheDocument();
  });

  it("names a missing connection when heartbeat is off and blocked", () => {
    renderCard(page({ heartbeatBlockedReason: "no connection", heartbeatOptOut: true }));
    expect(screen.getByText("Needs the target's connection set up.")).toBeInTheDocument();
  });

  it("names a missing pinned host key when heartbeat is off and blocked", () => {
    renderCard(page({ heartbeatBlockedReason: "no pinned host key", heartbeatOptOut: true }));
    expect(screen.getByText("Needs the target's SSH host key pinned.")).toBeInTheDocument();
  });

  it("offers to switch heartbeat on when it's off but ready", () => {
    renderCard(page({ heartbeatBlockedReason: null, heartbeatOptOut: true }));
    expect(screen.getByText("Heartbeat available: switch it on.")).toBeInTheDocument();
  });

  it("disables the switch while heartbeat is blocked", () => {
    renderCard(page({ heartbeatBlockedReason: "no target", heartbeatOptOut: true }, null));
    expect(screen.getByRole("switch", { name: "Heartbeat validation" })).toBeDisabled();
  });

  it("leaves the switch enabled when heartbeat is off but ready", () => {
    renderCard(page({ heartbeatBlockedReason: null, heartbeatOptOut: true }));
    expect(screen.getByRole("switch", { name: "Heartbeat validation" })).toBeEnabled();
  });
});
