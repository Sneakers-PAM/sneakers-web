import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  RequestPill,
  Sheet,
  SheetContent,
  timeAgo,
  toast,
  useBreakpoint,
} from "@sneakers-web/ui";
import { cn } from "@sneakers-web/ui";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { ActResult } from "@/features/requests/act.server";
import type { RequestRow } from "@/features/requests/model";

import { HoursStepper } from "@/features/requests/HoursStepper";
import { requestRefusalMessage } from "@/features/requests/messages";

const decisionToast = (done: string, row: RequestRow, hours: number): string => {
  if (done === "moved") return `Moved. ${row.requestedBy} was notified.`;
  if (done === "approved") return `Approved for ${hours} h. ${row.requestedBy} was notified.`;
  return `Denied. ${row.requestedBy} was notified.`;
};

const resolution = (row: RequestRow): null | string => {
  if (row.status === "pending" || !row.resolvedAt) return null;
  const by = row.resolvedBy ?? "someone";
  const when = timeAgo(row.resolvedAt);
  if (row.status === "denied") return `Denied by ${by} · ${when}`;
  return `${row.isMove ? "Moved" : "Approved"} by ${by} · ${when}`;
};

/**
 * D-15: one request's reason, thread and decision. Approvers set the grant window and
 * approve or deny; everyone on the request can post in the thread. A dialog on wider
 * screens, a full-height sheet on a phone.
 */
export const ReviewDialog = ({
  defaultHours,
  maxHours,
  onClose,
  row,
}: {
  defaultHours: number;
  maxHours: number;
  onClose: () => void;
  row: RequestRow | undefined;
}) => {
  const phone = useBreakpoint() === "phone";
  const open = !!row;
  const body = row && (
    <ReviewBody
      defaultHours={defaultHours}
      key={row.id}
      maxHours={maxHours}
      onDone={onClose}
      row={row}
    />
  );
  if (phone)
    return (
      <Sheet onOpenChange={(o) => !o && onClose()} open={open}>
        <SheetContent className="h-[calc(100dvh-3.5rem)]" side="bottom" title="Review">
          {body}
        </SheetContent>
      </Sheet>
    );
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-[40rem] gap-0 p-0">{body}</DialogContent>
    </Dialog>
  );
};

const Label = ({ children }: { children: ReactNode }) => (
  <span className="text-small font-bold text-ink">{children}</span>
);

