/* eslint-disable testing-library/no-container, testing-library/no-node-access -- these check the drawn SVG and the absence of an element, which have no accessible role to query. */
import { render, screen } from "@testing-library/react";

import {
  GrantPill,
  HeartbeatPill,
  HighlySensitiveBadge,
  Pill,
  RequestPill,
  RotationPill,
} from "#ui/components/Pill";

describe("Pill", () => {
  it("never breaks its label mid-word, so it wraps as a whole pill onto a new line", () => {
    render(<Pill tone="primary">Non-owners need approval</Pill>);
    expect(screen.getByText("Non-owners need approval")).toHaveClass("whitespace-nowrap");
  });
});

describe("status pills", () => {
  it.each([
    ["verified", "Verified"],
    ["drift", "Drift"],
    ["unreachable", "Unreachable"],
    ["unknown", "Unknown"],
    ["none", "No target"],
  ] as const)("heartbeat %s reads as words, not colour alone", (status, label) => {
    render(<HeartbeatPill status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText("Heartbeat:")).toHaveClass("sr-only");
  });

  it("spins only the rotating state, and stops with reduced motion", () => {
    const { container } = render(<RotationPill status="rotating" />);
    expect(container.querySelector("svg")).toHaveClass(
      "animate-spin-slow",
      "motion-reduce:animate-none",
    );
  });

  it("strikes through a revoked grant", () => {
    render(<GrantPill status="revoked" />);
    expect(screen.getByText("Revoked")).toHaveClass("line-through");
  });

  it("names request states", () => {
    render(
      <>
        <RequestPill status="pending" />
        <RequestPill status="approved" />
        <RequestPill status="denied" />
      </>,
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.getByText("Denied")).toBeInTheDocument();
  });
});

describe("HighlySensitiveBadge", () => {
  it("reads as clear words, not the raw field name, and explains itself on hover", () => {
    render(<HighlySensitiveBadge />);
    const badge = screen.getByText("Highly sensitive");
    expect(badge).toBeInTheDocument();
    expect(screen.queryByText("super-sensitive")).toBeNull();
    expect(badge).toHaveAttribute("title", expect.stringContaining("second factor"));
  });
});
