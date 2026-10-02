import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";
// The Express app both app servers run: React Router's request handler plus the static assets,
// with Express's "trust proxy" set from TRUST_PROXY. serve.mjs starts it.
import path from "node:path";

/**
 * What TRUST_PROXY means, as Express's "trust proxy" setting. Unset, empty or "false": trust
 * nothing, so X-Forwarded-* are ignored. "true": trust every hop. A number: trust that many hops.
 * Anything else: the proxies' addresses or CIDR ranges, comma-separated.
 */
export const trustProxy = (raw) => {
  const value = (raw ?? "").trim();
  if (value === "" || value === "false") return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

const LEVELS = { debug: 1, error: 4, info: 2, trace: 0, warn: 3 };

/** One JSON line per entry (readable lines with LOG_FORMAT=console), filtered by LOG_LEVEL. */
export const createLog = (environment) => {
  const threshold = LEVELS[environment.LOG_LEVEL] ?? LEVELS.error;
  const json = environment.LOG_FORMAT !== "console";
  return (level, message, fields = {}) => {
    if (LEVELS[level] < threshold) return;
    const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    if (json) {
      sink(
        JSON.stringify({
          level,
          message,
          scope: "server",
          time: new Date().toISOString(),
          ...fields,
        }),
      );
    } else {
      sink(`[${level}] server: ${message}`, fields);
    }
  };
};

/** The Express app for a React Router server build. */
export const createApp = (build, environment, log) => {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", trustProxy(environment.TRUST_PROXY));
  app.use(compression());
  app.use(
    path.posix.join(build.publicPath, "assets"),
    express.static(path.join(build.assetsBuildDirectory, "assets"), {
      immutable: true,
      maxAge: "1y",
    }),
  );
  app.use(build.publicPath, express.static(build.assetsBuildDirectory, { maxAge: "1h" }));
  app.use((request, response, next) => {
    const started = performance.now();
    response.on("finish", () => {
      log(response.statusCode >= 500 ? "error" : "info", "request", {
        method: request.method,
        ms: Math.round(performance.now() - started),
        path: request.path,
        status: response.statusCode,
      });
    });
    next();
  });
  // @react-router/express takes the port from the Host header when X-Forwarded-Host has none,
  // so "pam.example.org" from the edge became "pam.example.org:3000" and the origin check still
  // failed. From a trusted proxy, the forwarded host replaces Host before the handler reads it.
  app.use((request, _response, next) => {
    const forwarded = request.get("X-Forwarded-Host")?.split(",", 1)[0]?.trim();
    if (forwarded && app.get("trust proxy fn")(request.socket.remoteAddress, 0)) {
      request.headers.host = forwarded;
    }
    next();
  });
  app.all("*", createRequestHandler({ build, mode: environment.NODE_ENV }));
  return app;
};
