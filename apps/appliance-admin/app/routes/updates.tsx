import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  CodeInput,
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
import { type ReactNode, useEffect, useRef, useState } from "react";

import type {
  CheckUpdatesResponse,
  Elevation,
  ElevationOverride,
  GetUpgradesResponse,
  HeldUpload,
  MirrorStatus,
  ReleaseChannel,
  UnitOffer,
  UpdatePackage,
  UpdateSource,
  UpdateTarget,
  UpgradePolicy,
  UpgradeProgress,
} from "@/lib/osadmin/types";

import { BoxRestarting } from "@/components/BoxRestarting";
import { NotAvailable } from "@/components/NotAvailable";
import { FetchProgressLine, fetchRunning } from "@/components/updates/FetchProgressLine";
import { FileDetails } from "@/components/updates/FileDetails";
import { MirrorStatusCard } from "@/components/updates/MirrorStatusCard";
import { offerKey, OfferList } from "@/components/updates/OfferList";
import { UnitCard } from "@/components/updates/UnitCard";
import { UpgradeSteps } from "@/components/UpgradeSteps";
import { VersionFields } from "@/components/VersionFields";
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
import { shortName } from "@/lib/parseVersion";
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
const WEB: UpdateTarget = "UPDATE_TARGET_BASE_WEB";

/** The three cards, and the Install an update card where an uploaded file waits. */
type Place = "baseOs" | "baseWeb" | "install" | "product";

/** The card a unit's file belongs on. */
const placeOf = (target?: UpdateTarget): Place =>
  target === PRODUCT ? "product" : target === WEB ? "baseWeb" : "baseOs";

/** The unit a file's name says; the signed header decides once it's verified. */
const targetOfFile = (fileName: string): UpdateTarget => {
  if (fileName.startsWith("sneakers-product-")) return PRODUCT;
  if (fileName.startsWith("sneakers-appliance-baseWeb-")) return WEB;
  return BASE;
};

/** What Check now found: its answer, the box has no source, or the check was refused. */
type Offers =
  | { check: CheckUpdatesResponse; kind: "listed" }
  | { code?: string; kind: "refused"; reason: string }
  | { kind: "air-gapped" }
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
 * Where the file in hand is: nothing yet, sending, on the box, being verified, refused, or done,
 * and which card shows it. The box holds one file at a time, so a file it holds
 * (GetUpgrades.heldUpload) shows as received, with Verify and Cancel, even after a reload.
 */
type Step =
  | {
      code?: string;
      fileName: string;
      kind: "refused";
      place: Place;
      reason: string;
      /** The upload the refusal was about, when the box may still hold it. */
      uploadId?: string;
    }
  | { fileName: string; kind: "received"; place: Place; uploadId: string; via: Via }
  | { fileName: string; kind: "uploading"; place: Place; progress: number }
  | {
      fileName: string;
      kind: "verified";
      place: Place;
      slot?: string;
      updatePackage: UpdatePackage;
    }
  | { fileName: string; kind: "verifying"; place: Place; uploadId: string }
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
    return `product bundle ${shortName(updatePackage.version)}, fits base ${baseRange(updatePackage)}`;
  if (updatePackage.target === WEB) return `admin pages ${shortName(updatePackage.version)}`;
  return updatePackage.kind === "patch"
    ? `patch ${shortName(updatePackage.version)} for ${updatePackage.bases.map((base) => shortName(base)).join(", ")}`
    : `full release ${shortName(updatePackage.version)}`;
};

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : "The appliance refused the file.";

/** A refusal for the result panel: the box's reason and, apart, the error code it named. */
const refusedStep = (fileName: string, place: Place, error: unknown, uploadId?: string): Step => ({
  code: symbolOf(errorText(error)),
  fileName,
  kind: "refused",
  place,
  reason: error instanceof Error ? reasonOf(error) : errorText(error),
  ...(uploadId ? { uploadId } : {}),
});

/** The file the box holds, as the panel shows it after a reload. */
const heldStep = (held: HeldUpload): Step => {
  const fileName = held.fileName || `upload ${held.uploadId}`;
  const uploaded = held.source === "upload";
  return {
    fileName,
    kind: "received",
    place: uploaded ? "install" : placeOf(targetOfFile(fileName)),
    uploadId: held.uploadId,
    via: uploaded ? "Uploaded" : "Fetched",
  };
};

/** True when the box refused the call's own authenticator code: empty, wrong or used already. */
const isCodeRefusal = (error: unknown): boolean =>
  !!refusalOf(error) || (error instanceof OsadminError && error.symbol === "ACCESS_CONFIRM");

/** How an apply or revert ended: started, held by an elevated shell, or its code refused. */
type Outcome = "held" | "refused" | "started";

