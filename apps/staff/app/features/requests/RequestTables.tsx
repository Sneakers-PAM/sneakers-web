import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  cn,
  CountBadge,
  RequestPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  timeAgo,
} from "@sneakers-web/ui";
import { CircleCheck } from "lucide-react";

import type { RequestRow } from "@/features/requests/model";

type Open = (id: string) => void;

const messages = (r: RequestRow) => (r.comments.length > 0 ? `· ${r.comments.length} msg` : null);

/** The three cards of U-09 on a tablet or desktop: waiting on the viewer, their own, history. */
export const RequestTables = ({
  approver,
  awaiting,
  history,
  onOpen,
  open,
}: {
  approver: boolean;
  awaiting: RequestRow[];
  history: RequestRow[];
  onOpen: Open;
  open: RequestRow[];
}) => (
  <>
    {approver && (
      <Card
        aria-label="Awaiting your approval"
        className={cn(awaiting.length > 0 && "border-[1.5px] border-primary")}
      >
        <CardHeader
          aside={undefined}
          subtitle={awaiting.length > 0 ? <CountBadge count={awaiting.length} /> : undefined}
          title="Awaiting your approval"
        />
        {awaiting.length === 0 ? (
          <div className="flex items-center gap-3 px-5.5 py-5">
            <CircleCheck aria-hidden className="size-6 text-ok" />
            <div className="flex flex-col gap-0.5">
              <b>Nothing to approve</b>
              <span className="text-small text-muted">
                {"You'll get a notification when someone asks."}
              </span>
            </div>
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Resource</TableHeaderCell>
                <TableHeaderCell>Requested by</TableHeaderCell>
                <TableHeaderCell>Requested</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {awaiting.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[36rem]">
                    <div className="flex flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 font-bold">
                        {r.resource}
                        {r.isMove && <Badge tone="warn">Move · site admin</Badge>}
                      </span>
                      {r.reason && (
                        <span className="truncate text-small text-muted">“{r.reason}”</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2.5 whitespace-nowrap">
                      <Avatar name={r.requestedBy} size={28} tone="primary" />
                      <b>{r.requestedBy}</b>
                      {messages(r) && <span className="text-label text-muted">{messages(r)}</span>}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{timeAgo(r.requestedAt)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      aria-label={`Review ${r.resource}`}
                      className="min-w-30"
                      onClick={() => onOpen(r.id)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    )}

    <Card aria-label="Your open requests">
      <CardHeader title="Your open requests" />
      {open.length === 0 ? (
        <p className="m-0 px-5.5 py-5 text-muted">No open requests.</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell className="w-full">Resource</TableHeaderCell>
              <TableHeaderCell>Requested</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {open.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-bold">{r.resource}</TableCell>
                <TableCell className="whitespace-nowrap">{timeAgo(r.requestedAt)}</TableCell>
                <TableCell>
                  <RequestPill status={r.status} />
                </TableCell>
                <TableCell className="text-right">
                  <Button className="min-w-30" onClick={() => onOpen(r.id)} variant="secondary">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>

    <Card aria-label="History">
      <CardHeader subtitle="Resolved requests are removed after 90 days." title="History" />
      {history.length === 0 ? (
        <p className="m-0 px-5.5 py-5 text-muted">No resolved requests yet.</p>
      ) : (
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Resource</TableHeaderCell>
              <TableHeaderCell>Requested by</TableHeaderCell>
              <TableHeaderCell>Outcome</TableHeaderCell>
              <TableHeaderCell>Resolved by</TableHeaderCell>
              <TableHeaderCell>Resolved</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {history.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-bold">{r.resource}</TableCell>
                <TableCell>{r.requestedBy}</TableCell>
                <TableCell>
                  <RequestPill status={r.status} />
                </TableCell>
                <TableCell>{r.resolvedBy ?? "—"}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.resolvedAt ? timeAgo(r.resolvedAt) : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button onClick={() => onOpen(r.id)} size="sm" variant="secondary">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  </>
);
