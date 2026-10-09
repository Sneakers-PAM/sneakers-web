// The mock box's certificate store (TlsService): the self-signed :8443 certificate, a CSR made
// on the box, a PFX or PEM upload, the endpoints and their assignments. Its checks follow the
// box's rules closely enough for the page's states: a wildcard is refused in a CSR, a wrong
// PFX password and a few marked uploads are refused with a ValidationReport, a wildcard PFX is
// refused on a box with no host name, and assigning to Product (443) answers that the product
// isn't installed.
import type {
  CertEndpoint,
  GenerateCsrRequest,
  GetCertificateStoreResponse,
  ImportCertificateRequest,
  PendingCsr,
  StoredCertificate,
  ValidationCheck,
} from "@/lib/osadmin/types";

import { OsadminError } from "@/lib/osadmin/errors";

const DAY = 24 * 60 * 60_000;
const HOST = "appliance.example.org";
const ADDRESSES = ["192.0.2.10"];
const SELF_SIGNED_ID = "self-signed";
const VALIDATION_REPORT = "sneakers.appliance.osadmin.v1.ValidationReport";

/** An upload whose PEM holds this marker is refused for a missing intermediate. */
export const MISSING_INTERMEDIATE = "MISSING-INTERMEDIATE";
/** The PFX password the mock accepts; any other is "wrong". */
export const MOCK_PFX_PASSWORD = "correct horse";

const at = (days: number) => new Date(Date.now() + days * DAY).toISOString();

const fingerprint = (seed: string): string => {
  let h = 0;
  for (const c of seed) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  const bytes = Array.from({ length: 32 }, (_, index) =>
    (((h >>> (index % 24)) + index * 37) & 255).toString(16).toUpperCase().padStart(2, "0"),
  );
  return bytes.join(":");
};

const pem = (label: string, body: string) =>
  `-----BEGIN ${label}-----\n${btoa(body)}\n-----END ${label}-----\n`;

/** The names the box checks a certificate against: its host name, if it has one, then its addresses. */
const boxNames = (host: string): string[] => [...(host ? [host] : []), ...ADDRESSES];

const selfSigned = (host = HOST): StoredCertificate => {
  const cn = host || (ADDRESSES[0] ?? "");
  return {
    added: at(-30),
    certificatePem: pem("CERTIFICATE", "self-signed"),
    chain: [cn],
    fingerprint: fingerprint("self-signed"),
    id: SELF_SIGNED_ID,
    issuer: `CN=${cn},O=Sneakers-PAM appliance admin`,
    keyType: "ECDSA P-256",
    names: boxNames(host),
    notAfter: at(367),
    notBefore: at(-30),
    source: "CERTIFICATE_SOURCE_SELF_SIGNED",
    subject: `CN=${cn},O=Sneakers-PAM appliance admin`,
  };
};

const wildcard = (id: string, notAfter = at(359)): StoredCertificate => ({
  added: at(0),
  certificatePem: pem("CERTIFICATE", `wildcard-${id}`),
  chain: ["*.example.org", "Example Issuing CA", "Example Root CA"],
  fingerprint: fingerprint(`wildcard-${id}`),
  id,
  issuer: "CN=Example Issuing CA,O=Example",
  keyType: "RSA 4096",
  names: ["*.example.org", "example.org"],
  notAfter,
  notBefore: at(-6),
  source: "CERTIFICATE_SOURCE_UPLOADED",
  subject: "CN=*.example.org",
});

const CHECKS_OK = (names: string): ValidationCheck[] => [
  { detail: "matches the key in the upload", name: "key", passed: true },
  { detail: "TLS server", name: "usage", passed: true },
  { detail: "*.example.org > Example Issuing CA > Example Root CA", name: "chain", passed: true },
  { detail: `covers ${names}`, name: "names", passed: true },
  { detail: "valid for 359 days", name: "validity", passed: true },
];

interface State {
  assigned: null | string;
  certificates: StoredCertificate[];
  count: number;
  csrs: PendingCsr[];
  /** The box's host name; empty for a box that has none. */
  host: string;
  notServed: boolean;
  /** The store certificate Product (443) serves; null for the box's own. */
  productAssigned: null | string;
  /** 443 doesn't serve a newly assigned certificate, so the box puts the previous one back. */
  productNotServed: boolean;
}

const fresh = (): State => ({
  assigned: null,
  certificates: [selfSigned()],
  count: 0,
  csrs: [],
  host: HOST,
  notServed: false,
  productAssigned: null,
  productNotServed: false,
});

let state = fresh();

export const resetCertificates = (): void => {
  state = fresh();
};

