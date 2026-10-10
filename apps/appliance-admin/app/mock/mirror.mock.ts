// The mock box's internal update mirror: the update trust (TlsService.SetUpdateTrust and
// ClearUpdateTrust) and how a mirror fetch goes. The mock mirror is a public-CA server unless a
// scenario makes it an internal one; an internal one is trusted only once its CA is the update
// trust, and a pin must match its certificate. Over plain HTTP every fetch goes through, as on
// the box: the .bin's signature is what's checked.
import type { MirrorStatus, TrustedCa, UpdateTrust } from "@/lib/osadmin/types";

import { OsadminError } from "@/lib/osadmin/errors";

const DAY = 24 * 60 * 60_000;
const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

/** The internal CA's PEM as an owner would paste it; any other PEM is a different CA. */
export const MOCK_INTERNAL_CA_PEM = `-----BEGIN CERTIFICATE-----
MOCK-INTERNAL-ROOT-CA
-----END CERTIFICATE-----`;

const INTERNAL_CA: TrustedCa = {
  issuer: "Example Internal Root CA",
  notAfter: at(3650),
  sha256:
    "3A:1F:9C:0B:7E:44:D2:18:6A:5B:C3:90:EE:21:47:8D:0F:6C:B5:12:9A:E7:33:4C:D8:61:2F:A0:5E:B9:C4:07",
  subject: "Example Internal Root CA",
};
const OTHER_CA: TrustedCa = {
  issuer: "Example Other Root CA",
  notAfter: at(3650),
  sha256:
    "B2:04:7D:E9:51:3C:A8:6F:12:90:4B:DE:77:0A:C5:38:9E:F1:26:5D:B3:48:0C:E2:7A:16:D9:43:8B:F0:65:21",
  subject: "Example Other Root CA",
};

/** The mirror server's certificate, by the CA that issued it. */
const SERVER = {
  internal: {
    issuer: "Example Internal Issuing CA",
    notAfter: at(200),
    sha256:
      "5C:E8:21:9B:04:7F:A3:D6:30:BB:18:C2:6E:F4:59:0A:97:2D:E1:4C:83:B6:7A:15:F9:0D:62:C8:3E:A4:51:9F",
    subject: "mirror.example.org",
  },
  public: {
    issuer: "Example Public TLS CA",
    notAfter: at(80),
    sha256:
      "91:0D:C4:6B:3E:A7:52:F8:1C:E0:29:B5:7A:D3:46:8F:02:BC:E9:15:6D:A8:30:F7:4B:C1:98:2E:5A:D6:07:E3",
    subject: "mirror.example.org",
  },
};

interface MirrorState {
  last: {
    at: string;
    code: string;
    error: string;
    pinMatched: boolean;
    server: (typeof SERVER)["public"] | null;
    url: string;
  } | null;
  /** Which CA the mock mirror's certificate is from. */
  server: keyof typeof SERVER;
  trust: null | UpdateTrust;
}

const fresh = (): MirrorState => ({ last: null, server: "public", trust: null });

let state = fresh();

export const resetMirror = (): void => {
  state = fresh();
};

const trustOf = (cas: TrustedCa[], pin = ""): UpdateTrust => ({
  cas,
  pinSha256: pin,
  setAt: new Date().toISOString(),
  setBy: "alice",
});

/** The mirror scenarios, for the gallery and the tests; each sets the policy's mirror URL too. */
export type MirrorScenario =
  "mirror-custom-ca" | "mirror-http" | "mirror-https" | "mirror-pin-mismatch" | "mirror-wrong-ca";

export const MIRROR_SCENARIOS: MirrorScenario[] = [
  "mirror-custom-ca",
  "mirror-http",
  "mirror-https",
  "mirror-pin-mismatch",
  "mirror-wrong-ca",
];

/** Puts the mock mirror in a scenario and returns the mirror URL the policy should have. */
export const applyMirrorScenario = (scenario: MirrorScenario): string => {
  state = fresh();
  switch (scenario) {
    case "mirror-custom-ca": {
      state.server = "internal";
      state.trust = trustOf([INTERNAL_CA]);
      break;
    }
    case "mirror-http": {
      mirrorFetch("http://192.0.2.20/sneakers");
      return "http://192.0.2.20/sneakers";
    }
    case "mirror-https": {
      break;
    }
    case "mirror-pin-mismatch": {
      state.server = "internal";
      state.trust = trustOf([INTERNAL_CA], SERVER.public.sha256);
      break;
    }
    case "mirror-wrong-ca": {
      state.server = "internal";
      state.trust = trustOf([OTHER_CA]);
      break;
    }
  }
  const url = "https://mirror.example.org/sneakers";
  mirrorFetch(url);
  return url;
};

