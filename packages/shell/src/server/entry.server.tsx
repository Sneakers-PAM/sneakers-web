import { createReadableStreamFromReadable } from "@react-router/node";
import { createLogger } from "@sneakers-web/api-client";
import { isbot } from "isbot";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { type EntryContext, ServerRouter } from "react-router";

import { NonceContext } from "#shell/root/nonce";
import { contentSecurityPolicy, newNonce } from "#shell/server/csp.server";

const log = createLogger("render");

export const streamTimeout = 5000;

/**
 * Render a page on the server. Bots and crawlers get the whole document at once; browsers
 * get it streamed as soon as the shell is ready.
 */
export const handleRequest = (
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Promise<Response> =>
  new Promise((resolve, reject) => {
    let shellRendered = false;
    const ready =
      isbot(request.headers.get("user-agent") ?? "") || routerContext.isSpaMode
        ? "onAllReady"
        : "onShellReady";
    // The SPA prerender (the appliance admin, at build time) has no response to set a header on;
    // osadmin sets its own policy. The dev server's own inline scripts carry no nonce.
    const { DEV: development } = import.meta.env;
    const nonce = routerContext.isSpaMode || development ? undefined : newNonce();
    const { abort, pipe } = renderToPipeableStream(
      <NonceContext.Provider value={nonce}>
        <ServerRouter context={routerContext} nonce={nonce} url={request.url} />
      </NonceContext.Provider>,
      {
        nonce,
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered)
            log.error("render failed", { error: error instanceof Error ? error.name : "unknown" });
        },
        onShellError(error: unknown) {
          reject(error);
        },
        [ready]() {
          shellRendered = true;
          const body = new PassThrough();
          responseHeaders.set("Content-Type", "text/html");
          responseHeaders.set("X-Content-Type-Options", "nosniff");
          responseHeaders.set("Referrer-Policy", "same-origin");
          responseHeaders.set("X-Frame-Options", "DENY");
          if (nonce) responseHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce));
          resolve(
            new Response(createReadableStreamFromReadable(body), {
              headers: responseHeaders,
              status: responseStatusCode,
            }),
          );
          pipe(body);
        },
      },
    );
    setTimeout(abort, streamTimeout + 1000);
  });
