import { render, screen } from "@testing-library/react";

import type { SecretVersion } from "@/features/secret/secret.server";

import { HistoryCard } from "@/features/secret/HistoryCard";

const version = (overrides: Partial<SecretVersion>): SecretVersion =>
  ({
    active: false,
    changedFieldKeys: [],
    changeLabel: null,
    createdAt: "2026-10-01T00:00:00Z",
    createdBy: "u1",
    createdByName: "Ada",
    fieldKeys: [],
    versionNo: 1,
    ...overrides,
  }) as SecretVersion;

describe("HistoryCard", () => {
  it("shows a type change's own label instead of the generic Changed: <field> text", () => {
    const label =
      "Type changed: Password -> Password Account (SSH); added host; fields carried over: username, password";
    render(
      <HistoryCard
        recovery={false}
        type={null}
        versions={[
          version({ active: true, changedFieldKeys: ["host"], changeLabel: label, versionNo: 2 }),
          version({ fieldKeys: ["username", "password"], versionNo: 1 }),
        ]}
        viewerId="u1"
      />,
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.queryByText(/^Changed: host$/)).not.toBeInTheDocument();
  });

  it("falls back to the changed-field-keys text when a version carries no change label", () => {
    render(
      <HistoryCard
        recovery={false}
        type={null}
        versions={[
          version({ active: true, changedFieldKeys: ["password"], versionNo: 2 }),
          version({ fieldKeys: ["password"], versionNo: 1 }),
        ]}
        viewerId="u1"
      />,
    );
    expect(screen.getByText("Changed: password")).toBeInTheDocument();
  });
});
