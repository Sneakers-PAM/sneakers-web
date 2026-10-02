import { createReadableStreamFromReadable } from "@react-router/node";
import { createLogger } from "@sneakers-web/api-client";
import { isbot } from "isbot";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { type EntryContext, ServerRouter } from "react-router";

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
    const { abort, pipe } = renderToPipeableStream(
      <ServerRouter context={routerContext} url={request.url} />,
      {
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
