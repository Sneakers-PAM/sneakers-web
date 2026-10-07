import { renderToString } from "react-dom/server";
import { type EntryContext, ServerRouter } from "react-router";

// SPA mode: this only runs once, at build time, to prerender the static fallback shell
// that osadmin serves for every route. There is no runtime Node server.
export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
): Response {
  const html = renderToString(<ServerRouter context={routerContext} url={request.url} />);
  responseHeaders.set("Content-Type", "text/html");
  return new Response(`<!DOCTYPE html>${html}`, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
