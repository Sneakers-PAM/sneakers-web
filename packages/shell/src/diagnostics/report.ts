import type { DiagnosticsQuery } from "@sneakers-web/api-client";

/** The appliance the product runs on, as the box gave it. */
export interface BoxEntry {
  baseOS: string;
  baseWeb: string;
  fqdn: string;
}

export interface ComponentEntry {
  commit: null | string;
  /** What the component reported about its own dependencies, when it did. */
  dependencies?: DependencyEntry[];
  name: string;
  status: string;
  version: null | string;
}

export interface DependencyEntry {
  error?: string;
  name: string;
  required: boolean;
  state: string;
  version?: string;
}

/** What the app server answers at resources/diagnostics. */
export interface DiagnosticsData {
  app: { commit: string; name: string; version: string };
  /** The gateway's diagnostics, or null when it couldn't be read (signed out, or down). */
  gateway: DiagnosticsQuery["diagnostics"] | null;
}

export interface DiagnosticsReport {
  app: DiagnosticsData["app"];
  /** The Base OS version, or "not appliance". */
  appliance: string;
  /** Null off the appliance. */
  box: BoxEntry | null;
  browser: string;
  gateway: ComponentEntry | null;
  generatedAt: null | string;
  page: { path: string; route: null | string };
  problem: null | Problem;
  /** The product release the install runs; null when it doesn't say. */
  product: null | string;
  publicUrl: null | string;
  services: ComponentEntry[];
  thirdParty: ComponentEntry[];
  time: { local: string; timeZone: string; utc: string };
  traceId: null | string;
  user: { id: string; roles: string[]; username: string } | null;
}

/** The problem a report is about: what the screen said and, for a refusal, what the gateway said. */
export interface Problem {
  code?: string;
  domain?: string;
  message?: string;
  operation?: string;
  reason?: string;
  traceId?: string;
}

export interface ReportInput {
  data: DiagnosticsData | null;
  now: Date;
  problem?: Problem;
  route?: string;
  timeZone: string;
  url: string;
  userAgent: string;
}

interface RawComponent extends Omit<ComponentEntry, "dependencies"> {
  dependencies?: null | readonly RawDependency[];
}

interface RawDependency {
  error?: null | string;
  name: string;
  required: boolean;
  state: string;
  version?: null | string;
}

const MAX_TEXT = 300;

const PATTERNS: [RegExp, string][] = [
  [/\bsnk_[A-Za-z0-9_-]+/g, "[redacted]"],
  [/\beyJ[\w-]*\.[\w-]*\.[\w-]*/g, "[redacted]"],
  [/\b(Bearer|Basic)\s+\S+/gi, "$1 [redacted]"],
  [
    /\b(sid|session|sessionid|cookie|csrf|token|password|passwd|secret|value|api[_-]?key)(\s*[=:]\s*)[^\s&;,]+/gi,
    "$1$2[redacted]",
  ],
  [/\b[\w-]*sid=[^\s&;,]+/gi, "[redacted]"],
];

/** A string with anything that looks like a credential replaced, cut to a sane length. */
export const scrub = (s: string): string => {
  let out = s;
  for (const [re, by] of PATTERNS) out = out.replace(re, by);
  return out.length > MAX_TEXT ? `${out.slice(0, MAX_TEXT)}…` : out;
};

const opt = (s: null | string | undefined): string | undefined =>
  s ? scrub(String(s)) : undefined;

const pathOf = (url: string): string => {
  try {
    return scrub(new URL(url, "https://app.invalid").pathname);
  } catch {
    return "/";
  }
};

const localTime = (now: Date, timeZone: string): string => {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).format(now);
  } catch {
    return now.toISOString();
  }
};

/** A git commit as a person reads it: the first 7 characters of a hash, anything else as it is. */
export const shortCommit = (commit: string): string =>
  /^[0-9a-f]{8,64}$/i.test(commit) ? commit.slice(0, 7) : commit;

const dependency = (d: RawDependency): DependencyEntry => {
  const out: DependencyEntry = { name: scrub(d.name), required: d.required, state: scrub(d.state) };
  if (d.error) out.error = scrub(d.error);
  if (d.version) out.version = scrub(d.version);
  return out;
};

const entry = (c: null | RawComponent | undefined): ComponentEntry | null => {
  if (!c) return null;
  const out: ComponentEntry = {
    commit: c.commit ? shortCommit(scrub(c.commit)) : null,
    name: scrub(c.name),
    status: scrub(c.status),
    version: c.version ? scrub(c.version) : null,
  };
  if (c.dependencies?.length) out.dependencies = c.dependencies.map((d) => dependency(d));
  return out;
};

const entries = (cs: null | readonly RawComponent[] | undefined): ComponentEntry[] =>
  (cs ?? []).map((c) => entry(c)).filter((c): c is ComponentEntry => c !== null);

