// @vitest-environment node
import { appRequest, withMockGateway } from "@sneakers-web/mock-gateway/testing";

import { rootLoader } from "#shell/server/root.server";

withMockGateway();

const boxPoller = async (): Promise<boolean> => {
  const data = await rootLoader({
    context: {},
    params: {},
    request: appRequest("/sign-in"),
  } as never);
  return data.boxPoller;
};

describe("the root loader's box-state poller switch", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is on when APPLIANCE_BOX_POLLER is true", async () => {
    vi.stubEnv("APPLIANCE_BOX_POLLER", "true");
    expect(await boxPoller()).toBe(true);
  });

  it("is off when APPLIANCE_BOX_POLLER is unset or anything but true", async () => {
    vi.stubEnv("APPLIANCE_BOX_POLLER", "");
    expect(await boxPoller()).toBe(false);
    vi.stubEnv("APPLIANCE_BOX_POLLER", "1");
    expect(await boxPoller()).toBe(false);
  });
});
