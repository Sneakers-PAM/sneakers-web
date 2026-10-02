import {
  gql,
  MarkAllNotificationsReadDocument,
  MarkNotificationReadDocument,
  MyNotificationsDocument,
  ShellCountsDocument,
  UnreadCountDocument,
} from "@sneakers-web/api-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const UNREAD_POLL_MS = 25_000;
const COUNTS_POLL_MS = 30_000;

export const useMarkAllRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => gql(MarkAllNotificationsReadDocument),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useMarkRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => gql(MarkNotificationReadDocument, { id }),
    onSettled: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useNotifications = (open: boolean) => {
  return useQuery({
    enabled: open,
    queryFn: () => gql(MyNotificationsDocument, { limit: 50 }),
    queryKey: ["notifications", "list"],
  });
};

/** Counts for the shell: my checkouts, open requests and agents waiting on me. */
export const useShellCounts = (userId: string | undefined) => {
  return useQuery({
    enabled: !!userId,
    queryFn: () => gql(ShellCountsDocument, { userId: userId ?? "" }),
    queryKey: ["shell-counts", userId],
    refetchInterval: COUNTS_POLL_MS,
    select: (d) => ({
      agentApprovals: d.pendingSecretUses.length,
      checkouts: d.activeLeasesForUser.length,
      requests: d.approvalRequests.filter((r) => r.status === "pending").length,
    }),
  });
};

export const useUnreadCount = (enabled = true) => {
  return useQuery({
    enabled,
    queryFn: () => gql(UnreadCountDocument),
    queryKey: ["notifications", "unread"],
    refetchInterval: UNREAD_POLL_MS,
    select: (d) => d.myUnreadNotificationCount,
  });
};
