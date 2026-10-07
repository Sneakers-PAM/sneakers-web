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
                <TableCell>{event.target}</TableCell>
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
