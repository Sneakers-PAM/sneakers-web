import { createLogger } from "@sneakers-web/api-client";
import { edge } from "@sneakers-web/edge.server";

await edge.start();
createLogger("server").info("ready", { edge: edge.mode, version: __APP_VERSION__ });

export { handleRequest as default, streamTimeout } from "@sneakers-web/shell/server";
