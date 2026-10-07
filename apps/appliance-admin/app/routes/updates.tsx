import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  PageHeader,
  Segmented,
  shortDate,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";

import type {
  Elevation,
  ElevationOverride,
  GetUpgradesResponse,
  UpdatePackage,
  UpgradePolicy,
} from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { runAction } from "@/lib/osadmin/action";
import { upgrade } from "@/lib/osadmin/client";
import { isNotAvailable, isStepUpRequired, OsadminError } from "@/lib/osadmin/errors";
import { useSession } from "@/lib/useSession";

/** An apply or revert the box refused because an elevated shell is open. */
interface Held {
  action: "apply" | "revert";
  message: string;
  version: string;
}

type Rebooting = { kind: "applying"; version: string } | { kind: "reverting" } | null;

/** True when the box refused an apply or revert because an elevated shell is open. */
const isElevated = (error: unknown): boolean =>
  error instanceof OsadminError && error.symbol === "UPGRADE_ELEVATED";

const holder = (elevation: Elevation): string =>
  `${elevation.admin} holds an elevated shell (${elevation.id})${elevation.started ? `, open since ${shortDate(elevation.started)}` : ""}: ${elevation.reason}`;

/** Where the file in hand is: nothing yet, sending, on the box, being verified, or done. */
type Step =
  | { fileName: string; kind: "received"; uploadId: string; via: "Fetched" | "Uploaded" }
  | { fileName: string; kind: "refused"; reason: string }
  | { fileName: string; kind: "uploading"; progress: number }
  | { fileName: string; kind: "verified"; updatePackage: UpdatePackage }
  | { fileName: string; kind: "verifying"; uploadId: string }
  | { kind: "idle" };

const describePolicy = (policy: UpgradePolicy): string =>
  policy.mode === "manual"
    ? "Manual only: an owner applies each update."
    : `Daily at ${policy.windowStart} for ${String(policy.windowMinutes)} minutes: a staged release applies in the window.`;

const describePackage = (updatePackage: UpdatePackage): string =>
  updatePackage.kind === "patch"
    ? `patch ${updatePackage.version} for ${updatePackage.bases.join(", ")}`
    : `full release ${updatePackage.version}`;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "The appliance refused the file.";

