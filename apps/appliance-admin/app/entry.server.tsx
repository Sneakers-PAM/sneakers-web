// SPA mode: this only runs once, at build time, to prerender the static fallback shell that
// osadmin serves for every route. There is no runtime Node server. It has to be the streaming
// render (all of it, as the shell's handler does in SPA mode): renderToString can't emit the
// script that closes React Router's hydration stream, so the browser never hydrated.
export { handleRequest as default, streamTimeout } from "@sneakers-web/shell/server";
