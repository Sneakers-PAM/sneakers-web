import {
  ApiError,
  GatewayUnreachableError,
  type GraphQLErrorItem,
  GraphQLRequestError,
} from "#api/errors";
import { createLogger } from "#api/log";

const log = createLogger("gateway");

export interface GatewayOptions {
  /** Where the gateway answers, seen from this server (the cluster service in production). */
  baseUrl: string;
  /** The browser's Cookie header. */
  cookieHeader: null | string;
  fetch?: typeof fetch;
  /** The only cookie forwarded: the gateway's session cookie for this edge. */
  sessionCookie: string;
}

export interface RequestOptions {
  body?: unknown;
  /** Send the CSRF header (every call made for a signed-in user). */
  csrf?: boolean;
  method?: "GET" | "POST";
}

/** What the generated documents look like: the query text plus its result and variable types. */
export interface TypedDocument<TResult, TVariables> {
  __apiType?: (variables: TVariables) => TResult;
  toString(): string;
}

// Operations whose variables are all optional (or that take none) can be called without them.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type VariablesArgument<V> = {} extends V ? [variables?: V] : [variables: V];

const operationName = (document: string): string =>
  /(?:mutation|query|subscription)\s+(\w+)/.exec(document)?.[1] ?? "anonymous";

/** The value of one cookie in a Cookie header. */
export const readCookie = (header: null | string, name: string): null | string => {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};

/**
 * One request's view of the gateway, used by loaders and actions on the server. It sends
 * only the session cookie (never the browser's other cookies), adds the CSRF token the
 * gateway issued, and collects any Set-Cookie the gateway answers with so the route can
 * pass it back to the browser.
 */
export class GatewayClient {
  readonly setCookies: string[] = [];
  get hasSessionCookie(): boolean {
    return !!this.sid;
  }
  private csrf = "";
  private readonly fetcher: typeof fetch;
  private readonly options: GatewayOptions;

  private sid: null | string;

  constructor(options: GatewayOptions) {
    this.options = options;
    this.fetcher = options.fetch ?? fetch;
    this.sid = readCookie(options.cookieHeader, options.sessionCookie);
  }

  /** Run one GraphQL operation as the signed-in user. Errors become a GraphQLRequestError. */
  async gql<TResult, TVariables>(
    document: TypedDocument<TResult, TVariables>,
    ...[variables]: VariablesArgument<TVariables>
  ): Promise<TResult> {
    const query = document.toString();
    const name = operationName(query);
    const body = await this.request<{ data?: TResult; errors?: GraphQLErrorItem[] }>("/graphql", {
      body: { operationName: name, query, variables: variables ?? {} },
      csrf: true,
    });
    if (body.errors?.length) {
      const error = new GraphQLRequestError(body.errors);
      log.info("operation refused", { code: error.code, operation: name, reason: error.reason });
      throw error;
    }
    log.trace("operation done", { operation: name });
    return body.data as TResult;
  }

  /** JSON over HTTP to one gateway route. Logs the target, duration and outcome, never the body. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = options.method ?? (options.body === undefined ? "GET" : "POST");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.csrf) headers["X-CSRF-Token"] = this.csrf;
    if (this.sid) headers.Cookie = `${this.options.sessionCookie}=${encodeURIComponent(this.sid)}`;
    const started = performance.now();
    let response: Response;
    try {
      response = await this.fetcher(new URL(path, this.options.baseUrl), {
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        headers,
        method,
        redirect: "manual",
      });
    } catch (error) {
      log.warn("gateway unreachable", {
        method,
        ms: Math.round(performance.now() - started),
        path,
      });
      throw new GatewayUnreachableError(error);
    }
    this.absorbCookies(response);
    const ms = Math.round(performance.now() - started);
    const text = await response.text();
    let data: unknown;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = undefined;
      }
    }
    if (!response.ok) {
      const code =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : undefined;
      log.info("gateway refused", { code, method, ms, path, status: response.status });
      throw new ApiError(response.status, code);
    }
    log.debug("gateway answered", { method, ms, path, status: response.status });
    return data as T;
  }

  setCsrf(token: string): void {
    this.csrf = token;
  }

  /** Keep the session the gateway just set or cleared, for this request and the browser. */
  private absorbCookies(response: Response): void {
    const cookies = response.headers.getSetCookie?.() ?? [];
    for (const c of cookies) {
      this.setCookies.push(c);
      const [pair] = c.split(";");
      const [name, ...rest] = (pair ?? "").split("=");
      if (name?.trim() !== this.options.sessionCookie) continue;
      const value = rest.join("=");
      this.sid = value && !/max-age=-1|max-age=0\b/i.test(c) ? decodeURIComponent(value) : null;
    }
  }
}
