// @vitest-environment node
import { displayAction } from "#shell/server/resources.server";
import { appRequest, form } from "#shell/test/mockGateway";

const save = async (headers: Record<string, string> = {}) => {
  // Plain http, as the app server sees a request after the ingress has terminated TLS. The
  // protocol is set after parsing because the lint autofix rewrites http literals to https.
  const url = new URL("https://app.example.invalid/resources/display");
  url.protocol = "http:";
  const request = appRequest(url.href, {
    body: form({ settings: JSON.stringify({ theme: "dark" }) }),
    headers,
    method: "POST",
  });
  const result = (await displayAction({
    context: {},
    params: {},
    request,
  } as never)) as unknown as {
    init: { headers: Record<string, string> };
  };
  return result.init.headers["Set-Cookie"] ?? "";
};

describe("displayAction", () => {
  it("saves the display settings in the edge's own cookie", async () => {
    const cookie = await save();
    expect(cookie).toMatch(/^mock_sneakers_display=/);
    expect(decodeURIComponent(cookie)).toContain('"theme":"dark"');
    expect(cookie).not.toContain("Secure");
  });

  it("marks the cookie Secure behind a TLS-terminating proxy", async () => {
    expect(await save({ "X-Forwarded-Proto": "https" })).toContain("; Secure");
  });
});
