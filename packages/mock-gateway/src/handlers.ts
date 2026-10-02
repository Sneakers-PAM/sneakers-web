import { http, HttpResponse } from "msw";

import { authHandlers } from "#mock/handlers/auth";
import { api, shellHandlers } from "#mock/handlers/graphql";

/**
 * Catch-alls for every gateway route the fixtures don't answer. They fail loudly, so a
 * request in mock mode never goes past the mock to a real server.
 */
const notMocked = [
  api.operation(({ operationName }) =>
    HttpResponse.json({
      errors: [
        { message: `rpc error: code = Unimplemented desc = mock gateway has no ${operationName}` },
      ],
    }),
  ),
  ...["/auth/*", "/setup/*", "/oauth2/*", "/machine/*", "/graphql"].map((path) =>
    http.all(path, () => HttpResponse.json({ error: "not_mocked" } as never, { status: 501 })),
  ),
];

/** Every request the mock gateway answers. */
export const handlers = [...authHandlers, ...shellHandlers, ...notMocked];
