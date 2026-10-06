import {
  Button,
  Card,
  cn,
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
import { Eye } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { AgentsResult, UseRow } from "@/features/agents/model";

import { FactorDialog } from "@/features/agents/FactorDialog";

// Agent approvals go warn under 3 minutes and solid danger under one.
const WARN_BELOW_S = 180;
const DANGER_BELOW_S = 60;
// Longer commands start truncated, with a toggle to show them whole.
const LONG_COMMAND = 48;

const Command = ({ u }: { u: UseRow }) => {
  const [full, setFull] = useState(false);
  if (u.reveal) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[0.875rem] font-bold text-danger">
        <Eye aria-hidden className="size-4" />
        Reveal the value to the agent
        <span className="font-normal text-muted">· no command</span>
      </span>
    );
  }
  const long = u.command.length > LONG_COMMAND;
  return (
    <span className="flex min-w-0 flex-col items-start gap-1">
      <code
        className={cn(
          "max-w-full font-mono text-[0.8125rem]",
          full ? "break-all whitespace-normal" : "truncate whitespace-nowrap",
        )}
        title={long && !full ? u.command : undefined}
      >
        {u.command}
      </code>
      {long && (
        <button
          className="text-small font-bold text-primary hover:text-ink"
          onClick={() => setFull(!full)}
          type="button"
        >
          {full ? "Hide full command" : "Show full command"}
        </button>
      )}
    </span>
  );
};

const Row = ({ u }: { u: UseRow }) => {
  const left = useSecondsLeft(u.expiresAt);
  const [asking, setAsking] = useState(false);
  const deny = useFetcher<AgentsResult>({ key: `deny-${u.id}` });
  const handled = useRef<unknown>(null);

  useEffect(() => {
    const d = deny.data;
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.ok) toast(d.done);
    else toast.error(d.message);
  }, [deny.data]);

  const onDone = useCallback((d: Extract<AgentsResult, { ok: true }>) => {
    setAsking(false);
    toast(d.done);
  }, []);

  const expired = left <= 0;
  return (
    <TableRow
      className={cn(
        u.reveal && !expired && "bg-danger-soft hover:bg-danger-soft",
        expired && "opacity-70",
      )}
    >
      <TableCell className="font-bold whitespace-nowrap">{u.secretName}</TableCell>
      <TableCell className="hidden font-mono text-[0.8125rem] tablet:table-cell">
        {u.fieldKey}
      </TableCell>
      <TableCell className="hidden w-full max-w-0 tablet:table-cell">
        <Command u={u} />
      </TableCell>
      <TableCell className="hidden text-[0.875rem] whitespace-nowrap text-muted desktop:table-cell">
        {u.requestedBy}
        <span className="block text-small">{u.clientLabel}</span>
      </TableCell>
      <TableCell>
        {expired ? (
          <span className="text-muted">—</span>
        ) : (
          <Countdown
            dangerBelow={DANGER_BELOW_S}
            label={u.secretName}
            until={u.expiresAt}
            warnBelow={WARN_BELOW_S}
          />
        )}
      </TableCell>
      <TableCell className="text-right">
        {expired ? (
          <Pill tone="neutral">Expired · agent stopped waiting</Pill>
        ) : (
          <span className="flex flex-col items-end gap-2 tablet:flex-row tablet:justify-end">
            <deny.Form action="/approvals" method="post">
              <input name="intent" type="hidden" value="deny" />
              <input name="id" type="hidden" value={u.id} />
              <Button
                aria-label={`Deny use of ${u.secretName}`}
                loading={deny.state !== "idle"}
                size="sm"
                type="submit"
                variant="secondary"
              >
                Deny
              </Button>
            </deny.Form>
            <Button
              aria-label={
                u.reveal ? `Review reveal of ${u.secretName}` : `Approve use of ${u.secretName}`
              }
              className={cn(u.reveal && "border-danger text-danger hover:border-danger")}
              onClick={() => setAsking(true)}
              size="sm"
              variant={u.reveal ? "secondary" : "primary"}
            >
              {u.reveal ? "Review reveal" : "Approve"}
            </Button>
          </span>
        )}
        <FactorDialog
          action="/approvals"
          confirmLabel={u.reveal ? "Reveal to agent" : "Approve use"}
          fields={{ id: u.id, intent: "approve" }}
          nothingDone="Nothing was approved."
          onDone={onDone}
          onOpenChange={setAsking}
          open={asking}
          reveal={
            u.reveal ? (
              <>
                <b>{u.requestedBy} will see this value.</b> It may be kept in their agent&apos;s
                logs or history. Approve only if you expect this request.
              </>
            ) : undefined
          }
          summary={[
            { label: "Field", mono: true, value: u.fieldKey },
            u.reveal
              ? { label: "Goes to", value: "The agent itself" }
              : { label: "Command", mono: true, value: u.command },
            { label: "Asked by", value: u.requestedBy },
            { label: "From", value: u.clientLabel },
          ]}
          title={
            u.reveal ? `Reveal ${u.secretName} to the agent?` : `Approve use of ${u.secretName}?`
          }
        />
      </TableCell>
    </TableRow>
  );
};

/**
 * U-14: other people's requests the user may decide, as an owner or approver of the secret,
 * with a live countdown, Deny, and Approve behind a factor.
 */
export const ApprovalsTable = ({ uses }: { uses: UseRow[] }) => (
  <Card className="overflow-hidden">
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Secret</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Field</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Command</TableHeaderCell>
          <TableHeaderCell className="hidden desktop:table-cell">Asked by</TableHeaderCell>
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
