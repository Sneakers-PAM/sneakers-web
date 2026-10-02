import {
  Button,
  Card,
  clockTime,
  cn,
  Countdown,
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

import type { ActResult } from "@/features/requests/act.server";
import type { CheckoutRow } from "@/features/requests/checkouts.server";

import { requestRefusalMessage } from "@/features/requests/messages";

// The countdown turns warn under 10 minutes and solid danger under a minute ("ending").
const WARN_BELOW_S = 600;
const DANGER_BELOW_S = 60;

const Row = ({ c }: { c: CheckoutRow }) => {
  const until = Date.parse(c.expiresAt);
  const left = useSecondsLeft(until);
  const ending = left < DANGER_BELOW_S;
  const fetcher = useFetcher<ActResult>({ key: `checkin-${c.secretId}` });
  const handled = useRef<unknown>(null);

  useEffect(() => {
    const d = fetcher.data;
    // The data lands before the list revalidates, while this row is still on screen.
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.ok) toast(`${c.name} is checked in. It rotates now.`);
    else toast.error(requestRefusalMessage(d.refusal));
  }, [fetcher.data, c.name]);

  return (
    <TableRow className={cn(ending && "bg-danger-soft hover:bg-danger-soft")}>
      <TableCell className="w-full">
        <Link className="font-bold text-primary hover:text-ink" to={`/secret/${c.secretId}`}>
          {c.name}
        </Link>
      </TableCell>
      <TableCell className="hidden font-mono tablet:table-cell">{clockTime(c.issuedAt)}</TableCell>
      <TableCell className="hidden font-mono tablet:table-cell">{clockTime(c.expiresAt)}</TableCell>
      <TableCell>
        <span className="flex items-center gap-2 whitespace-nowrap">
          <Countdown
            dangerBelow={DANGER_BELOW_S}
            label={c.name}
            until={until}
            warnBelow={WARN_BELOW_S}
          />
          {ending && <span className="text-small font-bold text-danger">ending</span>}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <fetcher.Form action="/checkouts" method="post">
          <input name="intent" type="hidden" value="checkin" />
          <input name="secretId" type="hidden" value={c.secretId} />
          <Button
            aria-label={`Check in ${c.name}`}
            loading={fetcher.state !== "idle"}
            size="sm"
            type="submit"
            variant="ink"
          >
            Check in
          </Button>
        </fetcher.Form>
      </TableCell>
    </TableRow>
  );
};

/** U-08: the leases the user holds, with a live countdown and a check-in per row. */
export const CheckoutsTable = ({ checkouts }: { checkouts: CheckoutRow[] }) => (
  <Card className="overflow-hidden">
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Secret</TableHeaderCell>
          <TableHeaderCell className="hidden whitespace-nowrap tablet:table-cell">
            Checked out
          </TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Expires</TableHeaderCell>
          <TableHeaderCell className="whitespace-nowrap">Time left</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {checkouts.map((c) => (
          <Row c={c} key={c.leaseId} />
        ))}
      </TableBody>
    </Table>
  </Card>
);
