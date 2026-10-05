/**
 * What the gateway attaches to a refused operation: the canonical gRPC code name
 * (FAILED_PRECONDITION), and when the service gave one, a stable reason
 * (CHECKOUT_LEASE_HELD) with its domain (sneakers.workflow) and metadata. `traceId` is the
 * request's trace, on every error while tracing is on.
 */
export interface ErrorExtensions {
  code?: string;
  domain?: string;
  metadata?: Record<string, string>;
  reason?: string;
  traceId?: string;
}

export interface GraphQLErrorItem {
  extensions?: ErrorExtensions;
  message: string;
}

/** An HTTP call to the gateway failed. `code` is the gateway's JSON error code when it sent one. */
export class ApiError extends Error {
  readonly code: string | undefined;
  readonly status: number;
  constructor(status: number, code: string | undefined, message?: string) {
    super(message ?? `Request failed (${status}${code ? `, ${code}` : ""})`);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** The gateway could not be reached at all (down, DNS, a dropped connection). */
export class GatewayUnreachableError extends Error {
  constructor(cause: unknown) {
    super("The server could not be reached.", { cause });
    this.name = "GatewayUnreachableError";
  }
}

/** A GraphQL operation came back with errors. Match on `code` and `reason`, never on the text. */
export class GraphQLRequestError extends Error {
  readonly code: string | undefined;
  readonly domain: string | undefined;
  readonly errors: GraphQLErrorItem[];
  readonly metadata: Record<string, string>;
  /** The GraphQL operation that was refused, when the caller named it. */
  readonly operation: string | undefined;
  readonly reason: string | undefined;
  readonly traceId: string | undefined;
  constructor(errors: GraphQLErrorItem[], operation?: string) {
    super(errors[0]?.message ?? "The request failed.");
    this.name = "GraphQLRequestError";
    this.errors = errors;
    this.operation = operation;
    const first = errors[0]?.extensions ?? {};
    this.code = first.code ?? legacyCode(errors[0]?.message ?? "");
    this.reason = first.reason;
    this.domain = first.domain;
    this.traceId = first.traceId;
    this.metadata = first.metadata ?? {};
  }
}

/**
 * Older gateways only put the code in the text ("rpc error: code = PermissionDenied desc = …").
 * Turn that into the canonical name so callers check one field.
 */
export const legacyCode = (message: string): string | undefined => {
  const m = /code = ([A-Za-z]+)/.exec(message);
  return m?.[1]?.replaceAll(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();
};

/** True when the error is the gateway refusing for the given stable reason. */
export const isRefusal = (error: unknown, reason: string): error is GraphQLRequestError =>
  error instanceof GraphQLRequestError && error.reason === reason;
