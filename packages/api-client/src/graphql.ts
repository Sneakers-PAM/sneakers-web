import { GraphQLRequestError } from "#api/errors";
import { requestJson } from "#api/http";
import { createLogger } from "#api/log";

const log = createLogger("graphql");

/** What the generated documents look like: the query text plus its result and variable types. */
export interface TypedDocument<TResult, TVariables> {
  __apiType?: (variables: TVariables) => TResult;
  toString(): string;
}

type VariablesArgument<V> = keyof V extends never ? [variables?: V] : [variables: V];

/**
 * Run one GraphQL operation against the gateway's /graphql, as the signed-in user.
 * Errors in the response become a GraphQLRequestError; there is no retry or fallback here,
 * the caller shows the error.
 */
export const gql = async <TResult, TVariables>(
  document: TypedDocument<TResult, TVariables>,
  ...[variables]: VariablesArgument<TVariables>
): Promise<TResult> => {
  const query = document.toString();
  const name = operationName(query);
  const body = await requestJson<{ data?: TResult; errors?: { message: string }[] }>("/graphql", {
    body: { operationName: name, query, variables: variables ?? {} },
    csrf: true,
    method: "POST",
  });
  if (body.errors?.length) {
    const error = new GraphQLRequestError(body.errors.map((e) => e.message));
    log.info("operation returned errors", { grpc: error.grpcCode ?? "none", operation: name });
    throw error;
  }
  log.trace("operation done", { operation: name });
  return body.data as TResult;
};

/** The name of the first operation in a document, for logs. */
const operationName = (document: string): string => {
  return /(?:query|mutation|subscription)\s+(\w+)/.exec(document)?.[1] ?? "anonymous";
};