const ReviewBody = ({
  defaultHours,
  maxHours,
  onDone,
  row,
}: {
  defaultHours: number;
  maxHours: number;
  onDone: () => void;
  row: RequestRow;
}) => {
  const phone = useBreakpoint() === "phone";
  const decide = useFetcher<ActResult>({ key: `resolve-${row.id}` });
  const talk = useFetcher<ActResult>({ key: `comment-${row.id}` });
  const [hours, setHours] = useState(defaultHours);
  const [draft, setDraft] = useState("");
  const asked = useRef(hours);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    const d = decide.data;
    if (decide.state !== "idle" || !d?.ok || handled.current === d) return;
    handled.current = d;
    toast(decisionToast(d.done, row, asked.current));
    onDone();
  }, [decide.state, decide.data, onDone, row]);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    void talk.submit({ body: text, id: row.id, intent: "comment" }, { method: "post" });
  };
  const resolve = (decision: "approve" | "deny") => {
    asked.current = hours;
    void decide.submit(
      { decision, hours: String(hours), id: row.id, intent: "resolve", kind: row.kind },
      { method: "post" },
    );
  };

  const refusal =
    (decide.data && !decide.data.ok && decide.data.refusal) ||
    (talk.data && !talk.data.ok && talk.data.refusal) ||
    null;
  const resolved = resolution(row);
  const Title = phone ? "h2" : DialogTitle;

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-border px-6.5 pt-6.5 pb-5 pr-14">
        <span className="eyebrow">
          {row.isMove ? "Move request · needs a site admin" : "Access request"}
        </span>
        <div className="flex flex-wrap items-center gap-2.5">
          <Title className="m-0 font-display text-[1.625rem] leading-[1.1] font-bold">
            {row.resource}
          </Title>
          <RequestPill status={row.status} />
        </div>
        {phone ? (
          <span className="text-small text-muted">
            Requested by <b className="text-ink">{row.requestedBy}</b> · {timeAgo(row.requestedAt)}
          </span>
        ) : (
          <DialogDescription className="text-small">
            Requested by <b className="text-ink">{row.requestedBy}</b> · {timeAgo(row.requestedAt)}
          </DialogDescription>
        )}
        {resolved && <span className="text-small text-muted">{resolved}</span>}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6.5 py-5">
        <div className="flex flex-col gap-2">
          <Label>Reason</Label>
          <div className="rounded-lg bg-sunken px-3.5 py-3 text-body leading-[1.5]">
            {row.reason || <span className="text-muted">No reason given.</span>}
          </div>
        </div>

        {row.isMove && (
          <Alert tone="warn">
            Approving moves it into <b>{row.dest}</b>. Everyone who could see it in <b>{row.src}</b>{" "}
            loses access, and {"it is no longer covered by the team's rules."}
          </Alert>
        )}

        {row.canDecide && !row.isMove && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Label>Grant for</Label>
              <span className="text-small text-muted">
                Access ends on its own. Maximum {maxHours} hours.
              </span>
            </div>
            <HoursStepper max={maxHours} onChange={setHours} value={hours} />
          </div>
        )}

        <div className="flex flex-col gap-2.5">
          <Label>Discussion</Label>
          {row.comments.length === 0 ? (
            <span className="text-small text-muted">
              No messages yet. Ask a question before you decide.
            </span>
          ) : (
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {row.comments.map((c) => (
                <li
                  className={cn("flex flex-col gap-1", c.mine ? "items-end" : "items-start")}
                  key={c.id}
                >
                  <div
                    className={cn(
                      "max-w-[82%] px-3.5 py-2.5 text-body leading-[1.45] break-words whitespace-pre-wrap",
                      c.mine
                        ? "rounded-[16px_16px_4px_16px] bg-primary text-on-primary"
                        : "rounded-[16px_16px_16px_4px] bg-sunken",
                    )}
                  >
                    {c.body}
                  </div>
                  <span className="text-label text-muted">
                    {c.mine ? "You" : c.author} · {timeAgo(c.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        {refusal && (
          <Alert role="alert" title="That didn't go through" tone="danger">
            {requestRefusalMessage(refusal)}
          </Alert>
        )}
      </div>

      <div className="flex gap-2.5 border-t border-border px-6.5 py-3.5">
        <input
          aria-label="Message"
          className="h-11 min-w-0 flex-1 rounded-md border-[1.5px] border-border-strong bg-surface px-3.5 text-body placeholder:text-muted"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              send();
            }
          }}
          placeholder="Write a message…"
          value={draft}
        />
        <Button
          disabled={!draft.trim()}
          loading={talk.state !== "idle"}
          onClick={send}
          variant="secondary"
        >
          Send
        </Button>
      </div>

      <div className="flex justify-end gap-2.5 rounded-b-2xl border-t border-border bg-sunken px-6.5 py-4">
        {row.canDecide ? (
          <>
            <Button
              className={cn("border-danger text-danger hover:border-danger", phone && "flex-1")}
              disabled={decide.state !== "idle"}
              onClick={() => resolve("deny")}
              variant="secondary"
            >
              Deny
            </Button>
            <Button
              className={cn(phone && "flex-[2]")}
              loading={decide.state !== "idle"}
              onClick={() => resolve("approve")}
            >
              {row.isMove ? "Approve move" : `Approve for ${hours}h`}
            </Button>
          </>
        ) : (
          <Button onClick={onDone} variant="secondary">
            Close
          </Button>
        )}
      </div>
    </>
  );
};