/** The refusal a fetch from url gets, or null; the fetch is recorded for mirrorStatus. */
export const mirrorFetch = (url: string): null | OsadminError => {
  const https = url.startsWith("https://");
  const server = https ? SERVER[state.server] : null;
  let refusal: null | OsadminError = null;
  const trusted = state.server === "public" || state.trust?.cas.includes(INTERNAL_CA) === true;
  if (server && !trusted)
    refusal = new OsadminError(
      "failed_precondition",
      `UPGRADE_MIRROR_UNTRUSTED (2520): the mirror's certificate ${server.sha256} (${server.subject}, issued by ${server.issuer}) isn't trusted: x509: certificate signed by unknown authority; add its CA as the update trust on Certificates`,
    );
  const pin = state.trust?.pinSha256 ?? "";
  const pinMatched = Boolean(server && pin && pin === server.sha256);
  if (server && !refusal && pin && !pinMatched)
    refusal = new OsadminError(
      "failed_precondition",
      `UPGRADE_MIRROR_PIN (2521): the mirror presented ${server.sha256} (issued by ${server.issuer}), not the pinned ${pin}`,
    );
  const [code = "", ...rest] = refusal ? refusal.message.split(": ") : [];
  state.last = {
    at: new Date().toISOString(),
    code: code.replace(/ \(\d+\)$/, ""),
    error: rest.join(": "),
    pinMatched,
    server,
    url,
  };
  return refusal;
};

/** GetUpgrades' mirror_status for the mirror the policy's source names. */
export const mirrorStatus = (
  url: string,
  source = "manual",
  builtinUrls: string[] = [],
): MirrorStatus | undefined => {
  if (!url) return undefined;
  const https = url.startsWith("https://");
  const customCa = https && (state.trust?.cas.length ?? 0) > 0;
  const pinned = https && Boolean(state.trust?.pinSha256);
  let note = "plain HTTP: integrity from the signature only";
  if (https) {
    note = "HTTPS, checked against the system roots";
    if (customCa) note += " and the update trust's CA";
    if (pinned) note += ", with the server certificate pinned";
  }
  const last = state.last?.url === url ? state.last : null;
  return {
    builtinUrls,
    checked: Boolean(last),
    checkedAt: last?.at,
    code: last?.code ?? "",
    customCa,
    error: last?.error ?? "",
    note,
    ok: Boolean(last && !last.code),
    pinMatched: last?.pinMatched ?? false,
    pinned,
    releaseChannel: "",
    releaseChannelDefault: false,
    releaseRepo: "",
    releaseRepoOverrideAllowed: false,
    releaseTag: "",
    scheme: https ? "https" : "http",
    serverIssuer: last?.server?.issuer ?? "",
    serverNotAfter: last?.server?.notAfter,
    serverSha256: last?.server?.sha256 ?? "",
    serverSubject: last?.server?.subject ?? "",
    source,
    url,
  };
};

/** GetCertificateStore's update_trust. */
export const updateTrust = (): undefined | UpdateTrust =>
  state.trust ? structuredClone(state.trust) : undefined;

const PIN = /^[\da-f]{64}$/;

/** Answers SetUpdateTrust and ClearUpdateTrust. */
export const mirrorTrustRequest = (method: string, body: unknown): unknown => {
  const b = (body ?? {}) as { caPem?: string; pinSha256?: string };
  if (method === "ClearUpdateTrust") {
    state.trust = null;
    state.last = null;
    return {};
  }
  const caPem = (b.caPem ?? "").trim();
  const rawPin = (b.pinSha256 ?? "").trim();
  if (!caPem && !rawPin)
    throw new OsadminError(
      "failed_precondition",
      "TLS_INVALID (3801): give a CA (PEM), a pin, or both; ClearUpdateTrust removes the trust",
    );
  if (caPem && !caPem.includes("-----BEGIN CERTIFICATE-----"))
    throw new OsadminError(
      "failed_precondition",
      "TLS_FORMAT (3802): ca_pem: not PEM certificates",
    );
  let pin = "";
  if (rawPin) {
    const folded = rawPin.replaceAll(/[\s:]/g, "").toLowerCase();
    if (!PIN.test(folded))
      throw new OsadminError(
        "failed_precondition",
        "TLS_INVALID (3801): pin_sha256: a SHA-256 fingerprint is 64 hex digits",
      );
    pin = (folded.toUpperCase().match(/../g) ?? []).join(":");
  }
  let cas: TrustedCa[] = [];
  if (caPem) cas = [caPem.includes("MOCK-INTERNAL-ROOT") ? INTERNAL_CA : OTHER_CA];
  state.trust = trustOf(cas, pin);
  state.last = null;
  return { updateTrust: structuredClone(state.trust) };
};
