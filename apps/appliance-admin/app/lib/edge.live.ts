import type { Edge } from "@/lib/osadmin/edgeTypes";
import { getSession } from "@/lib/osadmin/sessionStore";
import { parseOsadminError } from "@/lib/osadmin/errors";

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
    const session = getSession();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (session?.csrfToken) headers["X-CSRF-Token"] = session.csrfToken;
    const response = await fetch(`/sneakers.appliance.osadmin.v1.${service}/${method}`, {
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
      headers,
      method: "POST",
    });
    if (!response.ok) throw await parseOsadminError(response);
    return (await response.json()) as Result;
  },
  async upload(bytes: Blob): Promise<{ uploadId: string }> {
    const session = getSession();
    const headers: Record<string, string> = {};
    if (session?.csrfToken) headers["X-CSRF-Token"] = session.csrfToken;
    const response = await fetch("/upload", {
      body: bytes,
      credentials: "same-origin",
      headers,
      method: "POST",
    });
    if (!response.ok) throw await parseOsadminError(response);
    return (await response.json()) as { uploadId: string };
  },
};
