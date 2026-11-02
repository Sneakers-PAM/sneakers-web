import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Label,
  PageHeader,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type {
  GetTelemetryResponse,
  TelemetryRestart,
  TelemetrySettings,
} from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { noAutofill } from "@/lib/noAutofill";
import { runAction } from "@/lib/osadmin/action";
import { telemetry } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";
import { useInstalledProduct } from "@/lib/useInstalledProduct";

/**
 * How often an open page reads the box again: a restart's phases and each service's state
 * change on their own, and the box checks its workloads every 3 seconds.
 */
export const TELEMETRY_POLL_MS = 3000;

const UNVERIFIED_WARNING = "Telemetry goes to a collector that isn't checked";

/** The gateway's words for a service's export state, as a badge. */
const SERVICE_LOOK: Record<string, { label: string; tone: "neutral" | "ok" | "warn" }> = {
  issue: { label: "Issue", tone: "warn" },
  off: { label: "Off", tone: "neutral" },
  sending: { label: "Sending", tone: "ok" },
  unknown: { label: "Unknown", tone: "neutral" },
};

/**
 * One of the installed product's pages: the OTLP collector its services export traces, metrics
 * and, when switched on, logs to. Saving restarts the services that read the settings, phase by
 * phase, and the page follows that restart and each service's export state as the box gives them.
 */
