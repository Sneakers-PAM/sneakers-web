import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Pill,
  Segmented,
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
  CommitNetworkResponse,
  GetNetworkResponse,
  Ipv4Mode,
  Ipv6Mode,
  NetdCheck,
  NetdSettings,
  StagedReview,
} from "@/lib/osadmin/types";

import { NetworkReverted } from "@/components/StatusBanners";
import { networkChanged } from "@/lib/networkChange";
import { noAutofill } from "@/lib/noAutofill";
import { runAction } from "@/lib/osadmin/action";
import { network } from "@/lib/osadmin/client";
import { isNotAvailable, OsadminError, plainMessage } from "@/lib/osadmin/errors";

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

const unreachableMessage = (seconds: number | undefined) =>
  `The box can't be reached at this address. The change reverts ${reverts(seconds)} from the new address.`;

const IPV4_MODES: { label: string; value: Ipv4Mode }[] = [
  { label: "DHCP", value: "IPV4_MODE_DHCP" },
  { label: "Static", value: "IPV4_MODE_STATIC" },
  { label: "Off", value: "IPV4_MODE_OFF" },
];

const IPV6_MODES: { label: string; value: Ipv6Mode }[] = [
  { label: "SLAAC", value: "IPV6_MODE_SLAAC" },
  { label: "DHCPv6", value: "IPV6_MODE_DHCPV6" },
  { label: "Static", value: "IPV6_MODE_STATIC" },
  { label: "Off", value: "IPV6_MODE_OFF" },
];

/** A commit's outcome. `dropped`: the box stopped answering here before it replied. */
interface Committed extends CommitNetworkResponse {
  dropped?: boolean;
}

const Reconnect = ({ review }: { review: StagedReview }) =>
  review.newUrl ? (
    <>
      Open{" "}
      <a className="font-mono underline" href={review.newUrl}>
        {review.newUrl}
      </a>{" "}
      and sign in there.
    </>
  ) : (
    "DHCP or SLAAC gives the new address, so find it on the box's console."
  );

/** What's staged and what committing it does, before anything moves. */
const StagedNotice = ({
  busy,
  onCommit,
  onDiscard,
  review,
}: {
  busy: boolean;
  onCommit: () => void;
  onDiscard: () => void;
  review: StagedReview;
}) => (
  <Alert
    action={
      <span className="flex gap-2">
        <Button disabled={busy} onClick={onCommit} size="sm">
          Commit
        </Button>
        <Button disabled={busy} onClick={onDiscard} size="sm" variant="secondary">
          Discard
        </Button>
      </span>
    }
    role="status"
    title="A network change is staged"
    tone="warn"
  >
    <span className="flex flex-col gap-1">
      <span>
        Nothing has changed yet; the fields below show it. Commit tests any new gateway from the new
        address first, then keeps the change for good, with no revert afterwards.
      </span>
      {review.movesManagement && (
        <span>
          This change moves the box&apos;s management address, so this page will drop when you
          commit. That&apos;s expected. <Reconnect review={review} />
        </span>
      )}
      {review.newCertificate && (
        <span>
          The box&apos;s certificate may change once this is kept, for the new name or address. If
          this page stops answering, reload it and accept the new certificate.
        </span>
      )}
      {review.changesAllowList && (
        <span>
          This change touches the allow-list. If it shuts you out, undo it on the console with
          Recover access.
        </span>
      )}
    </span>
  </Alert>
);

const CommitDone = ({ dropped, review, testedGateways }: Committed) => (
  <Alert role="status" tone="ok">
    <span className="flex flex-col gap-1">
      <span>
        {dropped
          ? "The box stopped answering here, which is expected after this change."
          : "Committed and kept."}
        {testedGateways.length > 0 && ` Gateway tested: ${testedGateways.join(", ")}.`}
      </span>
      {review.movesManagement && (
        <span>
          <Reconnect review={review} />
        </span>
      )}
      {dropped && !review.movesManagement && (
        <span>Reload this page and accept the new certificate.</span>
      )}
    </span>
  </Alert>
);

