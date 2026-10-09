import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
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
import { type ReactNode, useEffect, useRef, useState } from "react";

import type {
  Elevation,
  ElevationOverride,
  GetUpgradesResponse,
  HeldUpload,
  ListProductVersionsResponse,
  UpdatePackage,
  UpdateTarget,
  UpgradePolicy,
  UpgradeProgress,
} from "@/lib/osadmin/types";

import { BoxRestarting } from "@/components/BoxRestarting";
import { NotAvailable } from "@/components/NotAvailable";
import { MirrorStatusCard } from "@/components/updates/MirrorStatusCard";
import { UpgradeSteps } from "@/components/UpgradeSteps";
import { VersionChip } from "@/components/VersionChip";
import { runAction } from "@/lib/osadmin/action";
import { upgrade } from "@/lib/osadmin/client";
import {
  isNotAvailable,
  isStepUpRequired,
  OsadminError,
  reasonOf,
  refusalOf,
  symbolOf,
} from "@/lib/osadmin/errors";
import { refusalMessage } from "@/lib/osadmin/refusal";
import { useSession } from "@/lib/useSession";

/** An apply or revert the box refused because an elevated shell is open. */
interface Held {
  action: "apply" | "revert";
  message: string;
  target: UpdateTarget;
  version: string;
}

const PRODUCT: UpdateTarget = "UPDATE_TARGET_PRODUCT";
const BASE: UpdateTarget = "UPDATE_TARGET_BASE";

/** The product versions to offer: the list, the box is air-gapped, or the box can't list. */
type Offer =
  | { kind: "air-gapped" }
  | { kind: "listed"; list: ListProductVersionsResponse }
  | { kind: "unavailable" };

type Rebooting =
  | { kind: "applying"; version: string }
  | { kind: "installing"; version: string }
  | { kind: "reverting-product"; version: string }
  | { kind: "reverting" }
  | null;

/** True when the box refused an apply or revert because an elevated shell is open. */
const isElevated = (error: unknown): boolean =>
  error instanceof OsadminError && error.symbol === "UPGRADE_ELEVATED";

const holder = (elevation: Elevation): string =>
  `${elevation.admin} holds an elevated shell (${elevation.id})${elevation.started ? `, open since ${shortDate(elevation.started)}` : ""}: ${elevation.reason}`;

/**
 * Where the file in hand is: nothing yet, sending, on the box, being verified, refused, or done.
 * The box holds one file at a time, so a file it holds (GetUpgrades.heldUpload) shows as
 * received, with Verify and Cancel, even after a reload.
 */
type Step =
  | {
      code?: string;
      fileName: string;
      kind: "refused";
      reason: string;
      /** The upload the refusal was about, when the box may still hold it. */
      uploadId?: string;
    }
  | { fileName: string; kind: "received"; uploadId: string; via: Via }
  | { fileName: string; kind: "uploading"; progress: number }
  | { fileName: string; kind: "verified"; slot?: string; updatePackage: UpdatePackage }
  | { fileName: string; kind: "verifying"; uploadId: string }
  | { kind: "idle" };

type Via = "Fetched" | "Uploaded";

const describePolicy = (policy: UpgradePolicy): string =>
  policy.mode === "manual"
    ? "Manual only: an owner applies each update."
    : `Daily at ${policy.windowStart} for ${String(policy.windowMinutes)} minutes: a staged release applies in the window.`;

/** A product bundle's base range as the page says it, or its exact bases for an older bundle. */
const baseRange = ({
  bases,
  maxBase,
  minBase,
}: {
  bases: string[];
  maxBase: string;
  minBase: string;
}): string => {
  if (!minBase) return bases.join(", ");
  return maxBase ? `${minBase} to ${maxBase}` : `${minBase} or newer`;
};

