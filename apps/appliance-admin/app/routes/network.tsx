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
import { useEffect, useState } from "react";

import type { GetNetworkResponse, NetdCheck } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { network } from "@/lib/osadmin/client";

const list = (value: string): string[] =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export default function Network() {
  const [data, setData] = useState<GetNetworkResponse>();
  const [checks, setChecks] = useState<NetdCheck[]>();
  const [hostname, setHostname] = useState("");
  const [dns, setDns] = useState("");
  const [ntp, setNtp] = useState("");
  const [allowList, setAllowList] = useState("");
  const [confirmToken, setConfirmToken] = useState("");

  const reload = () =>
    void network.get().then((response) => {
      setData(response);
      setHostname(response.settings?.hostname ?? "");
      setDns((response.settings?.dns ?? []).join(", "));
      setNtp((response.settings?.ntp ?? []).join(", "));
      setAllowList((response.settings?.allowList ?? []).join(", "));
    });
  useEffect(reload, []);

  if (!data?.settings) return null;
  const { settings } = data;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Network" />
      {data.pending && (
        <Alert
          action={
            confirmToken && (
              <Button
                onClick={() =>
                  void runAction(() => network.confirm(confirmToken), {
                    onSuccess: () => {
                      setConfirmToken("");
                      reload();
                    },
                  })
                }
                size="sm"
              >
                Confirm
              </Button>
            )
          }
          role="status"
          tone="warn"
        >
          A network change is pending. It reverts in 120 seconds unless confirmed.
        </Alert>
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
                  setConfirmToken(response.token);
                  reload();
                },
                successMessage: "Applied. Confirm within 120 seconds.",
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
                    <Pill
                      tone={
                        check.status === "ok" ? "ok" : check.status === "warn" ? "warn" : "danger"
                      }
                    >
                      {check.status}
                    </Pill>
                  </TableCell>
                  <TableCell>{check.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
