import {
  Badge,
  Button,
  Card,
  CardHeader,
  clockTime,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";

import type { Elevation } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { elevation as elevationClient } from "@/lib/osadmin/client";

const when = (iso?: string) => (iso ? `${shortDate(iso)} ${clockTime(iso)}` : "");

/** The root shells: who opened one, from where, and how it ended. Owners end an open one. */
export const RootShellsCard = ({
  elevations,
  isOwner,
  onChanged,
}: {
  elevations: Elevation[];
  isOwner: boolean;
  onChanged: () => void;
}) => (
  <Card>
    <CardHeader title="Root shells" />
    <p className="px-5.5 pt-4 text-small text-muted">
      A root operator opens one from the SSH menu with a code from the Root shell page. Every root
      shell is recorded.
    </p>
    <Table aria-label="Root shells">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Session</TableHeaderCell>
          <TableHeaderCell>Admin</TableHeaderCell>
          <TableHeaderCell>From</TableHeaderCell>
          <TableHeaderCell>Started</TableHeaderCell>
          <TableHeaderCell>State</TableHeaderCell>
          <TableHeaderCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {elevations.length === 0 && (
          <TableRow>
            <TableCell colSpan={6}>No root shells yet.</TableCell>
          </TableRow>
        )}
        {elevations.map((shell) => (
          <TableRow key={shell.id}>
            <TableCell className="font-mono">{shell.id}</TableCell>
            <TableCell>{shell.admin}</TableCell>
            <TableCell className="font-mono">{shell.sourceAddress}</TableCell>
            <TableCell>{when(shell.started ?? shell.requested)}</TableCell>
            <TableCell>
              <Badge tone={shell.state === "active" ? "warn" : "neutral"}>{shell.state}</Badge>
              {shell.endReason ? ` (${shell.endReason})` : ""}
            </TableCell>
            <TableCell>
              {shell.state === "active" && isOwner && (
                <Button
                  onClick={() =>
                    void runAction(() => elevationClient.terminate(shell.id), {
                      onSuccess: onChanged,
                    })
                  }
                  size="sm"
                  variant="danger"
                >
                  End
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Card>
);
