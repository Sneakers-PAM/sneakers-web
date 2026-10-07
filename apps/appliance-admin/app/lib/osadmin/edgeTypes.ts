import type { Session } from "@/lib/osadmin/types";

export interface QuickLoginUser {
  id: string;
  label: string;
  note: string;
}

/**
 * The network edge an app build talks to: the live osadmin Connect API, or the in-memory
 * mock transport for local work and tests. Chosen once, by the Vite alias, at build time.
 */
export interface Edge {
  /** Text for the persistent banner a mock build shows on every screen, or null for none. */
  banner: null | string;
  exportAuditLog(): Promise<Blob>;
  mode: "live" | "mock";
  /** Mock builds only: sign in as a fixture admin without the SSH code round trip. */
  quickLogin?: {
    signIn(adminName: string): null | Session;
    users(): QuickLoginUser[];
  };
  request<Result>(service: string, method: string, body: unknown): Promise<Result>;
  upload(bytes: Blob): Promise<{ uploadId: string }>;
}
