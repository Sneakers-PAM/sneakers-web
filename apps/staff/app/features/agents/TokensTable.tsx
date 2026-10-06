import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Card,
  cn,
  GrantPill,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  timeAgo,
  toast,
} from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { AgentsResult, TokenRow } from "@/features/agents/model";

const Row = ({ t }: { t: TokenRow }) => {
  const [confirming, setConfirming] = useState(false);
  const fetcher = useFetcher<AgentsResult>({ key: `revoke-token-${t.id}` });
  const handled = useRef<unknown>(null);
  const name = t.label || "Unnamed token";

  useEffect(() => {
    const d = fetcher.data;
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.ok) toast(d.done);
    else toast.error(d.message);
  }, [fetcher.data]);

  const inactive = t.state !== "active";
  return (
    <TableRow className={cn(inactive && "opacity-70")}>
      <TableCell className={cn("font-bold", t.state === "revoked" && "line-through")}>
        {name}
      </TableCell>
      <TableCell className="hidden text-muted tablet:table-cell">{t.app}</TableCell>
      <TableCell className="hidden font-mono text-[0.8125rem] desktop:table-cell">
        {shortDate(t.createdAt)}
      </TableCell>
      <TableCell className="hidden text-muted tablet:table-cell">
        {t.lastUsedAt ? timeAgo(t.lastUsedAt) : "Never"}
      </TableCell>
      <TableCell>
        <GrantPill status={t.state} />
      </TableCell>
      <TableCell className="text-right">
        {t.state === "active" && (
          <>
            <Button
              aria-label={`Revoke ${name}`}
              loading={fetcher.state !== "idle"}
              onClick={() => setConfirming(true)}
              size="sm"
              variant="secondary"
            >
              Revoke
            </Button>
            <AlertDialog onOpenChange={setConfirming} open={confirming}>
              <AlertDialogContent>
                <AlertDialogTitle>Revoke {name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Any app using it stops working on its next request. You can connect it again later
                  from the app.
                </AlertDialogDescription>
                <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      void fetcher.submit(
                        { id: t.id, intent: "revoke" },
                        { action: "/tokens", method: "post" },
                      )
                    }
                    variant="danger"
                  >
                    Revoke token
                  </AlertDialogAction>
                </div>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </TableCell>
    </TableRow>
  );
};

/** U-13: the user's personal tokens, and Revoke for the active ones. */
export const TokensTable = ({ tokens }: { tokens: TokenRow[] }) => (
  <Card className="overflow-hidden">
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">App</TableHeaderCell>
          <TableHeaderCell className="hidden desktop:table-cell">Created</TableHeaderCell>
          <TableHeaderCell className="hidden whitespace-nowrap tablet:table-cell">
            Last used
          </TableHeaderCell>
          <TableHeaderCell>State</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody striped>
        {tokens.map((t) => (
          <Row key={t.id} t={t} />
        ))}
      </TableBody>
    </Table>
  </Card>
);
