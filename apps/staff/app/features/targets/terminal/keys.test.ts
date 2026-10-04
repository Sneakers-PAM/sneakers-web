import { platformOf, shortcutFor } from "@/features/targets/terminal/keys";

const press = (
  key: string,
  mods: Partial<Record<"alt" | "ctrl" | "meta" | "shift", boolean>> = {},
) => ({
  altKey: !!mods.alt,
  ctrlKey: !!mods.ctrl,
  key,
  metaKey: !!mods.meta,
  shiftKey: !!mods.shift,
});

describe("terminal shortcuts", () => {
  it("uses Command on macOS and Ctrl elsewhere", () => {
    expect(platformOf("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)")).toBe("mac");
    expect(platformOf("Mozilla/5.0 (X11; Linux x86_64)")).toBe("other");
    expect(shortcutFor(press("c", { meta: true }), "mac")).toBe("copy");
    expect(shortcutFor(press("C", { ctrl: true, shift: true }), "other")).toBe("copy");
    expect(shortcutFor(press("=", { ctrl: true }), "other")).toBe("bigger");
    expect(shortcutFor(press("-", { meta: true }), "mac")).toBe("smaller");
    expect(shortcutFor(press("F", { meta: true, shift: true }), "mac")).toBe("fullscreen");
    expect(shortcutFor(press("R", { ctrl: true, shift: true }), "other")).toBe("reconnect");
  });

  it("leaves Ctrl-C and plain keys to the shell", () => {
    expect(shortcutFor(press("c", { ctrl: true }), "other")).toBeNull();
    expect(shortcutFor(press("c", { ctrl: true }), "mac")).toBeNull();
    expect(shortcutFor(press("r"), "other")).toBeNull();
  });
});
