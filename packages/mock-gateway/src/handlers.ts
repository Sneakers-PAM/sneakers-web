import { http, HttpResponse } from "msw";

import { adminHandlers } from "#mock/admin/handlers";
import { authHandlers } from "#mock/handlers/auth";
import { api, shellHandlers } from "#mock/handlers/graphql";
import { stepUpHandlers } from "#mock/handlers/stepUp";
import { MOCK_GATEWAY_URL } from "#mock/state";

/**
 * Catch-alls for every gateway route the fixtures don't answer. They fail loudly, so a
 * request in mock mode never goes past the mock to a real server.
 */
const notMocked = [
  api.operation(({ operationName }) =>
    HttpResponse.json({
      errors: [
        {
          extensions: { code: "UNIMPLEMENTED" },
          message: `rpc error: code = Unimplemented desc = mock gateway has no ${operationName}`,
        },
      ],
    }),
  ),
  http.all(`${MOCK_GATEWAY_URL}/*`, () =>
    HttpResponse.json({ error: "not_mocked" } as never, { status: 501 }),
  ),
];

/** Every request the mock gateway answers. */
export const handlers = [
  ...authHandlers,
  ...stepUpHandlers,
  ...shellHandlers,
  ...adminHandlers,
  ...notMocked,
];
