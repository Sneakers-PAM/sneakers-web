import { getCsrf } from "#api/csrf";
import { ApiError, NetworkError } from "#api/errors";
import { createLogger } from "#api/log";

const log = createLogger("http");

export interface SessionEvents {
  /** The session is only half signed in: MFA is enforced and no factor is verified yet. */
  onMfaRequired?: () => void;
  /** The gateway rejected the session (expired, signed out elsewhere, factor removed). */
  onUnauthenticated?: () => void;
}

let events: SessionEvents = {};

export interface RequestOptions {
  body?: unknown;
  /** Send the CSRF header (every call made for a signed-in user). */
  csrf?: boolean;
  method?: "GET" | "POST";
  /** Don't raise the session events on 401/403 (the login calls expect them). */
  quietAuth?: boolean;
  signal?: AbortSignal;
}

/**
 * Call a gateway HTTP route on the app's own origin, with the session cookie. JSON in and
 * out. Throws ApiError for a non-2xx answer and NetworkError when the call never landed.
 * Logs the target, duration and outcome; never the body.
 */
export const requestJson = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.csrf) headers["X-CSRF-Token"] = getCsrf();
  const started = performance.now();
  log.debug("request", { method, path });
  let res: Response;
  try {
    res = await fetch(path, {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: "include",
      headers,
      method,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    log.warn("request failed to reach the gateway", {
      method,
      ms: Math.round(performance.now() - started),
      path,
    });
    throw new NetworkError(error);
  }
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
  }
  if (!res.ok) {
    const code =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : undefined;
    log.info("request rejected", { code, method, ms, path, status: res.status });
    if (!options.quietAuth) {
      if (res.status === 401) events.onUnauthenticated?.();
      if (res.status === 403 && code === "mfa_required") events.onMfaRequired?.();
    }
    throw new ApiError(res.status, code);
  }
  log.debug("request done", { method, ms, path, status: res.status });
  return data as T;
};

export const sessionEvents = (): SessionEvents => {
  return events;
};

/** The auth layer registers here to hear about a dead session from any request. */
export const setSessionEvents = (next: SessionEvents): void => {
  events = next;
};
