import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  LongValue,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { GetBackupsResponse, RecoveryKey, RootKeyRotation } from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { downloadEscrow, ESCROW_NOTE } from "@/features/setup/RecoveryKeysStep";
import { noAutofill } from "@/lib/noAutofill";
import { runAction } from "@/lib/osadmin/action";
import { backup, rootKey, setup } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";
import { useSession } from "@/lib/useSession";

export default function Backups() {
  const { isOwner } = useSession();
  const [data, setData] = useState<GetBackupsResponse>();
  const [recoveryKeys, setRecoveryKeys] = useState<RecoveryKey[]>();
  const [schedule, setSchedule] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [targets, setTargets] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [rotation, setRotation] = useState<RootKeyRotation>();
  const [confirming, setConfirming] = useState(false);

  const reload = () =>
    void backup
      .get()
      .then((response) => {
        setData(response);
        setSchedule(response.policy?.schedule ?? "");
        setRetentionDays(response.policy?.retentionDays ?? 30);
        setTargets((response.policy?.targets ?? []).join(", "));
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(reload, []);
  // A refused GetSetup (an old box, or a session that just ended) leaves the keys unlisted.
  useEffect(
    () =>
      void setup
        .get()
        .then((response) => setRecoveryKeys(response.recoveryKeys))
        .catch(() => null),
    [],
  );

  // The vault root key's rotation, for an owner. While one runs the card asks again every
  // couple of seconds, so it reads done by itself.
  const loadRotation = () =>
    void rootKey
      .get()
      .then(setRotation)
      .catch(() => null);
  useEffect(() => {
    if (isOwner) loadRotation();
  }, [isOwner]);
  useEffect(() => {
    if (rotation?.state !== "running") return;
    const timer = setTimeout(loadRotation, 1500);
    return () => clearTimeout(timer);
  }, [rotation]);

  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Backups" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader
        actions={
          <Button onClick={() => void runAction(() => backup.run(), { onSuccess: reload })}>
            Run now
          </Button>
        }
        eyebrow="Appliance"
        title="Backups"
      />
      <Card>
        <CardHeader
          aside={<Link to="/setup">Manage recovery keys</Link>}
          subtitle={`${String(recoveryKeys?.length ?? 0)} set`}
          title="Recovery keys"
        />
        <div className="flex flex-col gap-1 p-5.5 text-[0.8125rem]">
          {(recoveryKeys ?? []).map((key) => (
            <p key={key.fingerprint}>
              <LongValue value={key.fingerprint} /> ({key.label})
            </p>
          ))}
        </div>
        {isOwner && (
          <div className="flex flex-col gap-3 px-5.5 pb-5.5">
            <p className="m-0 text-small">
              Download the escrow after the product is installed, after an import, and after
              anything that changes the keys. {ESCROW_NOTE}
            </p>
            <Button className="self-start" onClick={downloadEscrow} variant="secondary">
              Download the escrow
            </Button>
          </div>
        )}
      </Card>
      {isOwner && rotation && (
        <Card>
          <CardHeader title="Vault root key" />
          <section aria-label="Vault root key" className="flex flex-col gap-3 p-5.5 text-small">
            {rotation.available ? (
              <>
                <p className="m-0">
                  {rotation.state === "running" &&
                    `Rotating the root key: ${rotation.step || "starting"}.`}
                  {rotation.state === "stopped" &&
                    `The rotation stopped at ${rotation.step || "an early step"}${
                      rotation.why ? `: ${rotation.why}` : ""
                    }. Nothing was deleted; carrying on picks it up where it stopped.`}
                  {rotation.state === "done" &&
                    "The root key was rotated. Download a new escrow: an older one no longer opens the vault."}
                  {rotation.state === "none" && "The root key hasn't been rotated on this box."}
                </p>
                {rotation.state !== "running" && (
                  <Button
                    className="self-start"
                    onClick={() => setConfirming(true)}
                    variant="secondary"
                  >
                    {rotation.state === "stopped" ? "Carry on rotating" : "Rotate root key"}
                  </Button>
                )}
              </>
            ) : (
              <p className="m-0">The installed product can&apos;t rotate its root key.</p>
            )}
          </section>
          <AlertDialog onOpenChange={setConfirming} open={confirming}>
            <AlertDialogContent>
              <AlertDialogTitle>Rotate the vault root key?</AlertDialogTitle>
              <AlertDialogDescription>
                The box makes a new root key, moves the vault&apos;s working keys to it and checks
                each one opens before the old key is retired. A new escrow carries only the new key,
                and an older escrow no longer opens the vault, so download a new one afterwards. It
                runs like a product update and asks for a fresh sign-in.
              </AlertDialogDescription>
              <div className="flex justify-end gap-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    void runAction(() => rootKey.rotate(), {
                      onSuccess: () =>
                        setRotation({ available: true, state: "running", step: "", why: "" }),
                    })
                  }
                >
                  Rotate root key
                </AlertDialogAction>
              </div>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      )}
      <Card>
        <CardHeader title="Policy" />
        <form
          className="flex flex-col gap-3 p-5.5"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              () =>
                backup.setPolicy({
                  retentionDays,
                  schedule,
                  targets: targets
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                }),
              { onSuccess: reload },
            );
          }}
        >
          <Field hint="HH:MM local" label="Schedule">
            <Input
              {...noAutofill()}
              onChange={(event) => setSchedule(event.target.value)}
              value={schedule}
            />
          </Field>
          <Field label="Retention (days)">
            <Input
              {...noAutofill()}
              onChange={(event) => setRetentionDays(Number(event.target.value))}
              type="number"
              value={retentionDays}
            />
          </Field>
          <Field hint="Comma-separated" label="Targets">
            <Input
              {...noAutofill()}
              onChange={(event) => setTargets(event.target.value)}
              value={targets}
            />
          </Field>
          <Button type="submit">Save policy</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Backup sets" />
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>ID</TableHeaderCell>
              <TableHeaderCell>Taken</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Size</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.sets.map((set) => (
              <TableRow key={set.id}>
                <TableCell className="font-mono text-[0.8125rem]">{set.id}</TableCell>
                <TableCell>{set.taken}</TableCell>
                <TableCell>{set.target}</TableCell>
                <TableCell>{set.sizeBytes}</TableCell>
                <TableCell>
                  <Button
                    onClick={() =>
                      void runAction(() => backup.restore(set.id), { successMessage: "Restoring." })
                    }
                    size="sm"
                    variant="secondary"
                  >
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
