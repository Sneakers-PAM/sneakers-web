import type { LoaderFunctionArgs } from "react-router";

import { ShellCountsDocument } from "@sneakers-web/api-client";
import { frameData, guard, requireUser } from "@sneakers-web/shell/server";

/** Who is signed in, plus the counts the frame shows: checkouts, open requests, agents waiting. */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const frame = await frameData(request);
  const { gw } = await requireUser(request);
  const counts = await guard(request, () => gw.gql(ShellCountsDocument, { userId: frame.user.id }))
    .then((d) => ({
      agentApprovals: d.pendingSecretUses.length,
      checkouts: d.activeLeasesForUser.length,
      requests: d.approvalRequests.filter((r) => r.status === "pending").length,
    }))
    .catch((error: unknown) => {
      if (error instanceof Response) throw error;
      return { agentApprovals: 0, checkouts: 0, requests: 0 };
    });
  return { ...frame, counts };
};

export { StaffFrame as default } from "@/frame/StaffFrame";
