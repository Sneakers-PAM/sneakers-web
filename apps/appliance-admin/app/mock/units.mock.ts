// The mock box's three update units (sneakers-appliance spec 7): the Base Web's slots, Check
// now's offers for each unit and a fetch's progress, as osadmin answers them.
import type {
  BaseWebStatus,
  CheckUpdatesResponse,
  FetchProgress,
  ProductVersion,
  UnitOffer,
  UpdateTarget,
} from "@/lib/osadmin/types";

/** The built-in pages' version: the running Base OS's. */
export const BUILTIN_WEB = "0.1.0";

/** The Base Web the mirror offers, which fits Base OS 0.1.x. */
export const OFFERED_WEB = "0.1.2";

/** A newer Base Web that needs Base OS 0.2.x. */
const WAITING_WEB = "0.2.1";

const MB = 1_048_576;

interface WebState {
  current: string;
  /** Why the built-in pages serve while current names a slot. */
  failed: string;
  previous: string;
  staged: string;
}

const fresh = (): WebState => ({ current: "", failed: "", previous: "", staged: "" });

let web = fresh();
let fetch: FetchProgress | undefined;
let lastCheck: CheckUpdatesResponse | undefined;
/** While set, the last fetch shows downloading, as a fetch under way does. */
let fetching = false;
/** While set, the Base OS patch offer uses this version and file name instead of the default. */
let baseOsOffer: { fileName: string; version: string } | null = null;

export const resetUnits = (): void => {
  web = fresh();
  fetch = undefined;
  lastCheck = undefined;
  fetching = false;
  baseOsOffer = null;
};

/**
 * The "lab-names" scenario's Base OS patch offer: the longest real build and patch names a lab
 * box has shown (sneakers-appliance spec 7 issue, Updates cards overflow), so review and the
 * overflow check exercise parseVersion on the real thing, not a stand-in.
 */
export const setLabBaseOffer = (): void => {
  baseOsOffer = {
    fileName:
      "sneakers-appliance-baseOS-patch-0.0.0-lab.20261009m2.r20261010031325-g79c3ceb-from-0.0.0-lab.20261009m.r20261009215048-g79c3ceb-amd64-LAB.bin",
    version: "0.0.0-lab.20261009m2.r20261010031325-g79c3ceb",
  };
};

const slotOf = (version: string): string => (version === web.current ? "a" : "b");

/** GetUpgrades.baseWeb for a box running baseOS. */
export const baseWebStatus = (baseOS: string): BaseWebStatus => {
  const served = web.current && !web.failed ? web.current : BUILTIN_WEB;
  return {
    builtinVersion: BUILTIN_WEB,
    canRevert: !!web.current,
    currentVersion: web.current,
    fits: !web.current || baseOS.startsWith("0.1."),
    previousVersion: web.previous,
    reason: web.failed || (web.current ? "" : "no Base Web is installed"),
    requiresBaseOs: web.current ? "0.1.0 to before 0.2.0" : "",
    runningVersion: served,
    slot: web.current && !web.failed ? slotOf(web.current) : "",
    source: web.current && !web.failed ? "slot" : "built-in",
    stagedVersion: web.staged,
  };
};

/** The pages :8443 serves now. */
export const servedWeb = (): string => (web.current && !web.failed ? web.current : BUILTIN_WEB);

export const stageWeb = (version: string): void => {
  web.staged = version;
};

export const applyWeb = (): string => {
  const version = web.staged;
  web = { current: version, failed: "", previous: web.current, staged: "" };
  return version;
};

/** Reverts to the previous slot, or with none to the built-in pages; the version it went to. */
export const revertWeb = (): string => {
  const back = web.previous;
  web = { current: back, failed: "", previous: back ? web.current : "", staged: web.staged };
  return back || BUILTIN_WEB;
};

export const unstageWeb = (): string => {
  const version = web.staged;
  web.staged = "";
  return version;
};

export const webInstalled = (): boolean => !!web.current;
export const webStaged = (): string => web.staged;

const offer = (target: UpdateTarget, fields: Partial<UnitOffer>): UnitOffer => ({
  bases: [],
  commit: "1a2b3c4",
  fileName: "",
  includesBaseWeb: "",
  kind: "full",
  needs: "",
  note: "",
  outsideProductRange: false,
  preferred: false,
  productRange: "",
  size: "0",
  target,
  version: "",
  ...fields,
});

