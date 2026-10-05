import type { LoaderFunctionArgs } from "react-router";

import { createLogger, DiagnosticsDocument } from "@sneakers-web/api-client";

import type { DiagnosticsData } from "#shell/diagnostics/report";

import { gatewayFor } from "#shell/server/gateway.server";
import { sessionFor } from "#shell/server/session.server";

const log = createLogger("diagnostics");

/**
 * resources/diagnostics: this app's build and, for a signed-in user, the gateway's
 * diagnostics query. It never fails: signed out or with the gateway down, the gateway part is
 * null and Copy diagnostics still reports the page and the app.
 */
export const diagnosticsLoader =
  (app: string) =>
  async ({ request }: LoaderFunctionArgs): Promise<Response> => {
    const body: DiagnosticsData = {
      app: { commit: __APP_COMMIT__, name: app, version: __APP_VERSION__ },
      gateway: null,
    };
    try {
      const session = await sessionFor(request);
      if (session.authenticated && session.userId && !session.enrollmentRequired) {
        const answer = await gatewayFor(request).gql(DiagnosticsDocument);
        body.gateway = answer.diagnostics;
      }
    } catch (error) {
      log.debug("gateway diagnostics not read", {
        error: error instanceof Error ? error.name : "unknown",
      });
    }
    log.debug("diagnostics served", { gateway: body.gateway !== null });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  };