/** How often the page asks for the steps while a stage or an update is under way. */
export const STEPS_POLL_MS = 1000;
/** How often an idle page asks, so an update another tab or the window starts shows by itself. */
export const IDLE_POLL_MS = 5000;

/** What an update in progress, or one that failed, is doing, as its card's title says it. */
const progressTitle = (progress: UpgradeProgress): string => {
  if (progress.failed) return "The last update didn't finish";
  const version = progress.version ? ` ${progress.version}` : "";
  if (progress.action === "stage") return `Staging${version}`;
  if (progress.action === "revert") return `Going back to${version}`;
  return `Updating to${version}`;
};

/** The source as the Update mirror card's choice says it. */
const SOURCES: { label: string; value: UpdateSource }[] = [
  { label: "Built-in list", value: "builtin" },
  { label: "Manual", value: "manual" },
  { label: "Upload only", value: "none" },
];

/** The GitHub source's channels, as the Update mirror card's choice says them. */
const CHANNELS: { label: string; value: ReleaseChannel }[] = [
  { label: "Stable", value: "stable" },
  { label: "Release candidates (rc)", value: "rc" },
];

/** The GitHub source in one line: the repository, the channel and the release picked. */
const githubLine = (status: MirrorStatus): string => {
  const parts = [
    `GitHub source: ${status.releaseRepo}, the ${status.releaseChannel} channel${status.releaseChannelDefault ? " (this build's default)" : ""}`,
  ];
  if (status.releaseTag) parts.push(`release ${status.releaseTag}`);
  if (status.rateLimitedUntil)
    parts.push(`GitHub's rate limit is used up until ${shortDate(status.rateLimitedUntil)}`);
  return `${parts.join(", ")}.`;
};

/** The offer the box prefers, or the first one. */
const preferredKey = (offers: UnitOffer[]): string => {
  const offer = offers.find((o) => o.preferred) ?? offers[0];
  return offer ? offerKey(offer) : "";
};

/** A confirm for an Apply or Revert of a unit. */
interface Confirm {
  action: "apply" | "revert";
  target: UpdateTarget;
  /** The version the update goes to: the staged one, or the one a revert goes back to. */
  version: string;
}

