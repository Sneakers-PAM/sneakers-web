import {
  Alert,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { ListEventsResponse } from "@/lib/osadmin/types";

import { Advanced } from "@/components/Advanced";
import { audit } from "@/lib/osadmin/client";

// Explore only; no backend yet. Off until the flag is turned on for a release.
const SUPPORT_BUNDLE_ENABLED = false;

// The detail keys that hold an id or a fingerprint: shown in mono, since nobody reads them as
// words. The box puts a human name in the target and moves the id here.
const ID_KEYS = new Set([
  "certificate",
  "csr",
  "id",
  "key",
  "recording",
  "serial",
  "session",
  "upgrade",
  "upload",
]);

const LABELS: Record<string, string> = {
  csr: "CSR",
  id: "Id",
  sshSource: "SSH source",
};

const labelOf = (key: string) => {
  const words = key.replaceAll(/([A-Z])/g, " $1").toLowerCase();
  return LABELS[key] ?? words.charAt(0).toUpperCase() + words.slice(1);
};

const EventDetail = ({ detail }: { detail: Record<string, string> }) => {
  const entries = Object.entries(detail).toSorted(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return null;
  return (
    <dl className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-small text-muted">
      {entries.map(([key, value]) => (
        <div className="flex gap-1" key={key}>
          <dt>{labelOf(key)}</dt>
          <dd className={ID_KEYS.has(key) ? "font-mono" : undefined}>{value}</dd>
        </div>
      ))}
    </dl>
  );
};

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export default function Logs() {
  const [data, setData] = useState<ListEventsResponse>();
  const reload = () => void audit.list().then(setData);
  useEffect(reload, []);

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader
        actions={
          <Button
            onClick={() => void audit.exportLog().then((blob) => download(blob, "audit-log.jsonl"))}
            variant="secondary"
          >
            Export
          </Button>
        }
        eyebrow="Appliance"
        title="Logs and audit"
      />
      {!data.chainOk && (
        <Alert tone="danger">{data.chainError || "The audit chain doesn't verify."}</Alert>
      )}
      <Card>
        <CardHeader title="Events" />
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Time</TableHeaderCell>
              <TableHeaderCell>Actor</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Outcome</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.events.map((event, index) => (
              <TableRow key={`${event.action}-${String(index)}`}>
                <TableCell>{event.time}</TableCell>
                <TableCell>{event.actor}</TableCell>
                <TableCell>{event.action}</TableCell>
                <TableCell>
                  {event.target}
                  <EventDetail detail={event.detail ?? {}} />
                </TableCell>
                <TableCell>{event.outcome === "ok" ? "ok" : `refused (${event.code})`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Advanced label="Advanced: support bundle">
        {SUPPORT_BUNDLE_ENABLED ? (
          <Button variant="secondary">Download support bundle</Button>
        ) : (
          <p className="text-small text-muted">Not available in this release.</p>
        )}
      </Advanced>
    </div>
  );
}
