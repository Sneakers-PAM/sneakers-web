import { Card, CardHeader, plural, Table, TableBody, TableCell, TableRow } from "@sneakers-web/ui";
import { Link } from "react-router";

import type { TopSecret } from "@/features/dashboard/dashboard.server";

import { lastOpened } from "@/features/dashboard/format";

/** The user's most-opened secrets, each a link to its page. */
export const TopSecrets = ({ now, secrets }: { now: number; secrets: TopSecret[] }) => {
  return (
    <Card aria-label="Top accessed secrets">
      <CardHeader subtitle="Your five most-opened" title="Top accessed secrets" />
      {secrets.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
          <b className="font-display text-[1.0625rem] font-bold">No access history yet</b>
          <span className="text-[0.875rem] text-muted">
            Secrets you open most will show up here.
          </span>
        </div>
      ) : (
        <Table className="relative">
          <TableBody>
            {secrets.map((s, index) => (
              <TableRow className="first:border-t-0" key={s.id}>
                <TableCell className="w-10 text-small text-muted">{index + 1}</TableCell>
                <TableCell>
                  <Link className="font-bold" to={`/secret/${s.id}`}>
                    {s.name}
                  </Link>
                </TableCell>
                <TableCell className="hidden tablet:table-cell">{s.folderPath}</TableCell>
                <TableCell className="hidden font-mono text-small whitespace-nowrap tablet:table-cell">
                  {plural(s.viewCount, "view")}
                </TableCell>
                <TableCell className="text-right text-small whitespace-nowrap text-muted">
                  {lastOpened(s.lastAccessedAt, now)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
};
