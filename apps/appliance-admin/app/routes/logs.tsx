import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Segmented,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { ListEventsResponse } from "@/lib/osadmin/types";

import { Advanced } from "@/components/Advanced";
import { logsDownloadEnabled } from "@/lib/features";
import { LOG_PRESETS, type LogPreset, LogsWindowError } from "@/lib/logsWindow";
import { noAutofill } from "@/lib/noAutofill";
import { audit } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";

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

const OLDER_BOX =
  "This box's Base OS can't make a support bundle yet. Update the Base OS, then try again.";

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/** An older box has no support bundle; anything else, the box said why itself. */
const bundleError = (error: unknown): string => {
  if (isNotAvailable(error)) return OLDER_BOX;
  return error instanceof Error ? error.message : "The support bundle didn't download.";
};

const PRESET_LABELS: Record<LogPreset, string> = {
  "15m": "15 minutes",
  "1h": "1 hour",
  "24h": "24 hours",
  "6h": "6 hours",
};

const CUSTOM = "custom";

type LogChoice = LogPreset | typeof CUSTOM;

const LOG_WINDOWS: { label: string; value: LogChoice }[] = [
  ...LOG_PRESETS.map((value) => ({ label: PRESET_LABELS[value], value })),
  { label: "Custom range", value: CUSTOM },
];

/** Why a log download failed, in the box's own words where it gave any. */
const logsError = (error: unknown): string => {
  if (error instanceof LogsWindowError) return error.message;
  if (isNotAvailable(error))
    return "This box can't download its logs yet. Update it, then try again.";
  return error instanceof Error ? error.message : "The logs didn't download.";
};

// A datetime-local value is the admin's own clock; the box wants UTC, so it is converted here.
const asUtc = (value: string) => (value ? new Date(value).toISOString() : "");

const exportLog = () =>
  void audit
    .exportLog()
    .then((blob) => {
      download(blob, "audit-log.jsonl");
      toast("Audit log exported.");
    })
    .catch(() => toast("The audit log didn't export. Try again."));

export default function Logs() {
  const [data, setData] = useState<ListEventsResponse>();
  const [bundling, setBundling] = useState(false);
  const [bundleRefusal, setBundleRefusal] = useState("");
  const [windowChoice, setWindowChoice] = useState<LogChoice>("24h");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [logging, setLogging] = useState(false);
  const [logsRefusal, setLogsRefusal] = useState("");
  const reload = () => void audit.list().then(setData);
  useEffect(reload, []);

  const downloadBundle = () => {
    setBundling(true);
    setBundleRefusal("");
    void audit
      .exportSupportBundle()
      .then(({ blob, fileName }) => {
        download(blob, fileName);
        toast("Support bundle downloaded.");
      })
      .catch((error: unknown) => setBundleRefusal(bundleError(error)))
      .finally(() => setBundling(false));
  };

  const downloadLogs = () => {
    setLogging(true);
    setLogsRefusal("");
    void (async () => {
      try {
        const { blob, fileName } = await audit.exportLogs(
          windowChoice === CUSTOM ? { from: asUtc(from), to: asUtc(to) } : { preset: windowChoice },
        );
        download(blob, fileName);
        toast("Logs downloaded.");
      } catch (error) {
        setLogsRefusal(logsError(error));
      } finally {
        setLogging(false);
      }
    })();
  };

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader
        actions={
          <Button onClick={exportLog} variant="secondary">
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
      {logsDownloadEnabled() && (
        <Card>
          <CardHeader title="Download logs" />
          <section aria-label="Download logs" className="flex flex-col items-start gap-3 p-5.5">
            <p className="m-0 text-small text-muted">
              One .tar.gz of the box&apos;s cluster and system logs for the time you pick, with no
              secrets in it. The box writes it as you wait, and only one download runs at a time.
            </p>
            <Segmented
              label="Time window"
              onChange={setWindowChoice}
              options={LOG_WINDOWS}
              value={windowChoice}
            />
            {windowChoice === CUSTOM && (
              <div className="flex flex-wrap gap-3">
                <Field label="From">
                  <Input
                    {...noAutofill()}
                    onChange={(event) => setFrom(event.target.value)}
                    type="datetime-local"
                    value={from}
                  />
                </Field>
                <Field label="To">
                  <Input
                    {...noAutofill()}
                    onChange={(event) => setTo(event.target.value)}
                    type="datetime-local"
                    value={to}
                  />
                </Field>
              </div>
            )}
            <Button disabled={logging} onClick={downloadLogs} variant="secondary">
              {logging ? "Preparing the logs" : "Download logs"}
            </Button>
            {logging && (
              <p className="m-0 text-small text-muted" role="status">
                The box is writing the archive. It has no length to show, so this can take a while.
              </p>
            )}
            {logsRefusal && <Alert tone="danger">{logsRefusal}</Alert>}
          </section>
        </Card>
      )}
      <Advanced label="Advanced: support bundle">
        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-small text-muted">
            One zip file with the box&apos;s status, cluster and logs, with its secrets masked. The
            box writes it as you wait, which can take up to 10 minutes.
          </p>
          <Button disabled={bundling} onClick={downloadBundle} variant="secondary">
            {bundling ? "Preparing the bundle" : "Download support bundle"}
          </Button>
          {bundleRefusal && <Alert tone="danger">{bundleRefusal}</Alert>}
        </div>
      </Advanced>
    </div>
  );
}
