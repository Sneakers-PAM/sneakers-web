// Connect error handling. A Connect JSON error response is `{ code, message, details? }`
// with a lower-snake-case code (the Connect RPC protocol's error end-stream shape).
// Two codes carry their own meaning for this app: `unimplemented` means a page's backend
// isn't on the box yet ("Not available in this release"), and `permission_denied` whose
// message names ACCESS_STEPUP_REQUIRED means the session needs a fresh sign-in.

export type ConnectCode =
  | "aborted"
  | "already_exists"
  | "cancelled"
  | "data_loss"
  | "deadline_exceeded"
  | "failed_precondition"
  | "internal"
  | "invalid_argument"
  | "not_found"
  | "out_of_range"
  | "permission_denied"
  | "resource_exhausted"
  | "unauthenticated"
  | "unavailable"
  | "unimplemented"
  | "unknown";

export class OsadminError extends Error {
  readonly code: ConnectCode;
  /** The go-apperr symbol, such as ACCESS_STEPUP_REQUIRED, when the message names one. */
  readonly symbol?: string;

  constructor(code: ConnectCode, message: string, symbol?: string) {
    super(message);
    this.name = "OsadminError";
    this.code = code;
    this.symbol = symbol;
  }
}

const SYMBOL_PATTERN = /\b([A-Z]+_[A-Z_]+)\b/;

export const parseOsadminError = async (response: Response): Promise<OsadminError> => {
  let code: ConnectCode = "unknown";
  let message = `osadmin answered ${String(response.status)}`;
  try {
    const body = (await response.json()) as { code?: string; message?: string };
    if (body.code) code = body.code as ConnectCode;
    if (body.message) message = body.message;
  } catch {
    // Not JSON (a network or proxy error page): keep the status-based message.
  }
  const symbol = SYMBOL_PATTERN.exec(message)?.[1];
  return new OsadminError(code, message, symbol);
};

/** True when the error means the page's backend isn't live on this box yet. */
export const isNotAvailable = (error: unknown): boolean =>
  error instanceof OsadminError && error.code === "unimplemented";

/** True when the error is the step-up refusal (ACCESS_STEPUP_REQUIRED). */
export const isStepUpRequired = (error: unknown): boolean =>
  error instanceof OsadminError &&
  error.code === "permission_denied" &&
  error.symbol === "ACCESS_STEPUP_REQUIRED";
