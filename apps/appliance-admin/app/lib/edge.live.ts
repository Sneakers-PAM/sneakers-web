import {
  type Edge,
  type SupportBundle,
  UPLOAD_CANCELLED,
  type UploadOptions,
} from "@/lib/osadmin/edgeTypes";
import { OsadminError, parseOsadminError, symbolOf } from "@/lib/osadmin/errors";
import { csrfToken } from "@/lib/osadmin/sessionStore";
import { noteServedWebVersion, WEB_VERSION_HEADER } from "@/lib/webVersion";

const uploadError = (status: number, text: string): OsadminError => {
  const message = text.trim() || `osadmin answered ${String(status)}`;
  return new OsadminError(
    status === 403
      ? "permission_denied"
      : status === 409
        ? "failed_precondition"
        : "invalid_argument",
    message,
    symbolOf(message),
  );
};

/** What a request that never reached osadmin says. */
export const UNREACHABLE = "The appliance can't be reached at this address.";

const bundleRefusal = (status: number, text: string): OsadminError =>
  new OsadminError(
    status === 401 ? "unauthenticated" : status === 503 ? "unavailable" : "unknown",
    text.trim() || `osadmin answered ${String(status)}`,
  );

/** A refusal before the first byte of the log archive: plain text, as the other exports. */
const logsRefusal = (status: number, text: string, headers: Headers): OsadminError => {
  const said = text.trim() || `osadmin answered ${String(status)}`;
  if (status === 409) {
    const wait = Number(headers.get("Retry-After"));
    return new OsadminError(
      "failed_precondition",
      wait > 0 ? `${said} Try again in ${String(wait)} seconds.` : said,
    );
  }
  return new OsadminError(
    status === 400 ? "invalid_argument" : status === 401 ? "unauthenticated" : "unknown",
    said,
  );
};

/**
 * The live edge: the browser calls osadmin's Connect API at the same origin (no gateway,
 * no Node server -- osadmin serves the static assets and the API side by side on :8443).
 */
export const edge: Edge = {
  banner: null,
  async exportAuditLog(): Promise<Blob> {
    const response = await fetch("/export/audit-log", { credentials: "same-origin" });
    if (!response.ok) throw await parseOsadminError(response);
    return response.blob();
  },
  async exportLogs(query: string): Promise<SupportBundle> {
    try {
      const response = await fetch(`/export/logs?${query}`, { credentials: "same-origin" });
      // Like the support bundle: 8443 serves index.html for a path it doesn't know, so a 200 that
      // isn't a gzip means a box without this route.
      const type = response.headers.get("Content-Type") ?? "";
      if (response.status === 404 || (response.ok && !type.startsWith("application/gzip")))
        throw new OsadminError("unimplemented", "This box has no log download.");
      if (!response.ok) throw logsRefusal(response.status, await response.text(), response.headers);
      const named = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
      try {
        // The archive streams with no length, and a failure after the first byte only breaks the
        // connection, so a read that throws is a failed download, never a short file.
        return { blob: await response.blob(), fileName: named?.[1] ?? "sneakers-logs.tar.gz" };
      } catch {
        throw new OsadminError(
          "unavailable",
          "The download broke part way, so nothing was saved. Try again.",
        );
      }
    } catch (error) {
      if (error instanceof TypeError) throw new OsadminError("unavailable", UNREACHABLE);
      throw error;
    }
  },
  async exportSupportBundle(): Promise<SupportBundle> {
    try {
      const response = await fetch("/export/support-bundle", { credentials: "same-origin" });
      // A box without the route never reaches it: 8443 serves the pages' index.html for a path it
      // doesn't know, so a 200 that isn't a bundle means the same as a 404. An older box sends the
      // bundle as plain text, a newer one as a zip.
      const type = response.headers.get("Content-Type") ?? "";
      const isZip = type.startsWith("application/zip");
      const isBundle = isZip || type.startsWith("text/plain");
      if (response.status === 404 || (response.ok && !isBundle))
        throw new OsadminError("unimplemented", "This box has no support bundle.");
      if (!response.ok) throw bundleRefusal(response.status, await response.text());
      const named = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "");
      const fallback = isZip ? "support-bundle.zip" : "support-bundle.txt";
      return { blob: await response.blob(), fileName: named?.[1] ?? fallback };
    } catch (error) {
      if (error instanceof TypeError) throw new OsadminError("unavailable", UNREACHABLE);
      throw error;
    }
  },
  mode: "live" as const,
  async request<Result>(service: string, method: string, body: unknown): Promise<Result> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const csrf = csrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    let response: Response;
    try {
      response = await fetch(`/sneakers.appliance.osadmin.v1.${service}/${method}`, {
        body: JSON.stringify(body ?? {}),
        credentials: "same-origin",
        headers,
        method: "POST",
      });
    } catch (error) {
      // fetch rejects with a TypeError ("Failed to fetch") when the box doesn't answer at
      // this origin at all: a network change moved its address or remade its certificate.
      if (error instanceof TypeError) throw new OsadminError("unavailable", UNREACHABLE);
      throw error;
    }
    noteServedWebVersion(response.headers.get(WEB_VERSION_HEADER));
    if (!response.ok) throw await parseOsadminError(response);
    return (await response.json()) as Result;
  },
  // XMLHttpRequest rather than fetch: only XHR reports upload progress, and a release .bin
  // can be gigabytes. /upload answers errors as plain text, not a Connect JSON body; 409 is
  // UPGRADE_BUSY (another file is coming in or held).
  upload(
    bytes: Blob,
    onProgress?: (fraction: number) => void,
    options: UploadOptions = {},
  ): Promise<{ uploadId: string }> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/upload");
      request.withCredentials = true;
      const csrf = csrfToken();
      if (csrf) request.setRequestHeader("X-CSRF-Token", csrf);
      if (options.fileName)
        request.setRequestHeader("X-File-Name", encodeURIComponent(options.fileName));
      if (options.signal?.aborted) {
        reject(new OsadminError("cancelled", UPLOAD_CANCELLED, "UPLOAD_CANCELLED"));
        return;
      }
      options.signal?.addEventListener("abort", () => request.abort());
      request.addEventListener("abort", () =>
        reject(new OsadminError("cancelled", UPLOAD_CANCELLED, "UPLOAD_CANCELLED")),
      );
      request.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) onProgress?.(event.loaded / event.total);
      });
      request.addEventListener("load", () => {
        if (request.status === 200) {
          onProgress?.(1);
          resolve(JSON.parse(request.responseText) as { uploadId: string });
          return;
        }
        reject(uploadError(request.status, request.responseText));
      });
      request.addEventListener("error", () =>
        reject(new OsadminError("unavailable", "The upload didn't reach the appliance.")),
      );
      request.send(bytes);
    });
  },
};