/** Check now's answer for a box running baseOS, with the product offers from products. */
export const checkUpdates = (
  baseOS: string,
  products: ProductVersion[],
  source: string,
  url: string,
): CheckUpdatesResponse => {
  const baseOs: UnitOffer[] =
    baseOS === "0.1.0"
      ? [
          offer("UPDATE_TARGET_BASE", {
            bases: ["0.1.0"],
            fileName:
              baseOsOffer?.fileName ??
              "sneakers-appliance-baseOS-patch-0.2.0-g1a2b3c4-from-0.1.0-amd64.bin",
            includesBaseWeb: baseOsOffer?.version ?? "0.2.0",
            kind: "patch",
            note: web.current
              ? `After the reboot the box serves the built-in pages of 0.2.0 until a Base Web that fits it is installed (the installed Base Web ${web.current} needs Base OS 0.1.0 to before 0.2.0).`
              : "",
            preferred: true,
            size: String(Math.round(1.4 * MB)),
            version: baseOsOffer?.version ?? "0.2.0",
          }),
          offer("UPDATE_TARGET_BASE", {
            fileName: "sneakers-appliance-baseOS-0.2.0-g1a2b3c4-amd64.bin",
            includesBaseWeb: "0.2.0",
            size: String(72 * MB),
            version: "0.2.0",
          }),
        ]
      : [];
  const served = servedWeb();
  const baseWeb =
    baseOS.startsWith("0.1.") && served !== OFFERED_WEB && web.staged !== OFFERED_WEB
      ? [
          offer("UPDATE_TARGET_BASE_WEB", {
            fileName: `sneakers-appliance-baseWeb-${OFFERED_WEB}-g1a2b3c4-amd64.bin`,
            needs: "0.1.0 to before 0.2.0",
            preferred: true,
            size: String(Math.round(1.2 * MB)),
            version: OFFERED_WEB,
          }),
        ]
      : [];
  lastCheck = {
    baseOs,
    baseWeb,
    baseWebWaits: baseOS.startsWith("0.1.")
      ? `Base Web ${WAITING_WEB} needs Base OS 0.2.0 to before 0.3.0.`
      : "",
    checkedAt: new Date().toISOString(),
    indexFormat: 2,
    product: products.map((v, index) =>
      offer("UPDATE_TARGET_PRODUCT", {
        bases: v.bases,
        fileName: v.fileName,
        needs: v.minBase
          ? v.maxBase
            ? `${v.minBase} to ${v.maxBase}`
            : `${v.minBase} or newer`
          : "",
        preferred: index === 0,
        size: v.size,
        version: v.version,
      }),
    ),
    source,
    url,
  };
  return structuredClone(lastCheck);
};

export const lastCheckAnswer = (): CheckUpdatesResponse | undefined =>
  lastCheck ? structuredClone(lastCheck) : undefined;

/** The unit a file's name says. */
export const targetOfFile = (fileName: string): UpdateTarget => {
  if (fileName.startsWith("sneakers-product-")) return "UPDATE_TARGET_PRODUCT";
  if (fileName.startsWith("sneakers-appliance-baseWeb-")) return "UPDATE_TARGET_BASE_WEB";
  return "UPDATE_TARGET_BASE";
};

/** Records a fetch that came in whole and checked out. */
export const fetched = (fileName: string, uploadId: string, size: number, source: string): void => {
  const now = new Date().toISOString();
  fetch = {
    bytesPerSecond: String(48 * MB),
    code: "",
    doneBytes: String(size),
    error: "",
    etaSeconds: "0",
    fileName,
    source,
    startedAt: now,
    state: "done",
    target: targetOfFile(fileName),
    totalBytes: String(size),
    updatedAt: now,
    uploadId,
    verified: true,
  };
};

/** GetUpgrades.fetchProgress: the last fetch, or one under way in the "fetching" scenario. */
export const fetchProgress = (): FetchProgress | undefined => {
  if (fetching) {
    const now = new Date().toISOString();
    return {
      bytesPerSecond: String(12 * MB),
      code: "",
      doneBytes: String(Math.round(44.6 * MB)),
      error: "",
      etaSeconds: "2",
      fileName: "sneakers-appliance-baseOS-0.2.0-g1a2b3c4-amd64.bin",
      source: "mirror",
      startedAt: now,
      state: "downloading",
      target: "UPDATE_TARGET_BASE",
      totalBytes: String(72 * MB),
      updatedAt: now,
      uploadId: "",
      verified: false,
    };
  }
  return fetch ? structuredClone(fetch) : undefined;
};

/** The units' review scenarios. */
export const UNIT_SCENARIOS = ["fetching", "web-failed", "web-installed", "web-staged"] as const;

export type UnitScenario = (typeof UNIT_SCENARIOS)[number];

export const applyUnitScenario = (scenario: UnitScenario): void => {
  switch (scenario) {
    case "fetching": {
      fetching = true;
      break;
    }
    case "web-failed": {
      web = {
        current: OFFERED_WEB,
        failed:
          "UPGRADE_WEB_LOAD (2532): assets/app.js isn't the file web.yaml names (its SHA-256 or size changed)",
        previous: "",
        staged: "",
      };
      break;
    }
    case "web-installed": {
      web = { current: OFFERED_WEB, failed: "", previous: "", staged: "" };
      break;
    }
    case "web-staged": {
      web = { current: "", failed: "", previous: "", staged: OFFERED_WEB };
      break;
    }
  }
};
