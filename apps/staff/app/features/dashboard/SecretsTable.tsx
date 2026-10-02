import {
  Card,
  cn,
  HeartbeatPill,
  Input,
  plural,
  shortDate,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";

import type { StatusRow } from "@/features/dashboard/dashboard.server";

const Expires = ({ row }: { row: StatusRow }) => {
  if (!row.expiresAt) return <span className="text-muted">—</span>;
  if (row.expiry === "later") return <span>{shortDate(row.expiresAt)}</span>;
  const past = row.expiry === "past";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-small font-bold whitespace-nowrap",
        past ? "text-danger" : "text-warn",
      )}
    >
      {past ? (
        <X aria-hidden className="size-3.5" strokeWidth={3} />
      ) : (
        <Clock aria-hidden className="size-3.5" strokeWidth={2.5} />
      )}
      <span className="sr-only">{past ? "Expired" : "Expires soon"}: </span>
      {shortDate(row.expiresAt)}
    </span>
  );
};

const matches = (row: StatusRow, text: string): boolean => {
  const q = text.trim().toLowerCase();
  return !q || [row.name, row.typeName, row.folderPath].some((v) => v.toLowerCase().includes(q));
};

/** The rows behind a stat tile: filter by text, sort by name, open a secret. */
export const SecretsTable = ({
  empty,
  initialFilter,
  loading,
  rows,
}: {
  empty: ReactNode;
  initialFilter: string;
  loading: boolean;
  rows: StatusRow[];
}) => {
  const [filter, setFilter] = useState(initialFilter);
  const [descending, setDescending] = useState(false);
  const shown = rows.filter((r) => matches(r, filter));
  const sorted = descending ? shown.toReversed() : shown;

  if (!loading && rows.length === 0) return empty;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 px-4.5 py-3.5">
        <Input
          aria-label="Filter by name, type or folder"
          className="tablet:max-w-90"
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter by name, type or folder"
          type="search"
          value={filter}
        />
        <span aria-live="polite" className="ml-auto text-small text-muted">
          {loading ? "" : plural(sorted.length, "secret")}
        </span>
      </div>
      {loading ? (
        <div
          aria-busy="true"
          aria-label="Loading secrets"
          className="flex flex-col gap-4 border-t border-border p-4.5"
          role="status"
        >
          {[0, 1, 2, 3].map((index) => (
            <Skeleton className="h-5 w-full" key={index} />
          ))}
        </div>
      ) : (
        <Table className="relative">
          <TableHead>
            <tr>
              <TableHeaderCell aria-sort={descending ? "descending" : "ascending"}>
                <button
                  className="inline-flex items-center gap-1 uppercase"
                  onClick={() => setDescending((d) => !d)}
                  type="button"
                >
                  Name
                  {descending ? (
                    <ChevronUp aria-hidden className="size-3.5" />
                  ) : (
                    <ChevronDown aria-hidden className="size-3.5" />
                  )}
                </button>
              </TableHeaderCell>
              <TableHeaderCell className="hidden tablet:table-cell">Type</TableHeaderCell>
              <TableHeaderCell>Folder</TableHeaderCell>
              <TableHeaderCell>Expires</TableHeaderCell>
              <TableHeaderCell>Heartbeat</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link className="font-bold" to={`/secret/${r.id}`}>
                    {r.name}
                  </Link>
                </TableCell>
                <TableCell className="hidden tablet:table-cell">{r.typeName}</TableCell>
                <TableCell className="whitespace-nowrap">{r.folderPath}</TableCell>
                <TableCell>
                  <Expires row={r} />
                </TableCell>
                <TableCell>
                  <HeartbeatPill status={r.heartbeat} />
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td className="px-4.5 py-8 text-center text-muted" colSpan={5}>
                  {`No secrets match "${filter.trim()}"`}
                </td>
              </tr>
            )}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};
