// @vitest-environment node
import { edge as live } from "#api/edge/live.server";
import { edge as mock, MOCK_BANNER } from "#mock/edge.server";
import { displayCookie } from "#shell/server/root.server";

describe("mock and live never share state", () => {
  it("use different session cookies, app cookies and storage keys", () => {
    expect(live.sessionCookie).toBe("sneakers_sid");
    expect(mock.sessionCookie).toBe("mock_sneakers_sid");
    expect(mock.cookiePrefix).not.toBe(live.cookiePrefix);
    expect(mock.storagePrefix).toBe("mock:");
    expect(live.storagePrefix).toBe("");
    expect(displayCookie()).toBe("mock_sneakers_display");
  });

  it("only the mock edge carries the banner", () => {
    expect(mock.banner).toBe(MOCK_BANNER);
    expect(live.banner).toBeNull();
  });

  it("the mock gateway lives on a name that can never resolve", () => {
    expect(new URL(mock.gatewayUrl).hostname.endsWith(".invalid")).toBe(true);
  });
});
