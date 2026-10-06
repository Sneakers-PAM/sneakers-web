import type { LoaderFunctionArgs } from "react-router";

import { BrowseFoldersDocument, ShellCountsDocument } from "@sneakers-web/api-client";
import { frameData, guard, requireUser } from "@sneakers-web/shell/server";

/**
 * Who is signed in, plus the counts the frame shows (checkouts, open requests, agents waiting)
 * and the folder tree the left main nav pins (U-03), so it's there on every page.
 */
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
  const folders = await guard(request, () => gw.gql(BrowseFoldersDocument))
    .then((d) => d.folders)
    .catch((error: unknown) => {
      if (error instanceof Response) throw error;
      return [];
    });
  return { ...frame, counts, folders };
};

export { StaffFrame as default } from "@/frame/StaffFrame";
