import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Label,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetSetupResponse } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { setup } from "@/lib/osadmin/client";

export default function Setup() {
  const [data, setData] = useState<GetSetupResponse>();
  const [publicKey, setPublicKey] = useState("");
  const [label, setLabel] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);

  const reload = () => void setup.get().then(setData);
  useEffect(reload, []);

  if (!data) return null;

  const canFinish =
    data.recoveryKeys.length > 0 && (data.adminCount > 1 || data.singleAdminAcknowledged);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 p-5.5">
      <PageHeader eyebrow="First boot" title="Setup" />
      <Card>
        <CardHeader
          subtitle={`${String(data.recoveryKeys.length)} of ${String(data.maxRecoveryKeys)}`}
          title="Recovery keys"
        />
        <div className="flex flex-col gap-4 p-5.5">
          <p className="text-small text-muted">
            Any one of these keys can open every backup and the escrow. Keep the private keys off
            the appliance; the box never holds one.
          </p>
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Fingerprint</TableHeaderCell>
                <TableHeaderCell>Label</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.recoveryKeys.map((key) => (
                <TableRow key={key.fingerprint}>
                  <TableCell className="font-mono text-[0.8125rem]">{key.fingerprint}</TableCell>
                  <TableCell>{key.label}</TableCell>
                  <TableCell>
                    <Button
                      onClick={() =>
                        void runAction(() => setup.removeRecoveryKey(key.fingerprint), {
                          onSuccess: reload,
                        })
                      }
                      size="sm"
                      variant="secondary"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {data.recoveryKeys.length < data.maxRecoveryKeys && (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void runAction(() => setup.addRecoveryKey(publicKey, label), {
                  onSuccess: () => {
                    setPublicKey("");
                    setLabel("");
                    reload();
                  },
                });
              }}
            >
              <Field label="Public key (ssh-ed25519 or ssh-rsa, 3072 bits or more)">
                <Input
                  mono
                  onChange={(event) => setPublicKey(event.target.value)}
                  value={publicKey}
                />
              </Field>
              <Field label="Label">
                <Input onChange={(event) => setLabel(event.target.value)} value={label} />
              </Field>
              <Button disabled={!publicKey} type="submit">
                Add recovery key
              </Button>
            </form>
          )}
          {data.recoveryKeys.length > 0 && (
            <Button
              onClick={() =>
                void setup.downloadEscrow().then((response) => {
                  const bytes = atob(response.content);
                  const blob = new Blob([bytes], { type: "application/octet-stream" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = response.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                })
              }
              variant="secondary"
            >
              Download escrow ({data.escrowFile})
            </Button>
          )}
        </div>
      </Card>
      {data.singleAdminWarning && (
        <Alert title="One admin means no quorum" tone="warn">
          <div className="flex flex-col gap-3">
            <p>
              A factory reset later needs a quorum of appliance admins. With one admin there&apos;s
              no quorum, so a factory reset would mean re-flashing or re-creating the box.
            </p>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setAcknowledged(next);
                  if (next) {
                    void runAction(() => setup.acknowledgeSingleAdmin(), { onSuccess: reload });
                  }
                }}
              />
              I understand a single admin can&apos;t reach a quorum.
            </Label>
          </div>
        </Alert>
      )}
      <Button
        disabled={!canFinish}
        onClick={() =>
          void runAction(() => setup.finish(), {
            onSuccess: (response) => {
              toast("Setup finished.");
              globalThis.location.assign(response.productSetupUrl);
            },
          })
        }
      >
        Finish
      </Button>
      {data.productSetupUrl && (
        <a className="text-small text-primary underline" href={data.productSetupUrl}>
          Continue to the product&apos;s own setup
        </a>
      )}
    </div>
  );
}
