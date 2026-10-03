import { Pill, RequestPill, Segmented, timeAgo } from "@sneakers-web/ui";
import { ChevronRight } from "lucide-react";
import { useState } from "react";

import type { RequestRow } from "@/features/requests/model";

type Tab = "approve" | "history" | "mine";

const detail = (r: RequestRow, tab: Tab): string => {
  const parts = [r.requestedBy, timeAgo(r.requestedAt)];
  if (tab === "approve" && r.isMove) parts.push("move, site admin");
  else if (r.comments.length > 1) parts.push(`${r.comments.length} messages`);
  else if (r.reason) parts.push(`“${r.reason}”`);
  return parts.join(" · ");
};

/** U-09 on a phone: the three lists behind a segmented control, each row opening the sheet. */
export const PhoneRequests = ({
  approver,
  awaiting,
  history,
  onOpen,
  open,
}: {
  approver: boolean;
  awaiting: RequestRow[];
  history: RequestRow[];
  onOpen: (id: string) => void;
  open: RequestRow[];
}) => {
  const [tab, setTab] = useState<Tab>(approver ? "approve" : "mine");
  const rows = tab === "approve" ? awaiting : tab === "mine" ? open : history;
  const options = [
    ...(approver
      ? [
          {
            label: `To approve${awaiting.length > 0 ? ` ${awaiting.length}` : ""}`,
            value: "approve" as const,
          },
        ]
      : []),
    { label: "Mine", value: "mine" as const },
    { label: "History", value: "history" as const },
  ];
  const empty = {
    approve: "Nothing to approve.",
    history: "No resolved requests yet.",
    mine: "No open requests.",
  }[tab];
  return (
    <div className="flex flex-col gap-3.5">
      <Segmented label="Show requests" onChange={setTab} options={options} value={tab} />
      {rows.length === 0 ? (
        <p className="m-0 px-2 text-muted">{empty}</p>
      ) : (
        <ul className="m-0 list-none overflow-hidden rounded-xl bg-surface p-0">
          {rows.map((r) => (
            <li className="border-b border-border last:border-b-0" key={r.id}>
              <button
                className="flex w-full items-center gap-3 px-4 py-3.25 text-left"
                onClick={() => onOpen(r.id)}
                type="button"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-1.25">
                  <b className="text-body-lg leading-[1.2]">{r.resource}</b>
                  <span className="truncate text-small text-muted">{detail(r, tab)}</span>
                </span>
                {r.isMove && r.status === "pending" ? (
                  <Pill tone="warn">Move</Pill>
                ) : (
                  <RequestPill status={r.status} />
                )}
                <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === "approve" && rows.length > 0 && (
        <span className="px-2 text-small text-muted">Tap a request to review it.</span>
      )}
    </div>
  );
};