export default function Network() {
  const [data, setData] = useState<GetNetworkResponse>();
  const [checks, setChecks] = useState<NetdCheck[]>();
  const [hostname, setHostname] = useState("");
  const [dns, setDns] = useState("");
  const [ntp, setNtp] = useState("");
  const [allowList, setAllowList] = useState("");
  const [ipv4Mode, setIpv4Mode] = useState<Ipv4Mode>("IPV4_MODE_DHCP");
  const [ipv4Address, setIpv4Address] = useState("");
  const [ipv4Gateway, setIpv4Gateway] = useState("");
  const [ipv6Mode, setIpv6Mode] = useState<Ipv6Mode>("IPV6_MODE_SLAAC");
  const [ipv6Address, setIpv6Address] = useState("");
  const [ipv6Gateway, setIpv6Gateway] = useState("");
  const [deadline, setDeadline] = useState<number>();
  const [now, setNow] = useState(() => Date.now());
  const [unreachable, setUnreachable] = useState(false);
  const [committed, setCommitted] = useState<Committed>();
  const [committing, setCommitting] = useState(false);
  const [refused, setRefused] = useState<string>();
  const [noStage, setNoStage] = useState(false);

  const fill = useCallback((settings: NetdSettings) => {
    const { ipv4, ipv6 } = settings.management ?? {};
    setHostname(settings.hostname);
    setDns(settings.dns.join(", "));
    setNtp(settings.ntp.join(", "));
    setAllowList(settings.allowList.join(", "));
    setIpv4Mode(ipv4?.mode ?? "IPV4_MODE_DHCP");
    setIpv4Address(ipv4?.address ?? "");
    setIpv4Gateway(ipv4?.gateway ?? "");
    setIpv6Mode(ipv6?.mode ?? "IPV6_MODE_SLAAC");
    setIpv6Address(ipv6?.address ?? "");
    setIpv6Gateway(ipv6?.gateway ?? "");
  }, []);

  const reload = useCallback(
    () =>
      void network
        .get()
        .then((response) => {
          setData(response);
          const shown = response.staged ?? response.settings;
          if (shown) fill(shown);
          if (!response.pending) {
            setDeadline(undefined);
            setUnreachable(false);
          } else if (response.revertSecondsLeft !== undefined) {
            setNow(Date.now());
            setDeadline(Date.now() + response.revertSecondsLeft * 1000);
          }
        })
        .catch((error: unknown) => {
          // A new certificate can leave the page unable to read the box straight after a commit.
          if (!(error instanceof OsadminError && error.code === "unavailable")) throw error;
        }),
    [fill],
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
  // Staging builds on what's staged, as a second `network set` does over SSH.
  const base = data.staged ?? settings;
  const token = data.pendingToken;
  const stagedReview =
    committed?.dropped || committed?.review.movesManagement ? undefined : data.stagedReview;
  const stagedId = data.stagedId;

  const keep = async (confirmToken: string) => {
    try {
      await network.confirm(confirmToken);
    } catch (error) {
      if (error instanceof OsadminError && error.code === "unavailable") {
        setUnreachable(true);
        throw new Error(unreachableMessage(secondsLeft));
      }
      throw error;
    } finally {
      networkChanged();
    }
  };
  const confirm = (confirmToken: string) =>
    void runAction(() => keep(confirmToken), {
      onSuccess: reload,
      successMessage: "Confirmed.",
    });

  const stage = async () => {
    try {
      return await network.stage({
        ...base,
        allowList: list(allowList),
        dns: list(dns),
        hostname,
        management: {
          ...base.management,
          ipv4: {
            mode: ipv4Mode,
            ...(ipv4Mode === "IPV4_MODE_STATIC" && {
              address: ipv4Address,
              ...(ipv4Gateway && { gateway: ipv4Gateway }),
            }),
          },
          ipv6: {
            mode: ipv6Mode,
            ...(ipv6Mode === "IPV6_MODE_STATIC" && {
              address: ipv6Address,
              ...(ipv6Gateway && { gateway: ipv6Gateway }),
            }),
          },
        },
        ntp: list(ntp),
      });
    } catch (error) {
      if (!isNotAvailable(error)) throw error;
      setNoStage(true);
      return;
    }
  };

  const commit = async (id: string, review: StagedReview): Promise<Committed> => {
    try {
      return await network.commit(id);
    } catch (error) {
      const expected = review.movesManagement || review.newCertificate;
      if (expected && error instanceof OsadminError && error.code === "unavailable")
        return { dropped: true, review, testedGateways: [] };
      if (error instanceof OsadminError && error.symbol?.startsWith("NET_")) {
        setRefused(plainMessage(error));
        reload();
        throw new Error("The box refused the commit.");
      }
      throw error;
    }
  };

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Network" />
      {noStage && (
        <Alert tone="warn">
          This box&apos;s base OS doesn&apos;t have stage and commit yet, so this page can&apos;t
          change its network. Update the base OS on Updates, or use the console or{" "}
          <span className="font-mono">network set</span> over SSH.
        </Alert>
      )}
      {stagedReview && stagedId && (
        <StagedNotice
          busy={committing}
          onCommit={() => {
            setCommitting(true);
            setRefused(undefined);
            void runAction(() => commit(stagedId, stagedReview), {
              onSuccess: (result) => {
                networkChanged();
                setCommitted(result);
                if (!result.dropped && !result.review.movesManagement) reload();
              },
            }).finally(() => setCommitting(false));
          }}
          onDiscard={() => {
            setRefused(undefined);
            void runAction(() => network.discard(), { onSuccess: reload });
          }}
          review={stagedReview}
        />
      )}
      {refused && <Alert tone="danger">{refused}</Alert>}
      {committed && <CommitDone {...committed} />}
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
            {!token && <span>Only an owner can confirm it.</span>}
          </span>
        </Alert>
      )}
      {data.pending && unreachable && (
        <Alert tone="danger">{unreachableMessage(secondsLeft)}</Alert>
      )}
      {!data.pending && data.lastChangeReverted && (
        <NetworkReverted
          atStart={!!data.lastChangeRevertedAtStart}
          changeId={data.lastChangeId ?? ""}
        />
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
          {(data.learntDns ?? []).length > 0 && (
            <p>From DHCP, DNS: {(data.learntDns ?? []).join(", ")}</p>
          )}
          {(data.learntSearch ?? []).length > 0 && (
            <p>From DHCP, search domains: {(data.learntSearch ?? []).join(", ")}</p>
          )}
          {(data.learntNtp ?? []).length > 0 && (
            <p>From DHCP, NTP: {(data.learntNtp ?? []).join(", ")}</p>
          )}
          {(data.ntpServers ?? []).length > 0 && (
            <p>The clock asks: {(data.ntpServers ?? []).join(", ")}</p>
          )}
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
            void runAction(stage, {
              onSuccess: (response) => {
                if (!response) return;
                setCommitted(undefined);
                setRefused(undefined);
                reload();
              },
            });
          }}
        >
          <Field
            hint="Fully qualified, such as appliance.example.org. Certificates are checked against it."
            label="Hostname"
          >
            <Input
              {...noAutofill()}
              onChange={(event) => setHostname(event.target.value)}
              value={hostname}
            />
          </Field>
          <Field label="IPv4">
            <Segmented label="IPv4" onChange={setIpv4Mode} options={IPV4_MODES} value={ipv4Mode} />
          </Field>
          {ipv4Mode === "IPV4_MODE_STATIC" && (
            <>
              <Field hint="With its prefix, such as 192.0.2.10/24." label="IPv4 address">
                <Input
                  {...noAutofill()}
                  onChange={(event) => setIpv4Address(event.target.value)}
                  value={ipv4Address}
                />
              </Field>
              <Field hint="Commit tests it from the new address." label="IPv4 gateway">
                <Input
                  {...noAutofill()}
                  onChange={(event) => setIpv4Gateway(event.target.value)}
                  value={ipv4Gateway}
                />
              </Field>
            </>
          )}
          <Field label="IPv6">
            <Segmented label="IPv6" onChange={setIpv6Mode} options={IPV6_MODES} value={ipv6Mode} />
          </Field>
          {ipv6Mode === "IPV6_MODE_STATIC" && (
            <>
              <Field hint="With its prefix, such as 2001:db8::10/64." label="IPv6 address">
                <Input
                  {...noAutofill()}
                  onChange={(event) => setIpv6Address(event.target.value)}
                  value={ipv6Address}
                />
              </Field>
              <Field hint="Commit tests it from the new address." label="IPv6 gateway">
                <Input
                  {...noAutofill()}
                  onChange={(event) => setIpv6Gateway(event.target.value)}
                  value={ipv6Gateway}
                />
              </Field>
            </>
          )}
          <Field
            hint="Comma-separated. Leave empty to use the ones DHCP gives the box."
            label="DNS servers"
          >
            <Input {...noAutofill()} onChange={(event) => setDns(event.target.value)} value={dns} />
          </Field>
          <Field hint="Comma-separated" label="NTP servers">
            <Input {...noAutofill()} onChange={(event) => setNtp(event.target.value)} value={ntp} />
          </Field>
          <Field hint="Comma-separated CIDRs" label="Allow-list (22 and 8443)">
            <Input
              {...noAutofill()}
              onChange={(event) => setAllowList(event.target.value)}
              value={allowList}
            />
          </Field>
          <Button type="submit">Stage change</Button>
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