/** The certificate-page scenarios, for the gallery and the tests. */
export type CertificateScenario =
  | "cert-assigned"
  | "cert-csr-pending"
  | "cert-expiring"
  | "cert-no-hostname"
  | "cert-not-served"
  | "cert-product-assigned"
  | "cert-product-not-served";

export const CERTIFICATE_SCENARIOS: CertificateScenario[] = [
  "cert-assigned",
  "cert-csr-pending",
  "cert-expiring",
  "cert-no-hostname",
  "cert-not-served",
  "cert-product-assigned",
  "cert-product-not-served",
];

export const applyCertificateScenario = (scenario: CertificateScenario): void => {
  switch (scenario) {
    case "cert-assigned": {
      state.certificates.push(wildcard("c0ffee000001"));
      state.assigned = "c0ffee000001";
      break;
    }
    case "cert-csr-pending": {
      state.csrs.push(newCsr("csr000000001", "admin.example.org", "RSA 4096"));
      break;
    }
    case "cert-expiring": {
      state.certificates.push(wildcard("c0ffee000002", at(12)));
      state.assigned = "c0ffee000002";
      break;
    }
    case "cert-no-hostname": {
      state.host = "";
      state.certificates = [selfSigned("")];
      break;
    }
    case "cert-not-served": {
      state.notServed = true;
      break;
    }
    case "cert-product-assigned": {
      if (!state.certificates.some((c) => c.id === "c0ffee000003"))
        state.certificates.push(wildcard("c0ffee000003"));
      state.productAssigned = "c0ffee000003";
      break;
    }
    case "cert-product-not-served": {
      state.productNotServed = true;
      break;
    }
  }
};

const newCsr = (id: string, name: string, keyType: string): PendingCsr => {
  const names = [...new Set([name, state.host].filter(Boolean)), ...ADDRESSES];
  return {
    created: at(0),
    csrPem: pem("CERTIFICATE REQUEST", `csr-${id}`),
    id,
    keyType,
    names,
    subject: `CN=${name || state.host || (ADDRESSES[0] ?? "")}`,
  };
};

const nextId = () => {
  state.count++;
  return `mock${String(state.count).padStart(8, "0")}`;
};

const usedBy = (id: string): string[] => [
  ...((state.assigned ?? SELF_SIGNED_ID) === id ? ["admin"] : []),
  ...(state.productAssigned === id ? ["product"] : []),
];

const adminEndpoint = (): CertEndpoint => {
  const id = state.assigned ?? SELF_SIGNED_ID;
  const cert = state.certificates.find((c) => c.id === id) ?? selfSigned(state.host);
  const days = Math.floor((Date.parse(cert.notAfter) - Date.now()) / DAY);
  let endpointState: CertEndpoint["state"] = "ENDPOINT_STATE_OK";
  let detail = `${String(days)} days left.`;
  if (!state.assigned) {
    endpointState = "ENDPOINT_STATE_SELF_SIGNED";
    detail = "The box's own self-signed certificate; check its fingerprint.";
  } else if (days <= 30) {
    endpointState = "ENDPOINT_STATE_EXPIRING";
    detail = `The :8443 certificate expires in ${String(days)} days; nothing renews it, so upload a new one.`;
  }
  return {
    available: true,
    certificateId: id,
    expires: cert.notAfter,
    id: "admin",
    name: ":8443 admin",
    names: boxNames(state.host),
    servingFingerprint: cert.fingerprint,
    source: state.assigned ? "ENDPOINT_SOURCE_ASSIGNED" : "ENDPOINT_SOURCE_SELF_SIGNED",
    state: endpointState,
    stateDetail: detail,
  };
};

/** Product (443): the edge serves the box's own certificate until a store one is assigned. */
const productEndpoint = (installed: boolean): CertEndpoint => {
  if (!installed) return PRODUCT_ENDPOINT;
  const cert = state.certificates.find((c) => c.id === state.productAssigned);
  if (!cert) {
    return {
      available: true,
      id: "product",
      name: "Product (443)",
      names: boxNames(state.host),
      servingFingerprint: selfSigned(state.host).fingerprint,
      source: "ENDPOINT_SOURCE_SELF_SIGNED",
      state: "ENDPOINT_STATE_SELF_SIGNED",
      stateDetail: "443 serves the box's own certificate.",
    };
  }
  const days = Math.floor((Date.parse(cert.notAfter) - Date.now()) / DAY);
  return {
    available: true,
    certificateId: cert.id,
    expires: cert.notAfter,
    id: "product",
    name: "Product (443)",
    names: boxNames(state.host),
    servingFingerprint: cert.fingerprint,
    source: "ENDPOINT_SOURCE_ASSIGNED",
    state: days <= 30 ? "ENDPOINT_STATE_EXPIRING" : "ENDPOINT_STATE_OK",
    stateDetail: `${String(days)} days left.`,
  };
};

