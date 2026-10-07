import { afterEach, describe, expect, it, vi } from "vitest";

import { readExpiringItem, writeExpiringItem } from "#ui/lib/client";

describe("readExpiringItem / writeExpiringItem", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads back a value written for the same key", () => {
    writeExpiringItem("k", { minimized: true });
    expect(readExpiringItem<{ minimized: boolean }>("k")).toEqual({ minimized: true });
  });

  it("returns null for a key that was never written", () => {
    expect(readExpiringItem("missing")).toBeNull();
  });

  it("returns null once the default 30-day ttl has passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    writeExpiringItem("k", true);
    vi.setSystemTime(30 * 24 * 60 * 60 * 1000 + 1);
    expect(readExpiringItem("k")).toBeNull();
  });

  it("still reads the value one millisecond before a custom ttl expires", () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    writeExpiringItem("k", true, 1000);
    vi.setSystemTime(999);
    expect(readExpiringItem("k")).toBe(true);
  });

  it("returns null for malformed JSON instead of throwing", () => {
    localStorage.setItem("k", "not json");
    expect(readExpiringItem("k")).toBeNull();
  });
});