const cleanProblem = (p: Problem | undefined): null | Problem => {
  if (!p) return null;
  const out: Problem = {
    code: opt(p.code),
    domain: opt(p.domain),
    message: opt(p.message),
    operation: opt(p.operation),
    reason: opt(p.reason),
    traceId: opt(p.traceId),
  };
  for (const k of Object.keys(out) as (keyof Problem)[]) if (out[k] === undefined) delete out[k];
  return Object.keys(out).length > 0 ? out : null;
};

/** The product line: "Sneakers <version>", once, at the top. */
export const productText = (version: null | string | undefined): string =>
  version ? `Sneakers ${version}` : "Sneakers (version unknown)";

const lower = (s: string): string => s.toLowerCase().replaceAll("_", " ");

const depText = (d: DependencyEntry): string => {
  const why = [d.error, d.required ? undefined : "optional"].filter(Boolean).join(", ");
  return `${d.name} ${lower(d.state)}${d.version ? ` ${d.version}` : ""}${why ? ` (${why})` : ""}`;
};

const line = (c: ComponentEntry): string => {
  const build = c.version ? `${c.version}${c.commit ? ` (${c.commit})` : ""}` : "";
  const head =
    c.status === "OK" ? build || "unknown" : [lower(c.status), build].filter(Boolean).join(", ");
  const deps = c.dependencies?.length
    ? `; ${c.dependencies.map((d) => depText(d)).join(", ")}`
    : "";
  return `  ${c.name}: ${head}${deps}`;
};

/**
 * Everything support needs to place a problem, as plain text with a JSON block. Only named
 * fields are copied, never a whole object, and every string goes through `scrub`, so a token,
 * cookie, session id or field value can't end up in the clipboard.
 */
export const buildReport = (input: ReportInput): { json: DiagnosticsReport; text: string } => {
  const g = input.data?.gateway ?? null;
  const json: DiagnosticsReport = {
    app: {
      commit: shortCommit(scrub(input.data?.app.commit ?? "unknown")),
      name: scrub(input.data?.app.name ?? "unknown"),
      version: scrub(input.data?.app.version ?? "unknown"),
    },
    appliance: g?.appliance ? scrub(g.appliance) : g?.box ? scrub(g.box.baseOS) : "not appliance",
    box: g?.box
      ? { baseOS: scrub(g.box.baseOS), baseWeb: scrub(g.box.baseWeb), fqdn: scrub(g.box.fqdn) }
      : null,
    browser: scrub(input.userAgent),
    gateway: entry(g?.gateway),
    generatedAt: g?.generatedAt ? scrub(g.generatedAt) : null,
    page: { path: pathOf(input.url), route: input.route ? scrub(input.route) : null },
    problem: cleanProblem(input.problem),
    product: g?.productVersion ? scrub(g.productVersion) : null,
    publicUrl: g?.publicUrl ? scrub(g.publicUrl) : null,
    services: entries(g?.services),
    thirdParty: entries(g?.thirdParty),
    time: {
      local: localTime(input.now, input.timeZone),
      timeZone: scrub(input.timeZone),
      utc: input.now.toISOString(),
    },
    traceId: g?.traceId ? scrub(g.traceId) : null,
    user: g
      ? {
          id: scrub(g.actor.id),
          roles: g.actor.roles.map((r) => scrub(r)),
          username: scrub(g.actor.username),
        }
      : null,
  };

  const p = json.problem;
  const { local, timeZone, utc } = json.time;
  const lines = [
    "Sneakers-PAM diagnostics",
    `Product: ${productText(json.product)}`,
    `Time: ${utc} (${local} ${timeZone})`,
    `Page: ${json.page.path}${json.page.route ? ` (${json.page.route})` : ""}`,
  ];
  if (p) {
    lines.push(`Problem: ${p.message ?? "(no message)"}`);
    const facts = [
      p.operation && `operation ${p.operation}`,
      p.code && `code ${p.code}`,
      p.reason && `reason ${p.reason}`,
      p.domain && `domain ${p.domain}`,
      p.traceId && `trace ${p.traceId}`,
    ].filter(Boolean);
    if (facts.length > 0) lines.push(`  ${facts.join(", ")}`);
  }
  lines.push(
    json.user
      ? `User: ${json.user.username} (${json.user.id}), roles: ${json.user.roles.join(", ") || "none"}`
      : "User: not signed in, or unknown",
    `App: ${json.app.name} ${json.app.version} (${json.app.commit})`,
    `Appliance: ${json.box ? `Base OS ${json.box.baseOS}, Base Web ${json.box.baseWeb}, ${json.box.fqdn}` : json.appliance}`,
  );
  if (json.publicUrl) lines.push(`Public URL: ${json.publicUrl}`);
  if (json.gateway) {
    lines.push(
      `Gateway: ${json.gateway.version ?? "unknown"} (${json.gateway.commit ?? "unknown"})`,
      "Services:",
      ...json.services.map((c) => line(c)),
      "Third party:",
      ...json.thirdParty.map((c) => line(c)),
    );
  } else {
    lines.push("Gateway: not reachable");
  }
  lines.push(`Browser: ${json.browser}`);
  const text = `${lines.join("\n")}\n\n\`\`\`json\n${JSON.stringify(json, null, 2)}\n\`\`\`\n`;
  return { json, text };
};