const PRODUCT_ENDPOINT: CertEndpoint = {
  available: false,
  id: "product",
  name: "Product (443)",
  source: "ENDPOINT_SOURCE_ASSIGNED",
  state: "ENDPOINT_STATE_UNAVAILABLE",
  unavailableReason: "Available when the product is installed.",
};

const store = (installed: boolean): GetCertificateStoreResponse => ({
  acme: {
    available: false,
    reason: "Not available yet: ACME through cert-manager comes with the product bundle.",
  },
  certificates: state.certificates.map((c) => ({ ...c, usedBy: usedBy(c.id) })),
  csrs: structuredClone(state.csrs),
  endpoints: [adminEndpoint(), productEndpoint(installed)],
});

const refused = (symbol: string, code: number, reason: string, checks: ValidationCheck[]) =>
  new OsadminError("failed_precondition", `${symbol} (${String(code)}): ${reason}`, symbol, [
    { debug: { checks }, type: VALIDATION_REPORT, value: "" },
  ]);

const missingIntermediate = () =>
  refused(
    "TLS_CHAIN",
    3805,
    'the chain stops at "*.example.org": its issuer "Example Issuing CA" isn\'t in the upload; add that intermediate or root certificate, or upload the root on its own',
    [
      { detail: "matches the key in the upload", name: "key", passed: true },
      { detail: "TLS server", name: "usage", passed: true },
      {
        detail:
          'the chain stops at "*.example.org": its issuer "Example Issuing CA" isn\'t in the upload',
        name: "chain",
        passed: false,
      },
      { detail: `covers ${HOST}`, name: "names", passed: true },
      { detail: "valid for 359 days", name: "validity", passed: true },
    ],
  );

const noHostname = () => {
  const has = wildcard("").names.join(", ");
  const reason = `this box has no host name yet, so the certificate is checked against ${ADDRESSES.join(", ")} only, and it covers ${has}; set the host name on Network (a fully qualified name such as appliance.example.org), then try again`;
  return refused("TLS_NO_HOSTNAME", 3815, reason, [
    { detail: "matches the key in the upload", name: "key", passed: true },
    { detail: "TLS server", name: "usage", passed: true },
    { detail: "*.example.org > Example Issuing CA > Example Root CA", name: "chain", passed: true },
    { detail: reason, name: "names", passed: false },
    { detail: "valid for 359 days", name: "validity", passed: true },
  ]);
};

const generate = (r: GenerateCsrRequest) => {
  const extra = r.names.map((n) => n.trim().toLowerCase()).filter(Boolean);
  const wild = extra.find((n) => n.includes("*"));
  if (wild)
    throw new OsadminError(
      "failed_precondition",
      `TLS_INVALID (3801): names: "${wild}": a wildcard key is shared across servers; import it with Upload PFX`,
    );
  if (extra.length > 1)
    throw new OsadminError(
      "failed_precondition",
      "TLS_INVALID (3801): names: a request made on this box is for one name, plus the box's host name and addresses; for more names, import the certificate with Upload PFX",
    );
  const keyType = {
    KEY_TYPE_ECDSA_P256: "ECDSA P-256",
    KEY_TYPE_ECDSA_P384: "ECDSA P-384",
    KEY_TYPE_RSA_3072: "RSA 3072",
    KEY_TYPE_RSA_4096: "RSA 4096",
  }[r.keyType];
  const csr = newCsr(nextId(), extra[0] ?? "", keyType);
  state.csrs.push(csr);
  return { csr };
};

const add = (cert: StoredCertificate) => {
  state.certificates.push(cert);
  return { certificate: { ...cert, usedBy: [] }, checks: CHECKS_OK(HOST) };
};

const importCertificate = (r: ImportCertificateRequest) => {
  if (r.pkcs12) {
    if (r.pkcs12Password !== MOCK_PFX_PASSWORD)
      throw new OsadminError(
        "failed_precondition",
        "TLS_FORMAT (3802): the PKCS#12 password is wrong",
      );
    if (!state.host) throw noHostname();
    return add(wildcard(nextId()));
  }
  if (!r.certificatePem?.includes("BEGIN CERTIFICATE"))
    throw new OsadminError(
      "failed_precondition",
      "TLS_FORMAT (3802): the certificate isn't PEM (it should start with -----BEGIN CERTIFICATE-----)",
    );
  if (!r.keyPem?.trim())
    throw new OsadminError("failed_precondition", "TLS_FORMAT (3802): the private key is missing");
  if (`${r.certificatePem}${r.chainPem ?? ""}`.includes(MISSING_INTERMEDIATE))
    throw missingIntermediate();
  return add(wildcard(nextId()));
};