export default function Updates() {
  const { isOwner, session } = useSession();
  const [data, setData] = useState<GetUpgradesResponse>();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState<{
    target: UpdateTarget;
    version: string;
  } | null>(null);
  const [offers, setOffers] = useState<Offers>({ kind: "unavailable" });
  const [checking, setChecking] = useState(false);
  const [picked, setPicked] = useState<Record<Place, string>>({
    baseOs: "",
    baseWeb: "",
    install: "",
    product: "",
  });
  const [fetching, setFetching] = useState(false);
  const [rebooting, setRebooting] = useState<Rebooting>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [override, setOverride] = useState<{ elevation: Elevation; held: Held } | null>(null);
  const [mode, setMode] = useState<UpgradePolicy["mode"]>("automatic");
  const [windowStart, setWindowStart] = useState("02:00");
  const [windowMinutes, setWindowMinutes] = useState(120);
  const [mirrorUrl, setMirrorUrl] = useState("");
  const [source, setSource] = useState<UpdateSource>("none");
  const [channel, setChannel] = useState<"" | ReleaseChannel>("");
  const [unavailable, setUnavailable] = useState(false);
  const [restartSteps, setRestartSteps] = useState<UpgradeProgress>();
  // A product install or revert whose call hasn't answered yet: the box answers only after the
  // product's restart, and its steps run meanwhile.
  const [calling, setCalling] = useState(false);
  const pending = useRef<{ action: Held["action"]; version: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const checkedOnce = useRef(false);

  // A product install or revert ends when the product runs on its version, or when its restart
  // fails (the failed steps show in their own card).
  const settleProductRestart = (response: GetUpgradesResponse) =>
    setRebooting((current) => {
      if (!current && pending.current) {
        const progress = response.upgradeProgress;
        if (!progress?.inProgress || progress.target !== PRODUCT) return current;
        // The steps have begun: the progress shows now, not once the call answers.
        setConfirm(null);
        const { action, version } = pending.current;
        return action === "apply"
          ? { kind: "installing", version }
          : { kind: "reverting-product", version };
      }
      if (current?.kind !== "installing" && current?.kind !== "reverting-product") return current;
      const progress = response.upgradeProgress;
      const failed = !!progress?.failed && progress.target === PRODUCT;
      const running =
        !!response.product?.running && response.product.installedVersion === current.version;
      return failed || running ? null : current;
    });

  // Check now: the box reads the index again and answers each unit's offers. An air-gapped box
  // has no source to check, so it isn't asked.
  const checkNow = (airGapped: boolean, refresh = false) => {
    if (airGapped) {
      setOffers({ kind: "air-gapped" });
      return;
    }
    setChecking(true);
    void upgrade
      .checkUpdates()
      .then((check) => {
        setOffers({ check, kind: "listed" });
        setPicked((current) => ({
          ...current,
          baseOs: check.baseOs.some((o) => offerKey(o) === current.baseOs)
            ? current.baseOs
            : preferredKey(check.baseOs),
          baseWeb: check.baseWeb.some((o) => offerKey(o) === current.baseWeb)
            ? current.baseWeb
            : preferredKey(check.baseWeb),
          product: check.product.some((o) => offerKey(o) === current.product)
            ? current.product
            : preferredKey(check.product),
        }));
      })
      .catch((error: unknown) => {
        if (error instanceof OsadminError && error.symbol === "UPGRADE_AIR_GAPPED") {
          setOffers({ kind: "air-gapped" });
          return;
        }
        if (isNotAvailable(error)) {
          setOffers({ kind: "unavailable" });
          return;
        }
        setOffers({ code: symbolOf(errorText(error)), kind: "refused", reason: reasonOf(error) });
      })
      .finally(() => {
        setChecking(false);
        // Check now's fetch of the index is the mirror's last fetch too.
        if (refresh)
          void upgrade
            .get()
            .then(setData)
            .catch(() => {});
      });
  };

  // The first answer also starts a Check now, so the cards list what the mirror offers.
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
          setSource(
            response.policy.source ??
              (response.policy.mirrorUrl ? "manual" : response.policy.direct ? "builtin" : "none"),
          );
          const inEffect = response.mirrorStatus?.releaseChannel;
          setChannel(inEffect === "rc" || inEffect === "stable" ? inEffect : "");
        }
        if (!checkedOnce.current) {
          checkedOnce.current = true;
          checkNow(response.airGapped);
        }
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(reload, []);
  // While a file stages or is fetched, a file is coming in (the box notices a cancelled upload a
  // moment after the browser stops it), or an update is under way (the window's, say), the box
  // is asked each second; only the answer's data is replaced, not the offers.
  const productRestart =
    rebooting?.kind === "installing" || rebooting?.kind === "reverting-product";
  const watching =
    !unavailable &&
    (rebooting?.kind === "applying" || rebooting?.kind === "reverting"
      ? false
      : productRestart ||
        calling ||
        fetching ||
        step.kind === "verifying" ||
        !!data?.receiving ||
        fetchRunning(data?.fetchProgress) ||
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
  // Idle, the page still asks now and then, so an install, update or revert started from another
  // tab, by another admin or by the update window opens its progress by itself.
  const idle = !unavailable && !watching && !rebooting;
  useEffect(() => {
    if (!idle) return;
    const poll = setInterval(() => {
      void upgrade
        .get()
        .then(setData)
        .catch(() => {});
    }, IDLE_POLL_MS);
    return () => clearInterval(poll);
  }, [idle]);

  // Cancel aborts the transfer; the box drops what it got, and Upload unlocks.
  const sendFile = () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    const controller = new AbortController();
    uploadAbort.current = controller;
    setStep({ fileName: file.name, kind: "uploading", place: "install", progress: 0 });
    upgrade
      .upload(
        file,
        (fraction) =>
          setStep({
            fileName: file.name,
            kind: "uploading",
            place: "install",
            progress: Math.round(fraction * 100),
          }),
        controller.signal,
      )
      .then(({ uploadId }) => {
        setStep({
          fileName: file.name,
          kind: "received",
          place: "install",
          uploadId,
          via: "Uploaded",
        });
        reload();
      })
      .catch((error: unknown) => {
        if (error instanceof OsadminError && error.symbol === "UPLOAD_CANCELLED") {
          setStep({ kind: "idle" });
          if (fileInput.current) fileInput.current.value = "";
          reload();
          return;
        }
        setStep(refusedStep(file.name, "install", error));
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

  // A fetch runs as one call; the page asks for its progress each second meanwhile.
  const fetchFile = (fileName: string) => {
    if (!fileName) return;
    const place = placeOf(targetOfFile(fileName));
    setFetching(true);
    void runAction(
      async () => {
        try {
          return await upgrade.fetch(fileName);
        } catch (error) {
          if (isStepUpRequired(error) || isNotAvailable(error)) throw error;
          setStep(refusedStep(fileName, place, error));
          reload();
          return null;
        } finally {
          setFetching(false);
        }
      },
      {
        onSuccess: (result) => {
          if (!result) return;
          setStep({ fileName, kind: "received", place, uploadId: result.uploadId, via: "Fetched" });
          reload();
        },
      },
    );
  };

  // StageUpdate verifies first and only then unpacks; a refused file is deleted on the box (a
  // Base Web that doesn't fit the running Base OS is kept). It asks for no authenticator code:
  // only Apply and Revert do. Refusals are shown in place, not as a toast, so the reason stays on
  // screen. Once verified, the file's signed header picks its card.
  const verifyAndStage = (fileName: string, uploadId: string, place: Place) => {
    void runAction(
      async () => {
        setStep({ fileName, kind: "verifying", place, uploadId });
        try {
          return await upgrade.stage(uploadId);
        } catch (error) {
          setStep(refusedStep(fileName, place, error, uploadId));
          reload();
          return null;
        }
      },
      {
        onSuccess: (result) => {
          if (!result) return;
          setStep({
            fileName,
            kind: "verified",
            place: placeOf(result.package.target),
            slot: result.slot,
            updatePackage: result.package,
          });
          reload();
        },
      },
    );
  };

  const started = (action: Held["action"], version: string, target: UpdateTarget) => {
    setHeld(null);
    setOverride(null);
    if (target === WEB) {
      reload();
      return;
    }
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
        if (target === PRODUCT) {
          pending.current = { action, version };
          setCalling(true);
        }
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
          if (!isElevated(error) && target === WEB) {
            refuse(reasonOf(error));
            return "refused";
          }
          if (!isElevated(error)) throw error;
          setHeld({ action, message: errorText(error), target, version });
          reload();
          return "held";
        } finally {
          pending.current = null;
          setCalling(false);
        }
      },
      {
        onSuccess: (outcome) => {
          if (outcome === "refused") return;
          setConfirm(null);
          if (outcome === "started") started(action, version, target);
        },
        ...(target === WEB && action === "apply"
          ? { successMessage: `The admin pages switched to ${version}.` }
          : {}),
      },
    );

  const savePolicy = (what: "source" | "window") =>
    void runAction(
      () =>
        upgrade.setPolicy({
          direct: source === "builtin",
          mirrorUrl: mirrorUrl.trim(),
          mode,
          source,
          windowMinutes,
          windowStart,
          // The channel only when the owner picked one: a save with it left out keeps the box's.
          ...(what === "source" && channel && channel !== data?.mirrorStatus?.releaseChannel
            ? { releaseChannel: channel }
            : {}),
        }),
      {
        onSuccess: () => {
          reload();
          if (what === "source") checkNow(source === "none", true);
        },
        successMessage: what === "source" ? "Update source saved." : "Update window saved.",
      },
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
  const web = data.baseWeb;
  const check = offers.kind === "listed" ? offers.check : undefined;
  const progress = data.upgradeProgress;
  // One file at a time: while one is coming in, held or being checked, nothing new comes in.
  const heldFile = data.heldUpload;
  const shown: Step = step.kind === "idle" && heldFile ? heldStep(heldFile) : step;
  const locked =
    data.receiving ||
    fetching ||
    fetchRunning(data.fetchProgress) ||
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
  const fetchProgress = data.fetchProgress;

  /**
   * The apply, revert or stage steps, shown inside the unit's own row while they run instead of
   * in a banner above all three (a progress with no target, from before per-unit targeting,
   * reads as the Base OS's own).
   */
  const progressBlock = (target: UpdateTarget) =>
    showProgress && progress && (progress.target ?? BASE) === target ? (
      <section
        aria-label="Update progress"
        className="rounded-md border border-border bg-sunken p-4"
      >
        <p className="m-0 font-bold">{progressTitle(progress)}</p>
        <div className="pt-2">
          <UpgradeSteps progress={progress} />
        </div>
      </section>
    ) : null;

  /** The file panel, on the card its file belongs to. */
  const panel = (place: Place) =>
    "place" in shown && shown.place === place ? (
      <UpdateStep
        heldId={heldFile?.uploadId}
        onCancel={discardFile}
        onCancelUpload={cancelUpload}
        onVerify={(fileName, uploadId) => verifyAndStage(fileName, uploadId, place)}
        progress={progress}
        removes={removes}
        replaces={staged}
        step={shown}
      />
    ) : null;

  /** A fetch under way for the unit, with its bytes, speed and time left. */
  const fetchLine = (target: UpdateTarget) =>
    fetchRunning(fetchProgress) &&
    fetchProgress &&
    placeOf(fetchProgress.target) === placeOf(target) ? (
      <FetchProgressLine progress={fetchProgress} />
    ) : null;

  /** The offers of a unit, with the Fetch for the one picked; nothing to an admin who isn't an owner. */
  const offerBlock = (
    place: "baseOs" | "baseWeb" | "product",
    label: string,
    list: UnitOffer[],
    empty: string,
    legend?: string,
  ) => {
    if (offers.kind === "air-gapped")
      return <p className="text-muted">Air-gapped: upload the .bin under Install an update.</p>;
    if (!check) return null;
    if (list.length === 0) return <p className="text-muted">{empty}</p>;
    const chosen = list.find((o) => offerKey(o) === picked[place]);
    return (
      <div className="flex flex-col gap-3">
        <OfferList
          label={label}
          legend={legend}
          offers={list}
          onPick={(key) => setPicked((current) => ({ ...current, [place]: key }))}
          picked={picked[place]}
          runningVersion={data.runningVersion}
        />
        {isOwner && chosen && (
          <div>
            <Button
              disabled={locked}
              onClick={() => fetchFile(chosen.fileName)}
              variant="secondary"
            >
              {`Fetch ${shortName(chosen.version)}`}
            </Button>
          </div>
        )}
      </div>
    );
  };

  const webBack = web
    ? web.previousVersion
      ? shortName(web.previousVersion)
      : `the built-in pages (${shortName(web.builtinVersion)})`
    : "";

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
                Apply and Revert of the Base OS and the product are refused until it ends
                {isOwner ? ", or an owner ends it with an override" : ""}. The admin pages (Base
                Web) aren&apos;t held by it.
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
      {data.revertedVersion && (
        <Alert title={`Reverted from ${data.revertedVersion}`} tone="info">
          {`By ${data.revertedBy ?? "an admin"}${data.revertedAt ? `, ${shortDate(data.revertedAt)}` : ""}. The appliance runs ${data.runningVersion} again.`}
        </Alert>
      )}
      {!isOwner && <Alert tone="info">Only an owner can install, apply or revert updates.</Alert>}

      {/* The three units as their own full-width rows, never side by side: a unit's offers,
          its buttons and its own progress all need the width, and a "Fetch" or "Apply" button
          sharing a third of the page with two other units is what overflowed in the first
          place. */}
      <div className="flex flex-col gap-5" data-testid="unit-cards">
        <UnitCard
          accent="base"
          actions={
            isOwner && (staged || revertTarget) ? (
              <>
                {staged && (
                  <Button
                    onClick={() => setConfirm({ action: "apply", target: BASE, version: staged })}
                    size="lg"
                    variant="primary"
                  >
                    {`Apply ${shortName(staged)}`}
                  </Button>
                )}
                {staged && (
                  <Button
                    onClick={() => setConfirmDiscard({ target: BASE, version: staged })}
                    size="lg"
                    variant="secondary"
                  >
                    {`Cancel staged ${shortName(staged)}`}
                  </Button>
                )}
                {revertTarget && (
                  <Button
                    onClick={() =>
                      setConfirm({ action: "revert", target: BASE, version: revertTarget })
                    }
                    size="lg"
                    variant="secondary"
                  >
                    {`Revert to ${shortName(revertTarget)}`}
                  </Button>
                )}
              </>
            ) : undefined
          }
          subtitle="Two slots"
          tag="Reboots"
          testId="card-base"
          title="Base OS"
        >
          <VersionFields label="Running" version={data.runningVersion} />
          <p className="m-0 text-muted">In the active slot.</p>
          {staged ? (
            <>
              <VersionFields label="Staged" version={staged} />
              {data.stagedIncludesBaseWeb && (
                <p className="m-0 text-muted" title={data.stagedIncludesBaseWeb}>
                  {`Includes Base Web ${shortName(data.stagedIncludesBaseWeb)}, which serves after the reboot unless the installed Base Web is newer.`}
                </p>
              )}
            </>
          ) : revertTarget ? (
            <p>{`Other slot: ${shortName(revertTarget)} (revert target)`}</p>
          ) : (
            <p>Other slot: empty</p>
          )}
          {data.baseOsNote && <Alert tone="warn">{data.baseOsNote}</Alert>}
          {progressBlock(BASE)}
          {offerBlock(
            "baseOs",
            "Base OS versions",
            check?.baseOs ?? [],
            "No newer Base OS on the mirror.",
          )}
          {fetchLine(BASE)}
          {panel("baseOs")}
          <p className="text-muted">
            {[
              web?.requiresBaseOs ? `The Base Web needs Base OS ${web.requiresBaseOs}` : "",
              product?.requiresBaseOs ? `the product needs Base OS ${product.requiresBaseOs}` : "",
            ]
              .filter(Boolean)
              .join("; ") || "Needs no other unit: it carries its own built-in pages."}
          </p>
        </UnitCard>

        {web && (
          <UnitCard
            accent="web"
            actions={
              isOwner && (web.stagedVersion || web.canRevert) ? (
                <>
                  {web.stagedVersion && (
                    <Button
                      onClick={() =>
                        setConfirm({ action: "apply", target: WEB, version: web.stagedVersion })
                      }
                      size="lg"
                    >
                      {`Apply pages ${shortName(web.stagedVersion)}`}
                    </Button>
                  )}
                  {web.stagedVersion && (
                    <Button
                      onClick={() => setConfirmDiscard({ target: WEB, version: web.stagedVersion })}
                      size="lg"
                      variant="secondary"
                    >
                      {`Cancel staged pages ${shortName(web.stagedVersion)}`}
                    </Button>
                  )}
                  {web.canRevert && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          action: "revert",
                          target: WEB,
                          version: web.previousVersion || web.builtinVersion,
                        })
                      }
                      size="lg"
                      variant="secondary"
                    >
                      {`Revert pages to ${web.previousVersion ? shortName(web.previousVersion) : "built-in"}`}
                    </Button>
                  )}
                </>
              ) : undefined
            }
            subtitle=":8443 pages"
            tag="No reboot"
            testId="card-web"
            title="Base Web"
          >
            <VersionFields label="Running" version={web.runningVersion} />
            <p className="m-0 text-muted">
              {web.source === "slot" ? `Web slot ${web.slot}.` : "Serving the built-in pages."}
            </p>
            {web.stagedVersion && <VersionFields label="Staged" version={web.stagedVersion} />}
            <p>
              {web.canRevert ? `Previous: ${webBack}` : "Previous: none (the built-in pages serve)"}
            </p>
            {web.source !== "slot" && web.reason && web.currentVersion && (
              <Alert title="Serving the built-in pages" tone="warn">
                {`Base Web ${web.currentVersion} isn't served: ${web.reason}`}
              </Alert>
            )}
            {progressBlock(WEB)}
            {offerBlock(
              "baseWeb",
              "Base Web versions",
              check?.baseWeb ?? [],
              "No newer Base Web for this Base OS on the mirror.",
            )}
            {check?.baseWebWaits && (
              <p className="text-muted">{`${check.baseWebWaits} Install that Base OS first.`}</p>
            )}
            {fetchLine(WEB)}
            {panel("baseWeb")}
            <p className="text-muted">
              {web.requiresBaseOs
                ? `Needs Base OS ${web.requiresBaseOs} (running ${data.runningVersion}: ${web.fits ? "fits" : "doesn't fit"})`
                : `The built-in pages come with Base OS ${data.runningVersion}.`}
            </p>
          </UnitCard>
        )}

        {product && (
          <UnitCard
            accent="product"
            actions={
              isOwner && (product.stagedVersion || product.previousVersion) ? (
                <>
                  {product.stagedVersion && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          action: "apply",
                          target: PRODUCT,
                          version: product.stagedVersion ?? "",
                        })
                      }
                      size="lg"
                    >
                      {`Install product ${shortName(product.stagedVersion)}`}
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
                      {`Cancel staged product ${shortName(product.stagedVersion)}`}
                    </Button>
                  )}
                  {product.previousVersion && (
                    <Button
                      onClick={() =>
                        setConfirm({
                          action: "revert",
                          target: PRODUCT,
                          version: product.previousVersion ?? "",
                        })
                      }
                      size="lg"
                      variant="secondary"
                    >
                      {`Revert product to ${shortName(product.previousVersion)}`}
                    </Button>
                  )}
                </>
              ) : undefined
            }
            subtitle="k0s and Sneakers-PAM"
            tag="Restarts"
            testId="card-product"
            title="Product"
          >
            {product.installedVersion ? (
              <div className="flex flex-wrap items-center gap-2">
                <VersionFields label="Installed" version={product.installedVersion} />
                <Badge tone={product.running ? "ok" : "warn"}>
                  {product.running ? "running" : "stopped"}
                </Badge>
              </div>
            ) : (
              <p className="font-bold">
                Not installed yet. Sneakers-PAM starts once you install it here.
              </p>
            )}
            {product.stagedVersion ? (
              <VersionFields label="Staged" version={product.stagedVersion} />
            ) : (
              <p>Nothing staged</p>
            )}
            <p>
              {product.previousVersion
                ? `Previous ${shortName(product.previousVersion)}`
                : "No previous version to go back to"}
            </p>
            {progressBlock(PRODUCT)}
            {offers.kind === "air-gapped" ? (
              <p className="text-muted">
                To install or upgrade the product, upload the product bundle&apos;s .bin under
                Install an update.
              </p>
            ) : (
              offerBlock(
                "product",
                "Product versions",
                check?.product ?? [],
                `No newer product version fits base ${shortName(data.runningVersion)} yet.`,
                `Product versions that fit base ${shortName(data.runningVersion)}`,
              )
            )}
            {fetchLine(PRODUCT)}
            {panel("product")}
            {product.requiresBaseOs && (
              <p className="text-muted">
                {`Needs Base OS ${product.requiresBaseOs} (running ${data.runningVersion}: ${product.fits ? "fits" : "doesn't fit"})`}
              </p>
            )}
          </UnitCard>
        )}
      </div>

      <MirrorStatusCard status={data.mirrorStatus}>
        <p>
          {source === "builtin"
            ? "Source: the built-in list, compiled into this release, tried in order."
            : source === "manual"
              ? `Source: the mirror at ${data.policy?.mirrorUrl ?? ""}.`
              : "Source: none. This appliance never fetches; upload each .bin under Install an update."}
        </p>
        {source === "builtin" && data.mirrorStatus?.releaseRepo && (
          <p>{githubLine(data.mirrorStatus)}</p>
        )}
        {data.airGapped && (
          <Alert title="Air-gapped: upload only" tone="info">
            The box has no update source, so it never fetches updates from the network.
          </Alert>
        )}
        {offers.kind === "refused" && (
          <Alert role="alert" title="Check now was refused" tone="danger">
            <p>
              {offers.code && <code>{offers.code}</code>}
              {offers.code ? ": " : ""}
              {offers.reason}
            </p>
          </Alert>
        )}
        {check && (
          <p>
            {`Last check ${check.checkedAt ? shortDate(check.checkedAt) : ""}, from the ${check.source === "direct" ? "release source" : "mirror"}: `}
            {[
              check.baseOs.length > 0
                ? `Base OS ${[...new Set(check.baseOs.map((o) => o.version))].join(", ")}`
                : "",
              check.baseWeb.length > 0
                ? `Base Web ${check.baseWeb.map((o) => o.version).join(", ")}`
                : "",
              check.product.length > 0
                ? `product ${check.product.map((o) => o.version).join(", ")}`
                : "",
            ]
              .filter(Boolean)
              .join("; ") || "nothing newer"}
            .
          </p>
        )}
        {!data.airGapped && (
          <div>
            <Button
              disabled={checking}
              onClick={() => checkNow(data.airGapped, true)}
              variant="secondary"
            >
              {checking ? "Checking" : "Check now"}
            </Button>
          </div>
        )}
        {isOwner && (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <Segmented
              label="Where updates come from"
              onChange={setSource}
              options={SOURCES}
              value={source}
            />
            {source === "builtin" && data.mirrorStatus?.releaseRepo && channel && (
              <Segmented
                label="GitHub channel"
                onChange={setChannel}
                options={CHANNELS}
                value={channel}
              />
            )}
            {source === "manual" && (
              <Field
                hint="An http:// or https:// URL. Every file's signature is checked either way."
                label="Mirror"
              >
                <Input onChange={(event) => setMirrorUrl(event.target.value)} value={mirrorUrl} />
              </Field>
            )}
            <div>
              <Button onClick={() => savePolicy("source")}>Save source</Button>
            </div>
          </div>
        )}
      </MirrorStatusCard>

      {isOwner && (
        <section aria-label="Install an update">
          <Card>
            <CardHeader title="Install an update" />
            <div className="flex flex-col gap-4 p-5.5 text-small">
              <p className="text-muted">
                For an air-gapped appliance: upload a signed <code>.bin</code> of any unit. The
                appliance checks its signature, channel and hash (and that it fits the other units)
                before it unpacks anything, and its signed header picks its card above.
              </p>
              {staged ? (
                <p>{staged} is staged. Staging another base update replaces it and its files.</p>
              ) : (
                removes && <p>Staging a base update removes {removes} and its files.</p>
              )}
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
                  A file is waiting on the appliance: verify it or cancel it before you upload or
                  fetch another.
                </p>
              )}
              {panel("install")}
            </div>
          </Card>
        </section>
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
              <div>
                <Button onClick={() => savePolicy("window")}>Save update window</Button>
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
                  {event.target === PRODUCT
                    ? `${event.action} (product)`
                    : event.target === WEB
                      ? `${event.action} (pages)`
                      : event.action}
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

      <Dialog onOpenChange={(open) => !open && setConfirm(null)} open={!!confirm}>
        {confirm && (
          <UnitConfirm
            confirm={confirm}
            onCancel={() => setConfirm(null)}
            runningVersion={data.runningVersion}
            runUpdate={runUpdate}
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

      <Dialog onOpenChange={(open) => !open && setConfirmDiscard(null)} open={!!confirmDiscard}>
        {confirmDiscard && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {confirmDiscard.target === PRODUCT
                  ? `Cancel staged product ${confirmDiscard.version}`
                  : confirmDiscard.target === WEB
                    ? `Cancel staged pages ${confirmDiscard.version}`
                    : `Cancel staged ${confirmDiscard.version}`}
              </DialogTitle>
              <DialogDescription>
                {confirmDiscard.target === PRODUCT
                  ? `The staged product bundle ${confirmDiscard.version} is removed from the product's other slot. The installed product keeps running.`
                  : confirmDiscard.target === WEB
                    ? `The staged admin pages ${confirmDiscard.version} are removed from their web slot. The pages served now stay.`
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
    </div>
  );
}

/** The Apply or Revert dialog of one unit, in that unit's words. */
const UnitConfirm = ({
  confirm,
  onCancel,
  runningVersion,
  runUpdate,
}: {
  confirm: Confirm;
  onCancel: () => void;
  runningVersion: string;
  runUpdate: (
    action: Held["action"],
    version: string,
    target: UpdateTarget,
    code: string,
    refuse: (text: string) => void,
  ) => Promise<void>;
}) => {
  const { action, target, version } = confirm;
  const words: { confirmLabel: string; description: string; title: string; word: string } =
    target === PRODUCT
      ? action === "apply"
        ? {
            confirmLabel: "Install and restart the product",
            description: `Sneakers-PAM's services restart on ${version}, with no reboot; k0s keeps running. Sneakers-PAM is unavailable until they're back; the previous version stays in the other slot.`,
            title: `Install product ${version}`,
            word: version,
          }
        : {
            confirmLabel: "Revert the product",
            description:
              "The product services restart on the previous slot's version. The box doesn't reboot.",
            title: `Revert the product to ${version}`,
            word: version,
          }
      : target === WEB
        ? action === "apply"
          ? {
              confirmLabel: "Switch the admin pages",
              description: `The :8443 admin pages switch to ${version} in place: no reboot and no restart, you stay signed in, and the product keeps serving on 443. An open page offers a reload.`,
              title: `Apply admin pages ${version}`,
              word: version,
            }
          : {
              confirmLabel: "Switch back",
              description: `The :8443 admin pages go back to ${version} in place, with no reboot. You stay signed in.`,
              title: `Revert the admin pages to ${version}`,
              word: version,
            }
        : action === "apply"
          ? {
              confirmLabel: "Apply and reboot",
              description: `The appliance reboots into ${version}. Every session ends, yours included, and the box is unavailable until it's back; sign in again then.`,
              title: `Apply ${version}`,
              word: version,
            }
          : {
              confirmLabel: "Revert and reboot",
              description:
                "The running release is marked bad and the appliance reboots into the previous one. Every session ends, yours included; sign in again once it's back.",
              title: `Revert to ${version}`,
              word: runningVersion,
            };
  return (
    <ConfirmUpdateDialog
      confirmLabel={words.confirmLabel}
      description={words.description}
      onCancel={onCancel}
      onConfirm={(code, refuse) =>
        runUpdate(
          action,
          target === BASE && action === "revert" ? "" : version,
          target,
          code,
          refuse,
        )
      }
      title={words.title}
      word={words.word}
    />
  );
};

const UpdateStep = ({
  heldId,
  onCancel,
  onCancelUpload,
  onVerify,
  progress,
  removes,
  replaces,
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
  /** The base release staged now, which a new stage replaces; empty with none staged. */
  replaces: string;
  step: Step;
}) => {
  // A product bundle and the admin pages have their own slots: only a Base OS stage removes a
  // base release. With one staged, the stage replaces that release rather than removing the
  // revert target.
  const baseFile = "fileName" in step && targetOfFile(step.fileName) === BASE;
  const removal = baseFile ? (
    replaces ? (
      <p>This replaces the staged {replaces} and its files.</p>
    ) : removes ? (
      <p>This removes {removes} and its files.</p>
    ) : null
  ) : null;
  switch (step.kind) {
    case "idle": {
      return null;
    }
    case "received": {
      return (
        <ResultPanel title="Not checked yet" tone="info">
          <div className="flex flex-col gap-3">
            <p>{step.via}. It hasn&apos;t been checked yet.</p>
            <FileDetails fileName={step.fileName} />
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
        <ResultPanel title="The file was refused" tone="danger">
          <div className="flex flex-col gap-2">
            <FileDetails fileName={step.fileName} />
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
        <ResultPanel title={`Uploading: ${String(step.progress)}%`} tone="info">
          <div className="flex flex-col gap-3">
            <FileDetails fileName={step.fileName} />
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
              Verifying the signature, channel and hash, then staging it.
            </span>
            <FileDetails fileName={step.fileName} />
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
  const web = updatePackage.target === WEB;
  const rows: [string, ReactNode][] = [
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
        : web
          ? `Staged into web slot ${slot ?? ""}`
          : slot
            ? `Staged into slot ${slot}`
            : "Staged into the other slot",
    ],
  ];
  return (
    <ResultPanel title="Verified" tone="ok">
      <FileDetails fileName={fileName} size={updatePackage.size} />
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
