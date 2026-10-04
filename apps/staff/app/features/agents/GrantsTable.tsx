import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Card,
  clockTime,
  cn,
  GrantPill,
  Pill,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from "@sneakers-web/ui";
import { Eye } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { AgentsResult, GrantRow } from "@/features/agents/model";

const ends = (at: number) => `${shortDate(at)} ${clockTime(at)}`;

const Row = ({ g }: { g: GrantRow }) => {
  const [confirming, setConfirming] = useState(false);
  const fetcher = useFetcher<AgentsResult>({ key: `revoke-grant-${g.id}` });
  const handled = useRef<unknown>(null);

  useEffect(() => {
    const d = fetcher.data;
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.ok) toast(d.done);
    else toast.error(d.message);
  }, [fetcher.data]);

  const active = g.state === "active";
  return (
    <TableRow className={cn(!active && "opacity-70")}>
      <TableCell className={cn("font-bold", g.state === "revoked" && "line-through")}>
        {g.token}
      </TableCell>
      <TableCell>{g.scope}</TableCell>
      <TableCell className="hidden font-mono text-[0.8125rem] desktop:table-cell">
        {g.fields}
      </TableCell>
      <TableCell className="hidden tablet:table-cell">
        <span className="flex flex-col gap-1">
          {g.programs.map((p) => (
            <code className="font-mono text-[0.8125rem]" key={p}>
              {p}
            </code>
          ))}
        </span>
      </TableCell>
      <TableCell className="hidden font-mono text-[0.8125rem] whitespace-nowrap tablet:table-cell">
        {g.uses}
      </TableCell>
      <TableCell className="hidden font-mono text-[0.8125rem] whitespace-nowrap desktop:table-cell">
        {ends(g.endsAt)}
      </TableCell>
      <TableCell>
        <span className="flex flex-wrap gap-1.5">
          <GrantPill status={g.state} />
          {g.reveal && (
            <Pill icon={<Eye aria-hidden />} tone="danger">
              Reveal
            </Pill>
          )}
        </span>
      </TableCell>
      <TableCell className="text-right">
        {active && (
          <>
            <Button
              aria-label={`Revoke grant for ${g.token}`}
              loading={fetcher.state !== "idle"}
              onClick={() => setConfirming(true)}
              size="sm"
              variant="secondary"
            >
              Revoke
            </Button>
            <AlertDialog onOpenChange={setConfirming} open={confirming}>
              <AlertDialogContent>
                <AlertDialogTitle>Revoke this grant?</AlertDialogTitle>
                <AlertDialogDescription>
                  {g.token} will have to ask again before using {g.scope}.
                </AlertDialogDescription>
                <div className="flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() =>
                      void fetcher.submit(
                        { id: g.id, intent: "revoke" },
                        { action: "/grants", method: "post" },
                      )
                    }
                    variant="danger"
                  >
                    Revoke grant
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

/** U-15: the user's grants, active ones first, with Revoke. */
export const GrantsTable = ({ grants }: { grants: GrantRow[] }) => (
  <Card className="overflow-hidden">
    <Table>
      <TableHead>
        <tr>
          <TableHeaderCell>Token</TableHeaderCell>
          <TableHeaderCell>Secrets or folder</TableHeaderCell>
          <TableHeaderCell className="hidden desktop:table-cell">Fields</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Programs</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Uses</TableHeaderCell>
          <TableHeaderCell className="hidden desktop:table-cell">Ends</TableHeaderCell>
          <TableHeaderCell>State</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {grants.map((g) => (
          <Row g={g} key={g.id} />
        ))}
      </TableBody>
    </Table>
  </Card>
);