export default function Updates() {
  const { isOwner } = useSession();
  const [data, setData] = useState<GetUpgradesResponse>();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [mirrorFile, setMirrorFile] = useState("");
  const [confirmApply, setConfirmApply] = useState<null | string>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [rebooting, setRebooting] = useState<Rebooting>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [override, setOverride] = useState<{ elevation: Elevation; held: Held } | null>(null);
  const [mode, setMode] = useState<UpgradePolicy["mode"]>("automatic");
  const [windowStart, setWindowStart] = useState("02:00");
  const [windowMinutes, setWindowMinutes] = useState(120);
  const [mirrorUrl, setMirrorUrl] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () =>
    void upgrade
      .get()
      .then((response) => {
        setData(response);
        if (response.policy) {
          setMode(response.policy.mode);
          setWindowStart(response.policy.windowStart);
          setWindowMinutes(response.policy.windowMinutes);
          setMirrorUrl(response.policy.mirrorUrl);
        }
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(reload, []);

  const sendFile = () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setStep({ fileName: file.name, kind: "uploading", progress: 0 });
    upgrade
      .upload(file, (fraction) =>
        setStep({ fileName: file.name, kind: "uploading", progress: Math.round(fraction * 100) }),
      )
      .then(({ uploadId }) =>
        setStep({ fileName: file.name, kind: "received", uploadId, via: "Uploaded" }),
      )
      .catch((error: unknown) =>
        setStep({ fileName: file.name, kind: "refused", reason: errorText(error) }),
      );
  };

  const fetchFile = () => {
    const fileName = mirrorFile.trim();
    if (!fileName) return;
    void runAction(() => upgrade.fetch(fileName), {
      onSuccess: ({ uploadId }) => {
        setStep({ fileName, kind: "received", uploadId, via: "Fetched" });
        reload();
      },
    });
  };

  // StageUpdate verifies first and only then unpacks; a refused file is deleted on the box.
  // Refusals are shown in place, not as a toast, so the reason stays on screen.
  const verifyAndStage = (fileName: string, uploadId: string) => {
    void runAction(
      async () => {
        setStep({ fileName, kind: "verifying", uploadId });
        try {
          return await upgrade.stage(uploadId);
        } catch (error) {
          if (isStepUpRequired(error)) {
            setStep({ fileName, kind: "received", uploadId, via: "Uploaded" });
            throw error;
          }
          setStep({ fileName, kind: "refused", reason: errorText(error) });
          reload();
          return null;
        }
      },
      {
        onSuccess: (result) => {
          if (!result) return;
          setStep({ fileName, kind: "verified", updatePackage: result.package });
          reload();
        },
      },
    );
  };

  const started = (action: Held["action"], version: string) => {
    setHeld(null);
    setOverride(null);
    setRebooting(action === "apply" ? { kind: "applying", version } : { kind: "reverting" });
  };

  // An open elevated shell refuses the update; the refusal stays on the page with who holds the
  // shell (re-read from GetUpgrades), and an owner can end it from there.
  const runUpdate = (action: Held["action"], version: string) =>
    void runAction(
      async () => {
        try {
          await (action === "apply" ? upgrade.apply() : upgrade.revert());
          return true;
        } catch (error) {
          if (!isElevated(error)) throw error;
          setHeld({ action, message: errorText(error), version });
          reload();
          return false;
        }
      },
      {
        onSuccess: (done) => {
          setConfirmApply(null);
          setConfirmRevert(false);
          if (done) started(action, version);
        },
      },
    );

  const apply = (version: string) => runUpdate("apply", version);
  const revert = () => runUpdate("revert", "");

  const savePolicy = () =>
    void runAction(
      () => upgrade.setPolicy({ mirrorUrl: mirrorUrl.trim(), mode, windowMinutes, windowStart }),
      { onSuccess: reload, successMessage: "Update window saved." },
    );

  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Updates" />
      </div>
    );
  }
  if (!data) return null;

  const staged = data.stagedVersion;
  const openShells = data.activeElevations ?? [];

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Updates" />

      {rebooting?.kind === "applying" && (
        <Alert title={`Applying ${rebooting.version}`} tone="warn">
          The appliance is rebooting into the new release. Sign in again when it&apos;s back.
        </Alert>
      )}
      {rebooting?.kind === "reverting" && (
        <Alert title="Reverting to the other slot" tone="warn">
          The appliance is rebooting into the previous release. Sign in again when it&apos;s back.
        </Alert>
      )}
      {held && (
        <section aria-label={held.action === "apply" ? "Apply refused" : "Revert refused"}>
          <Alert
            title={held.action === "apply" ? "The apply was refused" : "The revert was refused"}
            tone="danger"
          >
            <div className="flex flex-col gap-2">
              <p>{held.message}</p>
              {openShells.map((elevation) => (
                <div className="flex flex-wrap items-center gap-3" key={elevation.id}>
                  <p>{holder(elevation)}</p>
                  {isOwner && (
                    <Button
                      onClick={() => setOverride({ elevation, held })}
                      size="sm"
                      variant="danger"
                    >
                      {`End ${elevation.admin}'s shell and ${held.action}`}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Alert>
        </section>
      )}
      {!held && openShells.length > 0 && (
        <section aria-label="Elevated shell open">
          <Alert title="An elevated shell is open" tone="warn">
            <div className="flex flex-col gap-1">
              {openShells.map((elevation) => (
                <p key={elevation.id}>{holder(elevation)}</p>
              ))}
              <p>
                Apply and Revert are refused until it ends
                {isOwner ? ", or an owner ends it with an override" : ""}.
              </p>
            </div>
          </Alert>
        </section>
      )}
      {data.failedVersion && (
        <Alert title={`${data.failedVersion} failed to boot`} tone="danger">
          The appliance went back to the release it runs now.
        </Alert>
      )}

      <Card>
        <CardHeader title="Version" />
        <div className="flex flex-col gap-2 p-5.5 text-small">
          <p className="font-bold">Running {data.runningVersion} in the active slot</p>
          <p>{staged ? `Other slot: staged ${staged}` : "Other slot: empty"}</p>
        </div>
        {isOwner && (
          <div className="flex flex-wrap gap-3 border-t border-border p-5.5">
            {staged && (
              <Button onClick={() => setConfirmApply(staged)} size="lg" variant="primary">
                Apply {staged}
              </Button>
            )}
            <Button onClick={() => setConfirmRevert(true)} size="lg" variant="secondary">
              Revert to the other slot
            </Button>
          </div>
        )}
      </Card>

      {!isOwner && <Alert tone="info">Only an owner can install, apply or revert updates.</Alert>}

      {isOwner && (
        <Card>
          <CardHeader title="Install an update" />
          <div className="flex flex-col gap-4 p-5.5 text-small">
            <p className="text-muted">
              A signed release <code>.bin</code> or a patch <code>.bin</code>. The appliance checks
              its signature, channel and hash before it unpacks anything; a file that fails is
              deleted and nothing is staged.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input accept=".bin" aria-label="Update .bin file" ref={fileInput} type="file" />
              <Button disabled={step.kind === "uploading"} onClick={sendFile}>
                Upload
              </Button>
            </div>
            {data.airGapped ? (
              <Alert title="Air-gapped: upload only" tone="info">
                No mirror is set, so this appliance never fetches updates from the network.
              </Alert>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <Field
                  hint={`From ${data.policy?.mirrorUrl ?? ""}`}
                  label="File name on the mirror"
                >
                  <Input
                    onChange={(event) => setMirrorFile(event.target.value)}
                    placeholder="sneakers-appliance-0.2.0-amd64.bin"
                    value={mirrorFile}
                  />
                </Field>
                <Button onClick={fetchFile} variant="secondary">
                  Fetch
                </Button>
              </div>
            )}
            <UpdateStep onVerify={verifyAndStage} step={step} />
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Update window" />
        <div className="flex flex-col gap-4 p-5.5 text-small">
          {data.policy && <p>{describePolicy(data.policy)}</p>}
          {isOwner && (
            <>
              <Segmented
                label="When updates apply"
                onChange={setMode}
                options={[
                  { label: "Daily window", value: "automatic" },
                  { label: "Manual only", value: "manual" },
                ]}
                value={mode}
              />
              {mode === "automatic" && (
                <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
                  <Field label="Daily start (HH:MM)">
                    <Input
                      onChange={(event) => setWindowStart(event.target.value)}
                      value={windowStart}
                    />
                  </Field>
                  <Field hint="45 to 720" label="Length (minutes)">
                    <Input
                      inputMode="numeric"
                      onChange={(event) => setWindowMinutes(Number(event.target.value))}
                      value={String(windowMinutes)}
                    />
                  </Field>
                </div>
              )}
              <Field hint="An https:// URL, or empty for upload only (air-gapped)" label="Mirror">
                <Input onChange={(event) => setMirrorUrl(event.target.value)} value={mirrorUrl} />
              </Field>
              <div>
                <Button onClick={savePolicy}>Save update window</Button>
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="History" />
        <Table aria-label="Update history">
          <TableHead>
            <TableRow>
              <TableHeaderCell>When</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell>Version</TableHeaderCell>
              <TableHeaderCell>By</TableHeaderCell>
              <TableHeaderCell>Outcome</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.history.map((event, index) => (
              <TableRow key={`${event.time ?? ""}-${String(index)}`}>
                <TableCell>{event.time ? shortDate(event.time) : ""}</TableCell>
                <TableCell>{event.action}</TableCell>
                <TableCell>{event.version}</TableCell>
                <TableCell>{event.actor}</TableCell>
                <TableCell>
                  <Badge tone={event.outcome === "ok" ? "ok" : "warn"}>
                    {event.outcome === "ok" ? "ok" : `failed ${event.code}`}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog onOpenChange={(open) => !open && setConfirmApply(null)} open={!!confirmApply}>
        {confirmApply && (
          <ApplyDialog
            onApply={() => apply(confirmApply)}
            onCancel={() => setConfirmApply(null)}
            version={confirmApply}
          />
        )}
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setOverride(null)} open={!!override}>
        {override && (
          <OverrideDialog
            action={override.held.action}
            elevation={override.elevation}
            onCancel={() => setOverride(null)}
            onDone={() => started(override.held.action, override.held.version)}
            version={override.held.version}
          />
        )}
      </Dialog>

      <Dialog onOpenChange={setConfirmRevert} open={confirmRevert}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revert to the other slot</DialogTitle>
            <DialogDescription>
              The running release is marked bad and the appliance reboots into the previous one.
              Every session ends.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setConfirmRevert(false)} variant="secondary">
              Cancel
            </Button>
            <Button onClick={revert} variant="danger">
              Revert and reboot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const UpdateStep = ({
  onVerify,
  step,
}: {
  onVerify: (fileName: string, uploadId: string) => void;
  step: Step;
}) => {
  switch (step.kind) {
    case "idle": {
      return null;
    }
    case "received": {
      return (
        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <p>
            {step.via} {step.fileName}. It hasn&apos;t been checked yet.
          </p>
          <div>
            <Button onClick={() => onVerify(step.fileName, step.uploadId)} size="lg">
              Verify and stage
            </Button>
          </div>
        </div>
      );
    }
    case "refused": {
      return (
        <Alert title={`${step.fileName} was refused`} tone="danger">
          {step.reason} Nothing was staged.
        </Alert>
      );
    }
    case "uploading": {
      return (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p>
            Uploading {step.fileName}: {step.progress}%
          </p>
          <progress
            aria-label="Upload progress"
            className="h-3 w-full accent-primary"
            max={100}
            value={step.progress}
          />
        </div>
      );
    }
    case "verified": {
      const { updatePackage } = step;
      return (
        <section
          aria-label="Verify result"
          className="flex flex-col gap-1 border-t border-border pt-4"
        >
          <p>
            <Badge tone="ok">verified</Badge> {step.fileName}: {describePackage(updatePackage)},{" "}
            {updatePackage.arch}
          </p>
          <p>Signature: verified against this appliance&apos;s release key</p>
          <p>Channel: {updatePackage.channel}</p>
          <p className="font-mono break-all">SHA-256: {updatePackage.sha256}</p>
          <p>Staged into the other slot.</p>
        </section>
      );
    }
    case "verifying": {
      return (
        <div className="flex items-center gap-3 border-t border-border pt-4" role="status">
          <Spinner />
          <p>Verifying the signature, channel and hash of {step.fileName}.</p>
        </div>
      );
    }
  }
};

const ApplyDialog = ({
  onApply,
  onCancel,
  version,
}: {
  onApply: () => void;
  onCancel: () => void;
  version: string;
}) => {
  const [typed, setTyped] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Apply {version}</DialogTitle>
        <DialogDescription>
          The appliance reboots into {version}. Every session ends, and the box is unavailable until
          it&apos;s back.
        </DialogDescription>
      </DialogHeader>
      <Field label={`Type ${version} to confirm`}>
        <Input onChange={(event) => setTyped(event.target.value)} value={typed} />
      </Field>
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button disabled={typed.trim() !== version} onClick={onApply} variant="danger">
          Apply and reboot
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

/**
 * The owner's override of an open elevated shell: the session's admin and id typed to confirm,
 * and a reason for the audit log. The box ends the session and applies (or reverts) only once
 * it has ended; its refusal stays in the dialog.
 */
const OverrideDialog = ({
  action,
  elevation,
  onCancel,
  onDone,
  version,
}: {
  action: Held["action"];
  elevation: Elevation;
  onCancel: () => void;
  onDone: () => void;
  version: string;
}) => {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [refusal, setRefusal] = useState("");
  const want = `${elevation.admin} ${elevation.id}`;
  const submit = () => {
    setRefusal("");
    const elevationOverride: ElevationOverride = {
      confirm: typed.trim(),
      elevationId: elevation.id,
      reason: reason.trim(),
    };
    void runAction(
      async () => {
        try {
          await (action === "apply"
            ? upgrade.apply(elevationOverride)
            : upgrade.revert(elevationOverride));
          return true;
        } catch (error) {
          if (isStepUpRequired(error)) throw error;
          setRefusal(errorText(error));
          return false;
        }
      },
      { onSuccess: (done) => done && onDone() },
    );
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>
          End {elevation.admin}&apos;s elevated shell and{" "}
          {action === "apply" ? `apply ${version}` : "revert"}
        </DialogTitle>
        <DialogDescription>
          {elevation.admin}&apos;s root shell ({elevation.id}) ends at once, and the end is written
          to the OS audit log with your reason. The {action === "apply" ? "apply" : "revert"} goes
          ahead once the session has ended, and the appliance reboots.
        </DialogDescription>
      </DialogHeader>
      <Field label="Reason">
        <Input onChange={(event) => setReason(event.target.value)} value={reason} />
      </Field>
      <Field label={`Type ${want} to confirm`}>
        <Input mono onChange={(event) => setTyped(event.target.value)} value={typed} />
      </Field>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={typed.trim() !== want || !reason.trim()}
          onClick={submit}
          variant="danger"
        >
          {action === "apply" ? "End the shell and apply" : "End the shell and revert"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
