import type { ApprovalStatus, RequestKind } from "@sneakers-web/api-client";

/** The workflow's grant window: 8 hours unless the approver picks, never more than 24. */
export const DEFAULT_GRANT_HOURS = 8;
export const MAX_GRANT_HOURS = 24;

/** The "request access" form opened by `/requests?new=<secretId>`. */
export interface NewRequest {
  alreadyPending: boolean;
  /** Null when the secret doesn't exist or the viewer can't see it. */
  name: null | string;
  secretId: string;
}

export interface RequestComment {
  author: string;
  body: string;
  createdAt: string;
  id: string;
  mine: boolean;
}

/** One request as the page shows it, already named and checked against the viewer. */
export interface RequestRow {
  /** Pending, not the viewer's own, and the viewer may approve it. */
  canDecide: boolean;
  comments: RequestComment[];
  dest: string;
  id: string;
  isMove: boolean;
  kind: RequestKind;
  mine: boolean;
  reason: string;
  requestedAt: string;
  requestedBy: string;
  resolvedAt: null | string;
  resolvedBy: null | string;
  resource: string;
  secretId: null | string;
  src: string;
  status: ApprovalStatus;
}

export interface RequestsData {
  approver: boolean;
  asking: NewRequest | null;
  awaiting: RequestRow[];
  defaultHours: number;
  history: RequestRow[];
  maxHours: number;
  open: RequestRow[];
}
