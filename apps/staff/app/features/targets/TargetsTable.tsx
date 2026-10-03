import { refusalMessage } from "@sneakers-web/shell";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from "@sneakers-web/ui";
import { Circle, Diamond } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { TargetRow, TargetsResult } from "@/features/targets/model";

const Scope = ({ scope }: { scope: TargetRow["scope"] }) =>
  scope === "shared" ? (
    <Badge icon={<Diamond aria-hidden />} tone="neutral">
      Shared
    </Badge>
  ) : (
    <Badge
      className="border-[1.5px] border-sole bg-transparent text-sole"
      icon={<Circle aria-hidden className="fill-current" />}
    >
      Personal
    </Badge>
  );

const Row = ({ t }: { t: TargetRow }) => {
  const fetcher = useFetcher<TargetsResult>({ key: `target-delete-${t.id}` });
  const handled = useRef<unknown>(null);
  const [asking, setAsking] = useState(false);
  const inUse = t.secretCount > 0;

  useEffect(() => {
    const d = fetcher.data;
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.ok) toast(d.done);
    else if (d.inUse)
      toast.error(`${t.name} is still in use by a secret. Point the secret elsewhere first.`);
    else if (d.refusal) toast.error(refusalMessage(d.refusal));
  }, [fetcher.data, t.name]);

  return (
    <TableRow>
      <TableCell>
        <span className="flex flex-col gap-1">
          {t.canManage ? (
            <Link className="font-bold text-ink hover:text-primary" to={`/targets/${t.id}`}>
              {t.name}
            </Link>
          ) : (
            <b>{t.name}</b>
          )}
          <span className="flex flex-col items-start gap-1.5 tablet:hidden">
            <span className="font-mono text-small break-all text-muted">{t.hostname}</span>
            <Scope scope={t.scope} />
          </span>
        </span>
      </TableCell>
      <TableCell className="hidden font-mono tablet:table-cell">{t.hostname}</TableCell>
      <TableCell className="hidden tablet:table-cell">
        <Scope scope={t.scope} />
      </TableCell>
      <TableCell className="hidden desktop:table-cell">{t.connection ?? "Unknown"}</TableCell>
      <TableCell className="hidden font-mono tablet:table-cell">{t.secretCount}</TableCell>
      <TableCell className="text-right">
        {t.canManage && (
          <span className="flex flex-col items-end gap-2 tablet:flex-row tablet:justify-end">
            <Button asChild size="sm" variant="secondary">
              <Link aria-label={`Edit ${t.name}`} to={`/targets/${t.id}`}>
                Edit
              </Link>
            </Button>
            <Button
              aria-label={`Delete ${t.name}`}
              className="border-danger text-danger hover:border-danger hover:bg-danger-soft disabled:border-solid disabled:border-transparent disabled:bg-sunken disabled:text-muted"
              disabled={inUse}
              loading={fetcher.state !== "idle"}
              onClick={() => setAsking(true)}
              size="sm"
              title={inUse ? `In use by ${t.secretCount} secret(s)` : undefined}
              variant="secondary"
            >
              Delete
            </Button>
          </span>
        )}
        <AlertDialog onOpenChange={setAsking} open={asking}>
          <AlertDialogContent>
            <AlertDialogTitle>Delete {t.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The target goes away for good. No secret uses it, so nothing else changes.
            </AlertDialogDescription>
            <div className="flex justify-end gap-2.5">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  void fetcher.submit(
                    { id: t.id, intent: "delete", name: t.name },
                    { action: "/targets", method: "post" },
                  )
                }
              >
                Delete
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
};

/** U-10's table: name, hostname, scope, connection and use, with Edit and Delete for owners. */
export const TargetsTable = ({ rows }: { rows: TargetRow[] }) => (
  <Card className="overflow-hidden">
    <Table aria-label="Targets">
      <TableHead>
        <tr>
          <TableHeaderCell>Name</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Hostname</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">Scope</TableHeaderCell>
          <TableHeaderCell className="hidden desktop:table-cell">Connection</TableHeaderCell>
          <TableHeaderCell className="hidden tablet:table-cell">In use</TableHeaderCell>
          <TableHeaderCell>
            <span className="sr-only">Actions</span>
          </TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((t) => (
          <Row key={t.id} t={t} />
        ))}
      </TableBody>
    </Table>
  </Card>
);