const complete = (body: Record<string, string>) => {
  const csr = state.csrs.find((c) => c.id === body.csrId);
  if (!csr)
    throw new OsadminError(
      "failed_precondition",
      `TLS_UNKNOWN (3809): no pending CSR has the id "${body.csrId ?? ""}"`,
    );
  if (!body.certificatePem?.includes("BEGIN CERTIFICATE"))
    throw new OsadminError(
      "failed_precondition",
      "TLS_FORMAT (3802): the signed certificate is missing",
    );
  if (`${body.certificatePem}${body.chainPem ?? ""}`.includes(MISSING_INTERMEDIATE))
    throw missingIntermediate();
  state.csrs = state.csrs.filter((c) => c.id !== csr.id);
  const id = nextId();
  return add({
    ...wildcard(id),
    chain: [csr.names[0] ?? HOST, "Example Issuing CA", "Example Root CA"],
    csrId: csr.id,
    keyType: csr.keyType,
    names: csr.names,
    source: "CERTIFICATE_SOURCE_CSR_SIGNED",
    subject: csr.subject,
  });
};

const assign = (body: Record<string, string>, installed: boolean) => {
  if (body.endpointId === "product" && !installed)
    throw new OsadminError(
      "failed_precondition",
      "TLS_ENDPOINT_UNAVAILABLE (3812): the product endpoint is available when the product is installed",
    );
  if (!state.certificates.some((c) => c.id === body.certificateId))
    throw new OsadminError(
      "failed_precondition",
      `TLS_UNKNOWN (3809): no certificate has the id "${body.certificateId ?? ""}"`,
    );
  if (body.endpointId === "product") {
    if (state.productNotServed)
      throw new OsadminError(
        "failed_precondition",
        "TLS_NOT_SERVED (3813): 443 didn't serve the new certificate within 3m0s (the handshake still showed the previous one), so the previous one was put back",
      );
    state.productAssigned =
      body.certificateId === SELF_SIGNED_ID ? null : (body.certificateId ?? null);
    return { endpoint: productEndpoint(installed) };
  }
  if (state.notServed)
    throw new OsadminError(
      "failed_precondition",
      "TLS_NOT_SERVED (3813): :8443 didn't serve the new certificate within 15s, so the previous one was put back",
    );
  state.assigned = body.certificateId === SELF_SIGNED_ID ? null : (body.certificateId ?? null);
  return { endpoint: adminEndpoint() };
};

const remove = (body: Record<string, string>) => {
  const id = body.certificateId ?? "";
  if (id === SELF_SIGNED_ID)
    throw new OsadminError(
      "failed_precondition",
      "TLS_IN_USE (3810): the box's own self-signed certificate can't be deleted",
    );
  if (usedBy(id).length > 0)
    throw new OsadminError(
      "failed_precondition",
      `TLS_IN_USE (3810): the ${usedBy(id).join(" and ")} endpoint uses this certificate; assign another one first`,
    );
  state.certificates = state.certificates.filter((c) => c.id !== id);
  return {};
};

/** Answers one TlsService method. */
export const certificatesRequest = (
  method: string,
  body: unknown,
  { productInstalled }: { productInstalled: boolean },
): unknown => {
  const b = (body ?? {}) as Record<string, string>;
  switch (method) {
    case "AssignCertificate": {
      return assign(b, productInstalled);
    }
    case "CompleteCsr": {
      return complete(b);
    }
    case "DeleteCertificate": {
      return remove(b);
    }
    case "DiscardCsr": {
      state.csrs = state.csrs.filter((c) => c.id !== b.csrId);
      return {};
    }
    case "GenerateCsr": {
      return generate(body as GenerateCsrRequest);
    }
    case "GetCertificateStore": {
      return store(productInstalled);
    }
    case "ImportCertificate": {
      return importCertificate(body as ImportCertificateRequest);
    }
    case "RenewNow":
    case "SetAcme": {
      throw new OsadminError(
        "failed_precondition",
        "TLS_ACME_UNAVAILABLE (3814): ACME through cert-manager isn't available yet; it comes with the product bundle",
      );
    }
    case "RevertToSelfSigned": {
      if (b.endpointId === "product") {
        if (!productInstalled)
          throw new OsadminError(
            "failed_precondition",
            "TLS_ENDPOINT_UNAVAILABLE (3812): the product endpoint is available when the product is installed",
          );
        state.productAssigned = null;
        return { endpoint: productEndpoint(productInstalled) };
      }
      state.assigned = null;
      return { endpoint: adminEndpoint() };
    }
  }
  throw new OsadminError("unimplemented", "Not available in this release");
};
