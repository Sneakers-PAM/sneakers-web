import { Avatar, cn, Skeleton, timeAgo } from "@sneakers-web/ui";
import { Bell, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useState } from "react";

import { useMarkAllRead, useMarkRead, useNotifications, useUnreadCount } from "#shell/data/hooks";

export interface NotificationTarget {
  id: string;
  resourceId: string;
  resourceKind: string;
}

const tone = (actor: string): "neutral" | "ok" | "warn" => {
  const c = actor.trim().charAt(0).toUpperCase();
  return c === "B" ? "warn" : c === "C" ? "ok" : "neutral";
};

/**
 * The bell and its panel. The unread count polls quietly; the list loads when the panel
 * opens. Opening a notification marks it read and goes to the thing it is about.
 */
export const NotificationBell = ({
  onOpenItem,
}: {
  onOpenItem: (n: NotificationTarget) => void;
}) => {
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount();
  const list = useNotifications(open);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const count = unread.data ?? 0;

  return (
    <DialogPrimitive.Root onOpenChange={setOpen} open={open}>
      <DialogPrimitive.Trigger
        aria-label={`Notifications, ${count} unread`}
        className={cn(
          "relative inline-flex size-10 items-center justify-center rounded-md border-[1.5px] border-border-strong",
          open ? "bg-sunken" : "bg-surface hover:bg-sunken",
        )}
      >
        <Bell aria-hidden className="size-4.5" strokeWidth={2} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 rounded-full bg-danger px-1.25 text-center text-[0.75rem] leading-5 font-bold text-on-danger">
            {count}
          </span>
        )}
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 top-16 z-(--z-sheet) bg-[rgb(12_14_20/0.35)]" />
        <DialogPrimitive.Content className="fixed top-16 right-0 bottom-0 z-(--z-sheet) flex w-full max-w-110 flex-col border-l border-border-strong bg-surface text-ink shadow-dialog outline-none">
          <div className="flex items-center gap-2.5 border-b border-border px-5.5 py-5">
            <DialogPrimitive.Title className="m-0 font-display text-h2 font-bold">
              Notifications
            </DialogPrimitive.Title>
            <span className="font-mono text-[0.75rem] font-bold text-muted">{count} unread</span>
            <button
              className="ml-auto h-8.5 rounded-sm px-2.5 text-[0.875rem] font-bold text-primary hover:bg-primary-soft disabled:text-muted"
              disabled={count === 0}
              onClick={() => markAll.mutate()}
              type="button"
            >
              Mark all read
            </button>
            <DialogPrimitive.Close
              aria-label="Close"
              className="inline-flex size-8.5 items-center justify-center rounded-sm hover:bg-sunken"
            >
              <X aria-hidden className="size-4.5" />
            </DialogPrimitive.Close>
          </div>
          <DialogPrimitive.Description className="sr-only">
            Recent activity on your secrets and folders
          </DialogPrimitive.Description>
          <div className="flex-1 overflow-y-auto">
            {list.isPending && (
              <div aria-label="Loading notifications" className="flex flex-col gap-3 p-5.5">
                {[0, 1, 2].map((index) => (
                  <Skeleton className="h-12 w-full" key={index} />
                ))}
              </div>
            )}
            {list.isError && (
              <div className="flex flex-col items-start gap-2 p-5.5 text-[0.875rem]" role="alert">
                <b>Notifications didn't load.</b>
                <button
                  className="font-bold text-primary"
                  onClick={() => void list.refetch()}
                  type="button"
                >
                  Retry
                </button>
              </div>
            )}
            {list.data?.myNotifications.map((n) => (
              <button
                className={cn(
                  "flex w-full gap-3.5 border-b border-border px-5.5 py-4 text-left hover:bg-sunken",
                  !n.read && "bg-primary-soft",
                )}
                key={n.id}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id);
                  setOpen(false);
                  onOpenItem(n);
                }}
                type="button"
              >
                <Avatar name={n.actorLabel} size={36} tone={tone(n.actorLabel)} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.25">
                  <span className="text-body leading-[1.4]">
                    <b>{n.actorLabel}</b> {n.action} <b>{n.resourceLabel}</b>
                  </span>
                  <span className="text-small leading-none text-muted">
                    {timeAgo(n.occurredAt)} · Opens sharing
                  </span>
                </span>
                {!n.read && (
                  <span
                    aria-label="Unread"
                    className="mt-1.5 size-2.5 flex-none rounded-full bg-primary"
                  />
                )}
              </button>
            ))}
            {list.data && list.data.myNotifications.every((n) => n.read) && (
              <p className="m-0 px-5.5 py-4.5 text-center text-[0.875rem] leading-[1.4] text-muted">
                You're all caught up.
              </p>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
