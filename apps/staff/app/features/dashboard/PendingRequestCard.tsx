import { Button, plural, timeAgo } from "@sneakers-web/ui";
import { Hourglass } from "lucide-react";
import { Link } from "react-router";

import type { RequestCard } from "@/features/dashboard/dashboard.server";

import { QuickCard } from "@/features/dashboard/QuickCard";

const what = (r: RequestCard): string =>
  r.kind === "folder_move" ? `Move ${r.folderName}` : `Access in ${r.folderName}`;

/** The user's own access or move request, still waiting for an approver. */
export const PendingRequestCard = ({ requests }: { requests: RequestCard[] }) => {
  const latest = requests.toSorted((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
  if (!latest) return null;
  return (
    <QuickCard
      className="border-[1.5px] border-dashed border-primary"
      icon={<Hourglass />}
      iconClassName="bg-primary-soft text-primary"
      title={
        requests.length > 1 ? `${requests.length} requests are pending` : "Your request is pending"
      }
    >
      <p className="m-0 text-[0.875rem]">
        {what(latest)} · sent {timeAgo(latest.requestedAt)}
      </p>
      <div className="mt-auto flex items-center justify-between gap-3">
        <span className="text-small text-muted">
          {latest.messages
            ? `${plural(latest.messages, "message")} in the thread`
            : "No messages yet"}
        </span>
        <Button asChild size="sm" variant="secondary">
          <Link to="/requests">View</Link>
        </Button>
      </div>
    </QuickCard>
  );
};
