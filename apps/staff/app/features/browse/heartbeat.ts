import type { HeartbeatStatus } from "@sneakers-web/ui";

import type { BrowseSecret } from "@/features/browse/types";

/** The heartbeat pill for a row: no target means nothing to check. */
export const heartbeatOf = (s: BrowseSecret): HeartbeatStatus => {
  if (!s.targetId) return "none";
  switch (s.lastHeartbeatResult) {
    case "failed": {
      return "drift";
    }
    case "ok": {
      return "verified";
    }
    case "unreachable": {
      return "unreachable";
    }
    default: {
      return "unknown";
    }
  }
};