const describePackage = (updatePackage: UpdatePackage): string => {
  if (updatePackage.target === PRODUCT)
    return `product bundle ${updatePackage.version}, fits base ${baseRange(updatePackage)}`;
  return updatePackage.kind === "patch"
    ? `patch ${updatePackage.version} for ${updatePackage.bases.join(", ")}`
    : `full release ${updatePackage.version}`;
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "The appliance refused the file.";

/** A refusal for the result panel: the box's reason and, apart, the error code it named. */
const refusedStep = (fileName: string, error: unknown, uploadId?: string): Step => ({
  code: symbolOf(errorText(error)),
  fileName,
  kind: "refused",
  reason: error instanceof Error ? reasonOf(error) : errorText(error),
  ...(uploadId ? { uploadId } : {}),
});

/** The file the box holds, as the panel shows it after a reload. */
const heldStep = (held: HeldUpload): Step => ({
  fileName: held.fileName || `upload ${held.uploadId}`,
  kind: "received",
  uploadId: held.uploadId,
  via: held.source === "upload" ? "Uploaded" : "Fetched",
});

/** True when the box refused the call's own authenticator code: empty, wrong or used already. */
const isCodeRefusal = (error: unknown): boolean =>
  !!refusalOf(error) || (error instanceof OsadminError && error.symbol === "ACCESS_CONFIRM");

/** How an apply or revert ended: started, held by an elevated shell, or its code refused. */
type Outcome = "held" | "refused" | "started";

/** The small label in the Base system and Product cards' headers; ink on the tinted header. */
const ACCENT_TAG =
  "rounded-sm border border-border-strong bg-surface px-2 py-0.5 text-small font-bold text-ink";

/** How often the page asks for the steps while a stage or an update is under way. */
export const STEPS_POLL_MS = 1000;

/** What an update in progress, or one that failed, is doing, as its card's title says it. */
const progressTitle = (progress: UpgradeProgress): string => {
  if (progress.failed) return "The last update didn't finish";
  const version = progress.version ? ` ${progress.version}` : "";
  if (progress.action === "stage") return `Staging${version}`;
  if (progress.action === "revert") return `Going back to${version}`;
  return `Updating to${version}`;
};

export default function Updates() {
  const { isOwner, session } = useSession();
  const [data, setData] = useState<GetUpgradesResponse>();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [mirrorFile, setMirrorFile] = useState("");
  const [confirmApply, setConfirmApply] = useState<{
    target: UpdateTarget;
    version: string;
  } | null>(null);
  const [confirmRevert, setConfirmRevert] = useState(false);
  const [confirmProductRevert, setConfirmProductRevert] = useState<null | string>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<{
    target: UpdateTarget;
    version: string;
  } | null>(null);
  const [offer, setOffer] = useState<Offer>({ kind: "unavailable" });
  const [picked, setPicked] = useState("");
  const [direct, setDirect] = useState(false);
  const [rebooting, setRebooting] = useState<Rebooting>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [override, setOverride] = useState<{ elevation: Elevation; held: Held } | null>(null);
  const [mode, setMode] = useState<UpgradePolicy["mode"]>("automatic");
  const [windowStart, setWindowStart] = useState("02:00");
  const [windowMinutes, setWindowMinutes] = useState(120);
  const [mirrorUrl, setMirrorUrl] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [restartSteps, setRestartSteps] = useState<UpgradeProgress>();
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  // A product install or revert ends when the product runs on its version, or when its restart
  // fails (the failed steps show in their own card).
  const settleProductRestart = (response: GetUpgradesResponse) =>
    setRebooting((current) => {
      if (current?.kind !== "installing" && current?.kind !== "reverting-product") return current;
      const progress = response.upgradeProgress;
      const failed = !!progress?.failed && progress.target === PRODUCT;
      const running =
        !!response.product?.running && response.product.installedVersion === current.version;
      return failed || running ? null : current;
    });

  const reload = () =>
    void upgrade
      .get()
      .then((response) => {
        setData(response);
        settleProductRestart(response);
        if (response.policy) {
          setMode(response.policy.mode);
          setWindowStart(response.policy.windowStart);
          setWindowMinutes(response.policy.windowMinutes);
          setMirrorUrl(response.policy.mirrorUrl);
          setDirect(response.policy.direct ?? false);
        }
        if (response.product) loadOffer();
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  // The box answers UPGRADE_AIR_GAPPED when it has no mirror and no release source to list.
  const loadOffer = () =>
    void upgrade
      .listProductVersions()
      .then((list) => {
        setOffer({ kind: "listed", list });
        setPicked((current) =>
          (list.versions ?? []).some((v) => v.version === current)
            ? current
            : (list.versions?.[0]?.version ?? ""),
        );
      })
      .catch((error: unknown) =>
        setOffer(
          error instanceof OsadminError && error.symbol === "UPGRADE_AIR_GAPPED"
            ? { kind: "air-gapped" }
            : { kind: "unavailable" },
        ),
      );
  useEffect(reload, []);
  // While a file stages, a file is coming in (the box notices a cancelled upload a moment after
  // the browser stops it), or an update is under way (the window's, say), the box is asked each
  // second; only the answer's data is replaced, not the product offer.
  const productRestart =
    rebooting?.kind === "installing" || rebooting?.kind === "reverting-product";
  const watching =
    !unavailable &&
    (rebooting?.kind === "applying" || rebooting?.kind === "reverting"
      ? false
      : productRestart ||
        step.kind === "verifying" ||
        !!data?.receiving ||
        !!data?.upgradeProgress?.inProgress);
  useEffect(() => {
    if (!watching) return;
    const poll = setInterval(() => {
      void upgrade
        .get()
        .then((response) => {
          setData(response);
          settleProductRestart(response);
        })
        .catch(() => {});
    }, STEPS_POLL_MS);
    return () => clearInterval(poll);
  }, [watching]);

  // Cancel aborts the transfer; the box drops what it got, and Upload unlocks.
  const sendFile = () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setStep({ fileName: file.name, kind: "uploading", progress: 0 });
    upgrade
      .upload(
        file,
        (fraction) =>
          setStep({ fileName: file.name, kind: "uploading", progress: Math.round(fraction * 100) }),
        controller.signal,
      )
      .then(({ uploadId }) => {
        setStep({ fileName: file.name, kind: "received", uploadId, via: "Uploaded" });
        reload();
      })
      .catch((error: unknown) => {
        if (error instanceof OsadminError && error.symbol === "UPLOAD_CANCELLED") {
          setStep({ kind: "idle" });
          if (fileInput.current) fileInput.current.value = "";
          reload();
          return;
        }
        setStep(refusedStep(file.name, error));
        reload();
      })
      .finally(() => {
        if (uploadAbort.current === controller) uploadAbort.current = null;
      });
  };

  const cancelUpload = () => uploadAbort.current?.abort();

  // Cancel on a received file deletes it from the box, which unlocks Upload and Fetch.
  const discardFile = (uploadId: string) =>
    void runAction(() => upgrade.discard(uploadId), {
      onSuccess: () => {
        setStep({ kind: "idle" });
        if (fileInput.current) fileInput.current.value = "";
        reload();
      },
      successMessage: "Cancelled. The file was deleted from the appliance.",
    });

  const unstage = (target: UpdateTarget) =>
    void runAction(() => upgrade.discard("", target), {
      onSuccess: () => {
        setConfirmDiscard(null);
        setStep((current) => (current.kind === "verified" ? { kind: "idle" } : current));
        reload();
      },
      successMessage: "The staged release was removed.",
    });

  const fetchFile = (name = mirrorFile) => {
    const fileName = name.trim();
    if (!fileName) return;
    void runAction(
      async () => {
        try {
          return await upgrade.fetch(fileName);
        } catch (error) {
          if (isStepUpRequired(error) || isNotAvailable(error)) throw error;
          setStep(refusedStep(fileName, error));
          reload();
          return null;
        }
      },
      {
        onSuccess: (result) => {
          if (!result) return;
          setStep({ fileName, kind: "received", uploadId: result.uploadId, via: "Fetched" });
          reload();
        },
      },
    );
  };

  // StageUpdate verifies first and only then unpacks; a refused file is deleted on the box. It
  // asks for no authenticator code: only Apply and Revert do. Refusals are shown in place, not
  // as a toast, so the reason stays on screen.
  const verifyAndStage = (fileName: string, uploadId: string) => {
    void runAction(
      async () => {
        setStep({ fileName, kind: "verifying", uploadId });
        try {
          return await upgrade.stage(uploadId);
        } catch (error) {
          setStep(refusedStep(fileName, error, uploadId));
          reload();
          return null;
        }
      },
      {
        onSuccess: (result) => {
          if (!result) return;
          setStep({ fileName, kind: "verified", slot: result.slot, updatePackage: result.package });
          reload();
        },
      },
    );
  };

  const started = (action: Held["action"], version: string, target: UpdateTarget) => {
    setHeld(null);
    setOverride(null);
    if (target !== PRODUCT) {
      // The box answers for a moment before it goes down: its steps seed the restart page.
      void upgrade
        .get()
        .then((response) => setRestartSteps(response.upgradeProgress))
        .catch(() => {});
    }
    if (target === PRODUCT) {
      setRebooting(
        action === "apply"
          ? { kind: "installing", version }
          : { kind: "reverting-product", version },
      );
      reload();
      return;
    }
    setRebooting(action === "apply" ? { kind: "applying", version } : { kind: "reverting" });
  };

  // Every apply or revert carries a fresh authenticator code; a refused code stays in the dialog.
  // An open elevated shell refuses the update; the refusal stays on the page with who holds the
  // shell (re-read from GetUpgrades), and an owner can end it from there.
  const runUpdate = (
    action: Held["action"],
    version: string,
    target: UpdateTarget,
    code: string,
    refuse: (text: string) => void,
  ) =>
    runAction(
      async (): Promise<Outcome> => {
        try {
          const update = action === "apply" ? upgrade.apply : upgrade.revert;
          await update(code, undefined, target);
          return "started";
        } catch (error) {
          if (isCodeRefusal(error)) {
            refuse(
              refusalOf(error)
                ? refusalMessage(error, { what: "code", who: session?.admin })
                : reasonOf(error),
            );
            return "refused";
          }
          if (!isElevated(error)) throw error;
          setHeld({ action, message: errorText(error), target, version });
          reload();
          return "held";
        }
      },
      {
        onSuccess: (outcome) => {
          if (outcome === "refused") return;
          setConfirmApply(null);
          setConfirmRevert(false);
          setConfirmProductRevert(null);
          if (outcome === "started") started(action, version, target);
        },
      },
    );

  const savePolicy = () =>
    void runAction(
      () =>
        upgrade.setPolicy({
          direct,
          mirrorUrl: mirrorUrl.trim(),
          mode,
          windowMinutes,
          windowStart,
        }),
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

  if (rebooting?.kind === "applying" || rebooting?.kind === "reverting") {
    return (
      <div className="flex flex-col gap-5 p-5.5">
        <PageHeader eyebrow="Appliance" title="Updates" />
        <BoxRestarting initialProgress={restartSteps}>
          <p className="m-0 font-bold">
            {rebooting.kind === "applying"
              ? `Applying ${rebooting.version}. The box reboots into the new release in the other slot.`
              : "Reverting to the other slot. The box reboots into the previous release."}
          </p>
        </BoxRestarting>
      </div>
    );
  }

  const staged = data.stagedVersion;
  // Staging a release replaces the one kept for a revert, so there's a revert target only with
  // nothing staged.
  const revertTarget = staged ? "" : data.previousVersion;
  // Staging writes over the other slot, so the stage is where what's there goes.
  const removes = data.nextStageRemoves.join(", ");
  const openShells = data.activeElevations ?? [];
  const product = data.product;
  const versions = offer.kind === "listed" ? (offer.list.versions ?? []) : [];
  const progress = data.upgradeProgress;
  // One file at a time: while one is coming in, held or being checked, nothing new comes in.
  const heldFile = data.heldUpload;
  const shown: Step = step.kind === "idle" && heldFile ? heldStep(heldFile) : step;
  const locked =
    data.receiving ||
    !!heldFile ||
    step.kind === "uploading" ||
    step.kind === "received" ||
    step.kind === "verifying";
  // The file panel shows its own stage; this card is for everything else under way or failed.
  const showProgress =
    !!progress &&
    (progress.inProgress || progress.failed) &&
    shown.kind !== "verifying" &&
    shown.kind !== "refused" &&
    shown.kind !== "verified";

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Updates" />

      {rebooting?.kind === "installing" && (
        <Alert title={`Installing product ${rebooting.version}`} tone="info">
          The product services restart on the new version. The box doesn&apos;t reboot, and this
          page stays signed in.
        </Alert>
      )}
      {rebooting?.kind === "reverting-product" && (
        <Alert title={`Reverting the product to ${rebooting.version}`} tone="info">
          The product services restart on the previous version. The box doesn&apos;t reboot.
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
      {showProgress && (
        <section aria-label="Update progress">
          <Card>
            <CardHeader title={progressTitle(progress)} />
            <div className="p-5.5 text-small">
              <UpgradeSteps progress={progress} />
            </div>
          </Card>
        </section>
      )}
      {data.failedVersion && (
        <Alert title={`${data.failedVersion} failed to boot`} tone="danger">
          The appliance went back to the release it runs now.
        </Alert>
      )}
      {data.revertedVersion && (
        <Alert title={`Reverted from ${data.revertedVersion}`} tone="info">
          {`By ${data.revertedBy ?? "an admin"}${data.revertedAt ? `, ${shortDate(data.revertedAt)}` : ""}. The appliance runs ${data.runningVersion} again.`}
        </Alert>
      )}

      <div
        className={product ? "grid grid-cols-1 gap-5 desktop:grid-cols-2" : "grid grid-cols-1"}
        data-testid="system-cards"
      >
        <section aria-label="Base system">
          <Card
            className="h-full border-t-4 border-t-primary"
            data-accent="base"
            data-testid="card-base"
          >
            <CardHeader
              aside={<span className={ACCENT_TAG}>Reboots</span>}
              className="rounded-t-xl bg-primary-soft"
              subtitle={<span className="text-ink">The appliance OS, in two slots</span>}
              title="Base system"
            />
            <div className="flex flex-col gap-2 p-5.5 text-small">
              <p className="flex flex-wrap items-center gap-1.5 font-bold">
                Running <VersionChip kind="running" version={data.runningVersion} /> in the active
                slot
              </p>
              {staged ? (
                <p className="flex flex-wrap items-center gap-1.5">
                  Other slot: staged <VersionChip kind="staged" version={staged} />
                </p>
              ) : revertTarget ? (
                <p>Other slot: {revertTarget} (revert target)</p>
              ) : (
                <p>Other slot: empty</p>
              )}
            </div>
            {isOwner && (staged || revertTarget) && (
              <div className="flex flex-wrap gap-3 border-t border-border p-5.5">
                {staged && (
                  <Button
                    onClick={() => setConfirmApply({ target: BASE, version: staged })}
                    size="lg"
                    variant="primary"
                  >
                    Apply {staged}
                  </Button>
                )}
                {staged && (
                  <Button
                    onClick={() => setConfirmDiscard({ target: BASE, version: staged })}
                    size="lg"
                    variant="secondary"
                  >
                    Cancel staged {staged}
                  </Button>
                )}
                {revertTarget && (
                  <Button onClick={() => setConfirmRevert(true)} size="lg" variant="secondary">
                    Revert to {revertTarget}
                  </Button>
                )}
              </div>
            )}
          </Card>
        </section>

        {product && (
          <section aria-label="Product">
            <Card
              className="h-full border-t-4 border-t-sole"
              data-accent="product"
              data-testid="card-product"
            >
              <CardHeader
                aside={<span className={ACCENT_TAG}>No reboot</span>}
                className="rounded-t-xl bg-hatch"
                subtitle={<span className="text-ink">k0s and Sneakers-PAM</span>}
                title="Product"
              />
              <div className="flex flex-col gap-2 p-5.5 text-small">
                {product.installedVersion ? (
                  <p className="flex items-center gap-2 font-bold">
                    <span>Installed {product.installedVersion}</span>
                    <Badge tone={product.running ? "ok" : "warn"}>
                      {product.running ? "running" : "stopped"}
                    </Badge>
                  </p>
                ) : (
                  <p className="font-bold">
                    Not installed yet. Sneakers-PAM starts once you install it below.
                  </p>
                )}
                <p>
                  {product.stagedVersion ? `Staged ${product.stagedVersion}` : "Nothing staged"}
                </p>
                <p>
                  {product.previousVersion
                    ? `Previous ${product.previousVersion}`
                    : "No previous version to go back to"}
                </p>
              </div>
              {isOwner && (product.stagedVersion || product.previousVersion) && (
                <div className="flex flex-wrap gap-3 border-t border-border p-5.5">
                  {product.stagedVersion && (
                    <Button
                      onClick={() =>
                        setConfirmApply({ target: PRODUCT, version: product.stagedVersion ?? "" })
                      }
                      size="lg"
                    >
                      Install product {product.stagedVersion}
                    </Button>
                  )}
                  {product.stagedVersion && (
                    <Button
                      onClick={() =>
                        setConfirmDiscard({ target: PRODUCT, version: product.stagedVersion ?? "" })
                      }
                      size="lg"
                      variant="secondary"
                    >
                      Cancel staged product {product.stagedVersion}
                    </Button>
                  )}
                  {product.previousVersion && (
                    <Button
                      onClick={() => setConfirmProductRevert(product.previousVersion ?? "")}
                      size="lg"
                      variant="secondary"
                    >
                      Revert product to {product.previousVersion}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </section>
        )}
      </div>

      {!isOwner && <Alert tone="info">Only an owner can install, apply or revert updates.</Alert>}

      {isOwner && (
        <Card>
          <CardHeader title="Install an update" />
          <div className="flex flex-col gap-4 p-5.5 text-small">
            <p className="text-muted">
              A signed base release or patch <code>.bin</code>, or a product bundle{" "}
              <code>.bin</code>. The appliance checks its signature, channel and hash (and, for a
              product bundle, that it fits this base) before it unpacks anything; a file that fails
              is deleted and nothing is staged.
            </p>
            {removes && <p>Staging a base update removes {removes} and its files.</p>}
            <div className="flex flex-wrap items-center gap-3">
              <input
                accept=".bin"
                aria-label="Update .bin file"
                disabled={locked}
                ref={fileInput}
                type="file"
              />
              <Button disabled={locked} onClick={sendFile}>
                Upload
              </Button>
            </div>
            {heldFile && (
              <p className="text-muted">
                A file is waiting on the appliance: verify it or cancel it below before you upload
                or fetch another.
              </p>
            )}
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
                <Button disabled={locked} onClick={() => fetchFile()} variant="secondary">
                  Fetch
                </Button>
              </div>
            )}
            {product && offer.kind === "air-gapped" && (
              <p className="text-muted">
                To install or upgrade the product, upload the product bundle&apos;s .bin above.
              </p>
            )}
            {product && offer.kind === "listed" && (
              <div className="flex flex-col gap-3 border-t border-border pt-4">
                {versions.length === 0 ? (
                  <p>No newer product version fits base {offer.list.baseVersion} yet.</p>
                ) : (
                  <>
                    <fieldset
                      aria-label="Product versions"
                      className="m-0 flex flex-col gap-2 border-0 p-0"
                      role="radiogroup"
                    >
                      <legend className="mb-1 text-[0.875rem] font-bold text-ink">
                        Product versions that fit base {offer.list.baseVersion}
                      </legend>
                      {versions.map((v) => (
                        <label
                          className="flex items-center gap-2.5 rounded-md border border-border p-3"
                          key={v.version}
                        >
                          <input
                            checked={picked === v.version}
                            className="size-4 accent-primary"
                            name="product-version"
                            onChange={() => setPicked(v.version)}
                            type="radio"
                            value={v.version}
                          />
                          <span className="font-bold">{v.version}</span>
                          <span className="text-muted">
                            {v.channel}, {v.arch}, {Math.round(Number(v.size) / 1_048_576)} MB, from
                            the {v.source === "direct" ? "release source" : "mirror"}, base{" "}
                            {baseRange(v)}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <div>
                      <Button
                        disabled={!picked || locked}
                        onClick={() =>
                          fetchFile(versions.find((v) => v.version === picked)?.fileName ?? "")
                        }
                        variant="secondary"
                      >
                        Fetch {picked}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            <UpdateStep
              heldId={heldFile?.uploadId}
              onCancel={discardFile}
              onCancelUpload={cancelUpload}
              onVerify={verifyAndStage}
              progress={progress}
              removes={removes}
              step={shown}
            />
          </div>
        </Card>
      )}

      <MirrorStatusCard status={data.mirrorStatus} />

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
              <Field
                hint="An http:// or https:// URL, or empty for upload only (air-gapped). Every file's signature is checked either way."
                label="Mirror"
              >
                <Input onChange={(event) => setMirrorUrl(event.target.value)} value={mirrorUrl} />
              </Field>
              {data.directAvailable && (
                <Label className="flex items-center gap-2">
                  <Checkbox
                    checked={direct}
                    onCheckedChange={(checked) => setDirect(checked === true)}
                  />
                  Fetch from the release source when no mirror is set or the mirror fails
                </Label>
              )}
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
            {(data.history ?? []).map((event, index) => (
              <TableRow key={`${event.time ?? ""}-${String(index)}`}>
                <TableCell>{event.time ? shortDate(event.time) : ""}</TableCell>
                <TableCell>
                  {event.target === PRODUCT ? `${event.action} (product)` : event.action}
                </TableCell>
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
          <ConfirmUpdateDialog
            confirmLabel={
              confirmApply.target === PRODUCT
                ? "Install and restart the product"
                : "Apply and reboot"
            }
            description={
              confirmApply.target === PRODUCT
                ? `The product services (k0s and Sneakers-PAM) restart on ${confirmApply.version}, with no reboot. Sneakers-PAM is unavailable until they're back; the previous version stays in the other slot.`
                : `The appliance reboots into ${confirmApply.version}. Every session ends, and the box is unavailable until it's back.`
            }
            onCancel={() => setConfirmApply(null)}
            onConfirm={(code, refuse) =>
              runUpdate("apply", confirmApply.version, confirmApply.target, code, refuse)
            }
            title={
              confirmApply.target === PRODUCT
                ? `Install product ${confirmApply.version}`
                : `Apply ${confirmApply.version}`
            }
            word={confirmApply.version}
          />
        )}
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setOverride(null)} open={!!override}>
        {override && (
          <OverrideDialog
            action={override.held.action}
            elevation={override.elevation}
            onCancel={() => setOverride(null)}
            onDone={() =>
              started(override.held.action, override.held.version, override.held.target)
            }
            target={override.held.target}
            version={override.held.version}
          />
        )}
      </Dialog>

      <Dialog
        onOpenChange={(open) => !open && setConfirmProductRevert(null)}
        open={!!confirmProductRevert}
      >
        {confirmProductRevert && (
          <ConfirmUpdateDialog
            confirmLabel="Revert the product"
            description="The product services restart on the previous slot's version. The box doesn't reboot."
            onCancel={() => setConfirmProductRevert(null)}
            onConfirm={(code, refuse) =>
              runUpdate("revert", confirmProductRevert, PRODUCT, code, refuse)
            }
            title={`Revert the product to ${confirmProductRevert}`}
            word={confirmProductRevert}
          />
        )}
      </Dialog>

      <Dialog onOpenChange={(open) => !open && setConfirmDiscard(null)} open={!!confirmDiscard}>
        {confirmDiscard && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmDiscard.target === PRODUCT
                  ? `Cancel staged product ${confirmDiscard.version}`
                  : `Cancel staged ${confirmDiscard.version}`}
              </DialogTitle>
              <DialogDescription>
                {confirmDiscard.target === PRODUCT
                  ? `The staged product bundle ${confirmDiscard.version} is removed from the product's other slot. The installed product keeps running.`
                  : `${confirmDiscard.version} is removed from the other slot and never boots. Nothing reboots; staging the base update already removed the release that was kept for a revert.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setConfirmDiscard(null)} variant="secondary">
                Keep it staged
              </Button>
              <Button onClick={() => unstage(confirmDiscard.target)} variant="danger">
                Remove the staged release
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <Dialog onOpenChange={setConfirmRevert} open={confirmRevert}>
        {confirmRevert && (
          <ConfirmUpdateDialog
            confirmLabel="Revert and reboot"
            description="The running release is marked bad and the appliance reboots into the previous one. Every session ends."
            onCancel={() => setConfirmRevert(false)}
            onConfirm={(code, refuse) => runUpdate("revert", "", BASE, code, refuse)}
            title={`Revert to ${revertTarget}`}
            word={data.runningVersion}
          />
        )}
      </Dialog>
    </div>
  );
}

const UpdateStep = ({
  heldId,
  onCancel,
  onCancelUpload,
  onVerify,
  progress,
  removes,
  step,
}: {
  /** The upload the box holds, if any: a refusal about it can still verify or cancel it. */
  heldId?: string;
  onCancel: (uploadId: string) => void;
  onCancelUpload: () => void;
  onVerify: (fileName: string, uploadId: string) => void;
  /** The box's update steps: while the file stages, they're its stage's. */
  progress?: UpgradeProgress;
  /** The base releases the stage removes, joined; empty when it removes none. */
  removes: string;
  step: Step;
}) => {
  // A product bundle has its own slots: only a base update's stage removes a base release.
  const removal =
    removes && "fileName" in step && !step.fileName.startsWith("sneakers-product-") ? (
      <p>This removes {removes} and its files.</p>
    ) : null;
  switch (step.kind) {
    case "idle": {
      return null;
    }
    case "received": {
      return (
        <ResultPanel title="Not checked yet" tone="info">
          <div className="flex flex-col gap-3">
            <p>
              {step.via} {step.fileName}. It hasn&apos;t been checked yet.
            </p>
            {removal}
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => onVerify(step.fileName, step.uploadId)} size="lg">
                Verify and stage
              </Button>
              <Button onClick={() => onCancel(step.uploadId)} size="lg" variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </ResultPanel>
      );
    }
    case "refused": {
      return (
        <ResultPanel title={`${step.fileName} was refused`} tone="danger">
          <div className="flex flex-col gap-2">
            <p>{step.reason} Nothing was staged.</p>
            {step.code && (
              <p>
                Error code: <code className="font-mono">{step.code}</code>
              </p>
            )}
            {step.uploadId && step.uploadId === heldId && (
              <>
                <p>The file is still on the appliance.</p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => onVerify(step.fileName, heldId)} size="lg">
                    Verify again
                  </Button>
                  <Button onClick={() => onCancel(heldId)} size="lg" variant="secondary">
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </ResultPanel>
      );
    }
    case "uploading": {
      return (
        <ResultPanel title={`Uploading ${step.fileName}: ${String(step.progress)}%`} tone="info">
          <div className="flex flex-col gap-3">
            <progress
              aria-label="Upload progress"
              className="h-3 w-full accent-primary"
              max={100}
              value={step.progress}
            />
            <div>
              <Button onClick={onCancelUpload} size="lg" variant="secondary">
                Cancel upload
              </Button>
            </div>
          </div>
        </ResultPanel>
      );
    }
    case "verified": {
      return (
        <VerifiedPanel
          fileName={step.fileName}
          slot={step.slot}
          updatePackage={step.updatePackage}
        />
      );
    }
    case "verifying": {
      return (
        <ResultPanel tone="info">
          <div className="flex flex-col gap-3">
            <span className="flex items-center gap-3">
              <Spinner />
              Verifying the signature, channel and hash of {step.fileName}, then staging it.
            </span>
            {progress?.action === "stage" && progress.inProgress && (
              <UpgradeSteps progress={progress} />
            )}
          </div>
        </ResultPanel>
      );
    }
  }
};

/**
 * The one place a file's upload, verify and stage result shows, toned by the outcome: info while
 * it's received, sending or being checked, green once verified and red when refused.
 */
const ResultPanel = ({
  children,
  title,
  tone,
}: {
  children: ReactNode;
  title?: string;
  tone: "danger" | "info" | "ok" | "warn";
}) => (
  <section aria-label="Verify result" className="border-t border-border pt-4" data-tone={tone}>
    <Alert title={title} tone={tone}>
      {children}
    </Alert>
  </section>
);

/** The verified file: what it is, that its signature checked out, its hash, and where it went. */
const VerifiedPanel = ({
  fileName,
  slot,
  updatePackage,
}: {
  fileName: string;
  slot?: string;
  updatePackage: UpdatePackage;
}) => {
  const product = updatePackage.target === PRODUCT;
  const rows: [string, ReactNode][] = [
    ["File", fileName],
    ["Version", describePackage(updatePackage)],
    ["Architecture", updatePackage.arch],
    ["Signature", "Verified against this appliance's release key"],
    ["Channel", updatePackage.channel],
    [
      "SHA-256",
      <span className="flex flex-wrap items-center gap-2" key="sha">
        <code className="font-mono break-all">{updatePackage.sha256}</code>
        <Button
          onClick={() => void navigator.clipboard.writeText(updatePackage.sha256)}
          size="sm"
          variant="secondary"
        >
          Copy
        </Button>
      </span>,
    ],
    [
      "Staged",
      product
        ? "Staged into the product's other slot"
        : slot
          ? `Staged into slot ${slot}`
          : "Staged into the other slot",
    ],
  ];
  return (
    <ResultPanel title="Verified" tone="ok">
      <dl className="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div className="contents" key={label}>
            <dt className="font-bold">{label}</dt>
            <dd className="m-0 min-w-0">{value}</dd>
          </div>
        ))}
      </dl>
    </ResultPanel>
  );
};

/**
 * Apply or Revert, base or product: the version typed to confirm and a fresh code from the
 * owner's authenticator, every time. A refused code stays in the dialog with what happens next.
 */
const ConfirmUpdateDialog = ({
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  title,
  word,
}: {
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: (code: string, refuse: (text: string) => void) => Promise<void>;
  title: string;
  word: string;
}) => {
  const [typed, setTyped] = useState("");
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = () => {
    setBusy(true);
    setRefusal("");
    void onConfirm(code, (text) => {
      setRefusal(text);
      setCode("");
    }).finally(() => setBusy(false));
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Field label={`Type ${word} to confirm`}>
        <Input onChange={(event) => setTyped(event.target.value)} value={typed} />
      </Field>
      <Field label="Authenticator code">
        <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
      </Field>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={busy || typed.trim() !== word || code.length !== 6}
          onClick={submit}
          variant="danger"
        >
          {confirmLabel}
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
  target,
  version,
}: {
  action: Held["action"];
  elevation: Elevation;
  onCancel: () => void;
  onDone: () => void;
  target: UpdateTarget;
  version: string;
}) => {
  const { session } = useSession();
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
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
            ? upgrade.apply(code, elevationOverride, target)
            : upgrade.revert(code, elevationOverride, target));
          return true;
        } catch (error) {
          setRefusal(
            refusalOf(error)
              ? refusalMessage(error, { what: "code", who: session?.admin })
              : errorText(error),
          );
          setCode("");
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
      <Field label="Authenticator code">
        <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
      </Field>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={typed.trim() !== want || !reason.trim() || code.length !== 6}
          onClick={submit}
          variant="danger"
        >
          {action === "apply" ? "End the shell and apply" : "End the shell and revert"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
