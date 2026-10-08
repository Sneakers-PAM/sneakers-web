import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useCallback, useEffect, useState } from "react";

import type {
  CheckState,
  GetNetworkResponse,
  NetdCheck,
  SetNetworkResponse,
} from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { network } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";

const list = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const CHECK_LOOK: Record<
  CheckState,
  { label: string; tone: "danger" | "neutral" | "ok" | "warn" }
> = {
  CHECK_STATE_FAILED: { label: "Failed", tone: "danger" },
  CHECK_STATE_OK: { label: "OK", tone: "ok" },
  CHECK_STATE_UNSPECIFIED: { label: "Unknown", tone: "neutral" },
  CHECK_STATE_WARN: { label: "Warning", tone: "warn" },
};

const checkLook = (check: NetdCheck) => CHECK_LOOK[check.state ?? "CHECK_STATE_UNSPECIFIED"];

const reverts = (seconds: number | undefined) =>
  seconds === undefined ? "unless confirmed" : `in ${String(seconds)} seconds unless confirmed`;

const unreachableMessage = (seconds: number | undefined, newUrl: string | undefined) =>
  `The box can't be reached at this address. The change reverts ${reverts(seconds)} from the new address${
    newUrl ? ` (${newUrl})` : ""
  }.`;

export default function Network() {
  const [data, setData] = useState<GetNetworkResponse>();
  const [checks, setChecks] = useState<NetdCheck[]>();
  const [hostname, setHostname] = useState("");
  const [dns, setDns] = useState("");
  const [ntp, setNtp] = useState("");
  const [allowList, setAllowList] = useState("");
  const [applied, setApplied] = useState<SetNetworkResponse>();
  const [deadline, setDeadline] = useState<number>();
  const [now, setNow] = useState(() => Date.now());
  const [unreachable, setUnreachable] = useState(false);

  const reload = useCallback(
    () =>
      void network.get().then((response) => {
        setData(response);
        setHostname(response.settings?.hostname ?? "");
        setDns((response.settings?.dns ?? []).join(", "));
        setNtp((response.settings?.ntp ?? []).join(", "));
        setAllowList((response.settings?.allowList ?? []).join(", "));
        if (!response.pending) {
          setApplied(undefined);
          setDeadline(undefined);
          setUnreachable(false);
        } else if (response.revertSecondsLeft !== undefined) {
          setNow(Date.now());
          setDeadline(Date.now() + response.revertSecondsLeft * 1000);
        }
      }),
    [],
  );
  useEffect(reload, [reload]);

  const secondsLeft =
    deadline === undefined ? undefined : Math.max(0, Math.ceil((deadline - now) / 1000));
  const pending = !!data?.pending;
  useEffect(() => {
    if (!pending || deadline === undefined) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending, deadline]);
  useEffect(() => {
    if (pending && secondsLeft === 0) reload();
  }, [pending, secondsLeft, reload]);

  if (!data?.settings) return null;
  const { settings } = data;
  // The token from Apply, or after a reload (or from the new address) the one GetNetwork
  // gives an owner session.
  const token = applied?.token || data.pendingToken;

  const confirm = (confirmToken: string) =>
    void runAction(
      async () => {
        try {
          await network.confirm(confirmToken);
        } catch (error) {
          if (error instanceof OsadminError && error.code === "unavailable") {
            setUnreachable(true);
            throw new Error(unreachableMessage(secondsLeft, applied?.newUrl));
          }
          throw error;
        }
      },
      { onSuccess: reload, successMessage: "Confirmed." },
    );

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Network" />
      {data.pending && (
        <Alert
          action={
            token && (
              <Button onClick={() => confirm(token)} size="sm">
                Confirm
              </Button>
            )
          }
          role="status"
          tone="warn"
        >
          <span className="flex flex-col gap-1">
            <span>A network change is pending. It reverts {reverts(secondsLeft)}.</span>
            {applied?.movesManagement && (
              <span>
                This change moves the box&apos;s management address. Open{" "}
                {applied.newUrl ? (
                  <a className="font-mono underline" href={applied.newUrl}>
                    {applied.newUrl}
                  </a>
                ) : (
                  "the new address"
                )}
                , sign in and confirm there.
              </span>
            )}
            {applied?.newCertificate && (
              <span>
                The box makes a new certificate for the new name or address. If this page stops
                answering, reload it, accept the new certificate and confirm.
              </span>
            )}
            {!token && <span>Only an owner can confirm it.</span>}
          </span>
        </Alert>
      )}
      {data.pending && unreachable && (
        <Alert tone="danger">{unreachableMessage(secondsLeft, applied?.newUrl)}</Alert>
      )}
      <Card>
        <CardHeader title="Addresses" />
        <div className="flex flex-col gap-1 p-5.5 text-small">
          {data.managementAddresses.map((address) => (
            <p className="font-mono" key={address}>
              {address}
            </p>
          ))}
          <p>{data.ntpSynced ? `NTP synced, offset ${data.ntpOffsetMs} ms` : "NTP not synced"}</p>
        </div>
      </Card>
      <Card>
        <CardHeader
          aside={
            <Button
              onClick={() => void network.runChecks().then((r) => setChecks(r.checks))}
              size="sm"
              variant="secondary"
            >
              Run checks
            </Button>
          }
          title="Settings"
        />
        <form
          className="flex flex-col gap-4 p-5.5"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              () =>
                network.set({
                  ...settings,
                  allowList: list(allowList),
                  dns: list(dns),
                  hostname,
                  ntp: list(ntp),
                }),
              {
                onSuccess: (response) => {
                  setApplied(response);
                  setUnreachable(false);
                  setNow(Date.now());
                  setDeadline(Date.now() + response.revertAfterSeconds * 1000);
                  reload();
                },
              },
            );
          }}
        >
          <Field label="Hostname">
            <Input onChange={(event) => setHostname(event.target.value)} value={hostname} />
          </Field>
          <Field hint="Comma-separated" label="DNS servers">
            <Input onChange={(event) => setDns(event.target.value)} value={dns} />
          </Field>
          <Field hint="Comma-separated" label="NTP servers">
            <Input onChange={(event) => setNtp(event.target.value)} value={ntp} />
          </Field>
          <Field hint="Comma-separated CIDRs" label="Allow-list (22 and 8443)">
            <Input onChange={(event) => setAllowList(event.target.value)} value={allowList} />
          </Field>
          <Button type="submit">Apply</Button>
        </form>
      </Card>
      {checks && (
        <Card>
          <CardHeader title="Checks" />
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Check</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Detail</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checks.map((check) => (
                <TableRow key={check.name}>
                  <TableCell>{check.name}</TableCell>
                  <TableCell>
                    <Pill tone={checkLook(check).tone}>{checkLook(check).label}</Pill>
                  </TableCell>
                  <TableCell>
                    {check.code && <span className="mr-2 font-mono">{check.code}</span>}
                    {check.detail}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
