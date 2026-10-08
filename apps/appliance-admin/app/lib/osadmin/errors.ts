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

/** A Connect error detail: its proto type and, when the server has it, the JSON form. */
export interface ErrorDetail {
  debug?: unknown;
  type: string;
}

export class OsadminError extends Error {
  readonly code: ConnectCode;
  readonly details: ErrorDetail[];
  /** The go-apperr symbol, such as ACCESS_STEPUP_REQUIRED, when the message names one. */
  readonly symbol?: string;

  constructor(code: ConnectCode, message: string, symbol?: string, details: ErrorDetail[] = []) {
    super(message);
    this.name = "OsadminError";
    this.code = code;
    this.symbol = symbol ?? symbolOf(message);
    this.details = details;
  }
}

const SYMBOL_PATTERN = /\b([A-Z]+_[A-Z_]+)\b/;

/** The go-apperr symbol a message names, such as UPGRADE_SIGNATURE, if any. */
export const symbolOf = (message: string): string | undefined => SYMBOL_PATTERN.exec(message)?.[1];

export const parseOsadminError = async (response: Response): Promise<OsadminError> => {
  let code: ConnectCode = "unknown";
  let message = `osadmin answered ${String(response.status)}`;
  let details: ErrorDetail[] = [];
  try {
    const body = (await response.json()) as {
      code?: string;
      details?: ErrorDetail[];
      message?: string;
    };
    if (body.code) code = body.code as ConnectCode;
    if (body.message) message = body.message;
    if (Array.isArray(body.details)) details = body.details;
  } catch {
    // Not JSON (a network or proxy error page): keep the status-based message.
  }
  return new OsadminError(code, message, symbolOf(message), details);
};

/** True when the error means the page's backend isn't live on this box yet. */
export const isNotAvailable = (error: unknown): boolean =>
  error instanceof OsadminError && error.code === "unimplemented";

/** True when the error is the step-up refusal (ACCESS_STEPUP_REQUIRED). */
export const isStepUpRequired = (error: unknown): boolean =>
  error instanceof OsadminError &&
  error.code === "permission_denied" &&
  error.symbol === "ACCESS_STEPUP_REQUIRED";

const VALIDATION_REPORT = "sneakers.appliance.osadmin.v1.ValidationReport";

/** The checks a refused certificate upload carries (a ValidationReport detail), if any. */
export const validationChecksOf = (
  error: unknown,
): { detail: string; name: string; passed: boolean }[] => {
  if (!(error instanceof OsadminError)) return [];
  const report = error.details.find((d) => d.type === VALIDATION_REPORT)?.debug as
    | { checks?: { detail?: string; name?: string; passed?: boolean }[] }
    | undefined;
  return (report?.checks ?? []).map((c) => ({
    detail: c.detail ?? "",
    name: c.name ?? "",
    passed: c.passed ?? false,
  }));
};

/** The sentence after a coded error's symbol: "TLS_NAMES (3806): covers..." gives "covers...". */
export const reasonOf = (error: unknown): string => {
  if (!(error instanceof Error)) return "Something went wrong.";
  const match = /^[A-Z]+_[A-Z_]+(?: \(\d+\))?: (.*)$/s.exec(error.message);
  return match?.[1] ?? error.message;
};
