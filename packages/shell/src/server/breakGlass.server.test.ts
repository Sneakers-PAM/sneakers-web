// @vitest-environment node
import { BreakGlassOpenDocument } from "@sneakers-web/api-client";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { breakGlassExitAction } from "#shell/server/breakGlass.server";
import { frameData } from "#shell/server/frame.server";
import { requireUser } from "#shell/server/session.server";

withMockGateway();

const breakGlassAt = async (path: string, cookie: string) => {
  const frame = await frameData(appRequest(path, { cookie }));
  return frame.breakGlass;
};

const open = async (cookie: string) => {
  const { gw } = await requireUser(appRequest("/", { cookie }));
  const d = await gw.gql(BreakGlassOpenDocument, { code: "481027", reason: "Owner unreachable" });
  return d.openBreakGlassSession;
};

describe("break-glass mode in the frame", () => {
  it("is off until a site admin opens a session, then every page's frame carries it", async () => {
    const cookie = sessionCookie("mock-user-alice");
    expect(await breakGlassAt("/", cookie)).toBeNull();
    const session = await open(cookie);
    const frame = await frameData(appRequest("/browse", { cookie }));
    expect(frame.breakGlass).toMatchObject({ id: session.id, reason: "Owner unreachable" });
  });

  it("stays off for someone who can't break glass", async () => {
    const cookie = sessionCookie("mock-user-bob");
    expect(await breakGlassAt("/", cookie)).toBeNull();
  });

  it("is bound to the web session it was opened in", async () => {
    await open(sessionCookie("mock-user-alice"));
    const other = sessionCookie("mock-user-alice");
    expect(await breakGlassAt("/", other)).toBeNull();
  });

  it("exits through the banner's action and returns to the normal app", async () => {
    const cookie = sessionCookie("mock-user-alice");
    const session = await open(cookie);
    const request = appRequest("/resources/break-glass", {
      body: form({ id: session.id }),
      cookie,
      method: "POST",
    });
    const response = (await breakGlassExitAction({
      context: {},
      params: {},
      request,
    } as never)) as Response;
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/");
    expect(await breakGlassAt("/", cookie)).toBeNull();
  });
});