export default function Telemetry() {
  const { loaded, product } = useInstalledProduct();
  const [data, setData] = useState<GetTelemetryResponse>();
  const [unavailable, setUnavailable] = useState(false);
  const [form, setForm] = useState<TelemetrySettings>();
  const [saved, setSaved] = useState<"" | "restarting" | "unchanged">("");

  const read = (fill: boolean) =>
    void telemetry
      .get()
      .then((answer) => {
        setData(answer);
        if (fill) setForm(answer.settings);
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(() => {
    if (!product) return;
    read(true);
    const timer = setInterval(() => {
      if (!document.hidden) read(false);
    }, TELEMETRY_POLL_MS);
    return () => clearInterval(timer);
  }, [product]);

  if (!loaded) return null;
  if (!product) {
    return (
      <div className="p-5.5">
        <EmptyState
          body="This page belongs to a product, and no product is installed on this box."
          loader={false}
          title="Nothing here"
        />
      </div>
    );
  }
  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Telemetry" />
      </div>
    );
  }
  if (!data || !form) return null;

  if (data.state === "not in this product") {
    return (
      <div className="flex flex-col gap-5 p-5.5">
        <PageHeader eyebrow={product.name} title="Telemetry" />
        <Card>
          <div className="p-5.5">
            <p className="m-0 text-small">
              {product.name} exports no telemetry, so there&apos;s no collector to set.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const update = (patch: Partial<TelemetrySettings>) => {
    setForm({ ...form, ...patch });
    setSaved("");
  };
  const save = () =>
    void runAction(() => telemetry.set({ settings: form }), {
      onSuccess: (answer) => {
        setSaved(answer.restarting ? "restarting" : "unchanged");
        read(true);
      },
    });
  const retry = () =>
    void runAction(() => telemetry.retryRestart(), { onSuccess: () => read(false) });

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow={product.name} title="Telemetry" />
      <Card>
        <CardHeader
          aside={
            <Badge tone={data.state === "on" ? "ok" : "neutral"}>
              {data.state === "on" ? "Exporting" : "Export off"}
            </Badge>
          }
          subtitle={`The OTLP collector ${product.name}'s services export to${data.label ? `: ${data.label.toLowerCase()}` : ""}. Saving needs a fresh code.`}
          title="Collector"
        />
        <form
          className="flex flex-col gap-4 p-5.5"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Label className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(enabled) => update({ enabled })} />
            Export
          </Label>
          {form.skipVerify && (
            <Alert role="alert" title={UNVERIFIED_WARNING} tone="warn">
              With verification off, traces and metrics go to a collector whose identity isn&apos;t
              checked: anyone on the path to it can read them, or pose as the collector. No logs
              leave while verification is off. Use a certificate the box trusts wherever the
              collector supports it.
            </Alert>
          )}
          <Field
            hint="https://<host>[:<port>], the collector's OTLP gRPC address, normally port 4317; 443 when no port is given. Off keeps it saved."
            label="Endpoint"
          >
            <Input
              {...noAutofill()}
              onChange={(event) => update({ endpoint: event.target.value.trim() })}
              placeholder="https://collector.example.org:4317"
              value={form.endpoint}
            />
          </Field>
          <Label className="flex items-center gap-3">
            <Switch
              checked={!form.skipVerify}
              onCheckedChange={(verify) => update({ skipVerify: !verify })}
            />
            Verify the certificate
          </Label>
          <Label className="flex items-center gap-3">
            <Switch checked={form.logs} onCheckedChange={(logs) => update({ logs })} />
            Export logs
          </Label>
          {data.logsHeld && (
            <p className="m-0 text-small">
              Logs are on but stay on the box: none leave while the collector&apos;s certificate
              isn&apos;t verified.
            </p>
          )}
          <p className="m-0 text-small text-muted">
            Saving checks the collector first and saves nothing if it doesn&apos;t answer. A change
            restarts the services that read these settings, phase by phase, while {product.name}{" "}
            keeps running; a service can be briefly unavailable during its restart.
          </p>
          {saved === "unchanged" && (
            <p className="m-0 text-small" role="status">
              Saved: nothing the services read changed, so nothing restarts.
            </p>
          )}
          {saved === "restarting" && (
            <p className="m-0 text-small" role="status">
              Saved: the services restart phase by phase with the new settings.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Save and restart</Button>
          </div>
        </form>
      </Card>
      {data.restart.state !== "none" && <RestartCard onRetry={retry} restart={data.restart} />}
      <Card>
        <CardHeader subtitle="Each service's export, as the product reports it." title="Services" />
        <div className="p-5.5">
          {data.statusError ? (
            <Alert title="The services' states can't be read" tone="warn">
              {data.statusError}
            </Alert>
          ) : (
            <Table aria-label="Services">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Service</TableHeaderCell>
                  <TableHeaderCell>Export</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.workloads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>No services reported.</TableCell>
                  </TableRow>
                )}
                {data.workloads.map((workload) => {
                  const look = SERVICE_LOOK[workload.state] ?? {
                    label: workload.state || "Unknown",
                    tone: "neutral",
                  };
                  return (
                    <TableRow key={workload.name}>
                      <TableCell className="font-mono">{workload.name}</TableCell>
                      <TableCell>
                        <Badge tone={look.tone}>{look.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>
    </div>
  );
}

/** The last restart for a change: under way, done, or stopped at a phase with a Retry. */
const RestartCard = ({ onRetry, restart }: { onRetry: () => void; restart: TelemetryRestart }) => {
  const badge = {
    done: { label: "Done", tone: "ok" as const },
    failed: { label: "Stopped", tone: "warn" as const },
    running: { label: "Restarting", tone: "primary" as const },
  }[restart.state] ?? { label: restart.state, tone: "neutral" as const };
  return (
    <Card aria-label="Restart">
      <CardHeader
        aside={<Badge tone={badge.tone}>{badge.label}</Badge>}
        subtitle="The services that read these settings restart in the product's phase order; each phase comes back before the next starts."
        title="Restart"
      />
      <div className="flex flex-col gap-4 p-5.5">
        {restart.state === "running" && (
          <p className="m-0 flex items-center gap-3 text-small" role="status">
            <Spinner />
            Phase {restart.phase}: restarting its services.
          </p>
        )}
        {restart.state === "done" && (
          <p className="m-0 text-small">Every phase came back with the settings.</p>
        )}
        {restart.state === "failed" && (
          <Alert
            action={
              <Button onClick={onRetry} variant="secondary">
                Retry
              </Button>
            }
            role="alert"
            title={`The restart stopped at phase ${restart.phase}`}
            tone="danger"
          >
            {restart.workload ? `${restart.workload}: ` : ""}
            {restart.why}. Later phases keep the old settings until a retry, which carries on from
            this phase.
          </Alert>
        )}
      </div>
    </Card>
  );
};
