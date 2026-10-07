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

/** One Connect error detail: the type name, the binary value (base64) and, when the server
 * has the type's descriptor, its JSON form as `debug`. */
export interface ConnectErrorDetail {
  debug?: Record<string, unknown>;
  type: string;
  value: string;
}

export class OsadminError extends Error {
  readonly code: ConnectCode;
  readonly details: ConnectErrorDetail[];
  /** The go-apperr symbol, such as ACCESS_STEPUP_REQUIRED, when the message names one. */
  readonly symbol?: string;

  constructor(
    code: ConnectCode,
    message: string,
    symbol?: string,
    details: ConnectErrorDetail[] = [],
  ) {
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
  let details: ConnectErrorDetail[] = [];
  try {
    const body = (await response.json()) as {
      code?: string;
      details?: ConnectErrorDetail[];
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

/** What a refused sign-in, step-up or one-time code says happens next (SignInRefusal). */
export interface SignInRefusal {
  /** Tries left before the account locks; 0 when it's locked or the source is throttled. */
  attemptsLeft: number;
  lockedUntil?: string;
  /** Locked until an owner unlocks it. */
  lockedUntilUnlocked: boolean;
  /** When this source may try again, while it's throttled. */
  retryAfter?: string;
}

const REFUSAL_TYPE = "sneakers.appliance.osadmin.v1.SignInRefusal";

const base64Bytes = (value: string): Uint8Array =>
  Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));

/** Reads protobuf wire-format fields: field number to its varints or length-delimited bytes. */
const readFields = (bytes: Uint8Array): Map<number, bigint | Uint8Array> => {
  const fields = new Map<number, bigint | Uint8Array>();
  let at = 0;
  const varint = (): bigint => {
    let result = 0n;
    let shift = 0n;
    for (;;) {
      const byte = bytes[at++] ?? 0;
      result |= BigInt(byte & 0x7f) << shift;
      if (byte < 0x80 || at >= bytes.length) return result;
      shift += 7n;
    }
  };
  while (at < bytes.length) {
    const tag = Number(varint());
    const field = tag >> 3;
    if ((tag & 7) === 0) fields.set(field, varint());
    else if ((tag & 7) === 2) {
      const length = Number(varint());
      fields.set(field, bytes.slice(at, at + length));
      at += length;
    } else break;
  }
  return fields;
};

const timestampOf = (value: bigint | Uint8Array | undefined): string | undefined => {
  if (!(value instanceof Uint8Array)) return undefined;
  const inner = readFields(value);
  const seconds = Number((inner.get(1) as bigint | undefined) ?? 0n);
  const nanos = Number((inner.get(2) as bigint | undefined) ?? 0n);
  return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
};

/** The SignInRefusal detail of a refused call, from its JSON debug form or its binary value. */
export const refusalOf = (error: unknown): SignInRefusal | undefined => {
  if (!(error instanceof OsadminError)) return undefined;
  const detail = error.details.find((d) => d.type === REFUSAL_TYPE);
  if (!detail) return undefined;
  if (detail.debug) {
    const debug = detail.debug as Partial<Record<keyof SignInRefusal, unknown>>;
    return {
      attemptsLeft: Number(debug.attemptsLeft ?? 0),
      lockedUntil: debug.lockedUntil as string | undefined,
      lockedUntilUnlocked: debug.lockedUntilUnlocked === true,
      retryAfter: debug.retryAfter as string | undefined,
    };
  }
  try {
    const fields = readFields(base64Bytes(detail.value));
    return {
      attemptsLeft: Number((fields.get(1) as bigint | undefined) ?? 0n),
      lockedUntil: timestampOf(fields.get(2)),
      lockedUntilUnlocked: fields.get(3) === 1n,
      retryAfter: timestampOf(fields.get(4)),
    };
  } catch {
    return undefined;
  }
};
