import type { Edge } from "@/lib/osadmin/edgeTypes";
import { csrfToken } from "@/lib/osadmin/sessionStore";
import { OsadminError, parseOsadminError, symbolOf } from "@/lib/osadmin/errors";

const uploadError = (status: number, text: string): OsadminError => {
  const message = text.trim() || `osadmin answered ${String(status)}`;
  return new OsadminError(
    status === 403 ? "permission_denied" : "invalid_argument",
    message,
    symbolOf(message),
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
  mode: "live" as const,
  async request<Result>(service: string, method: string, body: unknown): Promise<Result> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const csrf = csrfToken();
    if (csrf) headers["X-CSRF-Token"] = csrf;
    const response = await fetch(`/sneakers.appliance.osadmin.v1.${service}/${method}`, {
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
      headers,
      method: "POST",
    });
    if (!response.ok) throw await parseOsadminError(response);
    return (await response.json()) as Result;
  },
  // XMLHttpRequest rather than fetch: only XHR reports upload progress, and a release .bin
  // can be gigabytes. /upload answers errors as plain text, not a Connect JSON body.
  upload(bytes: Blob, onProgress?: (fraction: number) => void): Promise<{ uploadId: string }> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("POST", "/upload");
      request.withCredentials = true;
      const csrf = csrfToken();
      if (csrf) request.setRequestHeader("X-CSRF-Token", csrf);
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
