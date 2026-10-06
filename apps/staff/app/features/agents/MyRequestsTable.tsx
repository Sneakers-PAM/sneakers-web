import {
  Button,
  Card,
  Countdown,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
  useSecondsLeft,
} from "@sneakers-web/ui";
import { useEffect, useRef } from "react";
import { Link, useFetcher } from "react-router";

import type { AgentsResult, UseRow } from "@/features/agents/model";

/** Where a request stands: waiting for someone else, or for the user's one confirmation. */
const Status = ({ u }: { u: UseRow }) => {
  if (!u.confirm) return <Pill tone="neutral">Waiting for an owner or approver</Pill>;
  return u.runId ? (
    <Link
      className="text-small font-bold text-primary hover:text-ink"
      to={`/approvals/run/${encodeURIComponent(u.runId)}`}
    >
      Confirm once
    </Link>
  ) : (
    <Pill tone="primary">Only you can confirm</Pill>
  );
};

const Row = ({ u }: { u: UseRow }) => {
  const left = useSecondsLeft(u.expiresAt);
  const withdraw = useFetcher<AgentsResult>({ key: `withdraw-${u.id}` });
  const handled = useRef<unknown>(null);

  useEffect(() => {
    const d = withdraw.data;
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.ok) toast(d.done);
    else toast.error(d.message);
  }, [withdraw.data]);

  return (
    <TableRow>
      <TableCell className="font-bold whitespace-nowrap">{u.secretName}</TableCell>
      <TableCell className="hidden font-mono text-[0.8125rem] tablet:table-cell">
        {u.fieldKey}
      </TableCell>
      <TableCell className="hidden text-[0.875rem] text-muted tablet:table-cell">
        {u.reveal ? "Reveal" : <code className="font-mono">{u.command}</code>}
        <span className="block text-small">{u.clientLabel}</span>
      </TableCell>
      <TableCell>
        <Status u={u} />
      </TableCell>
      <TableCell>
        {left > 0 ? <Countdown label={u.secretName} until={u.expiresAt} /> : "—"}
      </TableCell>
      <TableCell className="text-right">
        <withdraw.Form action="/approvals" method="post">
          <input name="intent" type="hidden" value="withdraw" />
          <input name="id" type="hidden" value={u.id} />
          <Button
            aria-label={`Withdraw request for ${u.secretName}`}
            loading={withdraw.state !== "idle"}
            size="sm"
            type="submit"
            variant="secondary"
          >
            Withdraw
          </Button>
        </withdraw.Form>
      </TableCell>
    </TableRow>
  );
};

/**
 * U-14: the user's own requests still waiting. Nobody approves their own request: an owner or
 * approver of the secret decides it, or, when nobody else can, the user confirms the task once.
 */
export const MyRequestsTable = ({ uses }: { uses: UseRow[] }) => (
  <Card className="overflow-hidden">
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Secret</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Field</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Request</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Expires</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {uses.map((u) => (
          <Row key={u.id} u={u} />
        ))}
      </TableBody>
    </Table>
  </Card>
);
