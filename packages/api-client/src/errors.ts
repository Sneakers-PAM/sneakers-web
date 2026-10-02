/** gRPC status names the gateway passes through in GraphQL error text. */
export type GrpcCode =
  | "Aborted"
  | "AlreadyExists"
  | "Canceled"
  | "DataLoss"
  | "DeadlineExceeded"
  | "FailedPrecondition"
  | "Internal"
  | "InvalidArgument"
  | "NotFound"
  | "OutOfRange"
  | "PermissionDenied"
  | "ResourceExhausted"
  | "Unauthenticated"
  | "Unavailable"
  | "Unimplemented"
  | "Unknown";

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

/** A GraphQL operation came back with errors. */
export class GraphQLRequestError extends Error {
  readonly grpcCode: GrpcCode | undefined;
  readonly messages: string[];
  constructor(messages: string[]) {
    super(messages[0] ?? "The request failed.");
    this.name = "GraphQLRequestError";
    this.messages = messages;
    this.grpcCode = grpcCodeOf(messages[0] ?? "");
  }
}

/** The request never reached the gateway (offline, DNS, CORS, a dropped connection). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super("The server could not be reached.", { cause });
    this.name = "NetworkError";
  }
}

/**
 * Read the gRPC code from gateway error text such as
 * "rpc error: code = PermissionDenied desc = ...". Only the code is trusted; the text
 * after "desc =" is free-form and can change.
 */
export const grpcCodeOf = (message: string): GrpcCode | undefined => {
  const m = /code = ([A-Za-z]+)/.exec(message);
  return m ? (m[1] as GrpcCode) : undefined;
};
