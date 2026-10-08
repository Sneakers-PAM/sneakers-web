import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Pill,
  Textarea,
} from "@sneakers-web/ui";
import { useState } from "react";

import type {
  AddedCertificate,
  KeyType,
  PendingCsr,
  StoredCertificate,
  ValidationCheck,
} from "@/lib/osadmin/types";

import { Advanced } from "@/components/Advanced";
import { ValidationList } from "@/components/certificates/ValidationList";
import { saveText } from "@/lib/download";
import { tls } from "@/lib/osadmin/client";
import { isStepUpRequired, reasonOf, validationChecksOf } from "@/lib/osadmin/errors";
import { requestStepUp } from "@/lib/osadmin/stepUpController";

type Path = "csr" | "pem" | "pfx";

type Step =
  | { added: AddedCertificate; kind: "validated" }
  | { csr: PendingCsr; kind: "csr-download" }
  | { csr: PendingCsr; kind: "csr-upload" }
  | { fingerprint: string; kind: "applied" }
  | { kind: "choose" }
  | { kind: "csr-details" }
  | { kind: "pem" }
  | { kind: "pfx" };

const STEPS: Record<Path, string[]> = {
  csr: ["Details", "Download CSR", "Upload signed certificate", "Validate", "Apply"],
  pem: ["Choose files", "Validate", "Apply"],
  pfx: ["Choose file", "Validate", "Apply"],
};

const stepIndex = (path: Path, step: Step): number => {
  if (step.kind === "validated") return STEPS[path].length - 2;
  if (step.kind === "applied") return STEPS[path].length - 1;
  return { "csr-details": 0, "csr-download": 1, "csr-upload": 2 }[step.kind as string] ?? 0;
};

const KEY_TYPES: { label: string; value: KeyType }[] = [
  { label: "RSA 4096 (default)", value: "KEY_TYPE_RSA_4096" },
  { label: "RSA 3072", value: "KEY_TYPE_RSA_3072" },
  { label: "ECDSA P-256", value: "KEY_TYPE_ECDSA_P256" },
  { label: "ECDSA P-384", value: "KEY_TYPE_ECDSA_P384" },
];

/** Why a name can't go in a request made on this box, or null when it can. */
export const csrNameProblem = (name: string): null | string => {
  const n = name.trim();
  if (n.includes("*")) return "A wildcard key is shared across servers; import it with Upload PFX.";
  if (/\s/.test(n)) return "Enter one name: a request made on this box is for a single name.";
  return null;
};

const base64 = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = "";
  for (const b of bytes) text += String.fromCodePoint(b);
  return btoa(text);
};

const readText = async (file?: File): Promise<string> => (file ? file.text() : "");

interface Failure {
  checks: ValidationCheck[];
  reason: string;
}

/**
 * The Add certificate stepper: Upload PFX (the main path), Upload PEM, or a single-name request
 * made on this box. Each path validates, lists every check, then applies to :8443 live.
 */
export const AddCertificate = ({
  onChanged,
  onOpenChange,
  open,
  resume,
}: {
  onChanged: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** A pending CSR to continue at its upload step. */
  resume?: PendingCsr;
}) => {
  const [path, setPath] = useState<Path>(resume ? "csr" : "pfx");
  const [step, setStep] = useState<Step>(
    resume ? { csr: resume, kind: "csr-upload" } : { kind: "choose" },
  );
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);
  const [pfx, setPfx] = useState<File>();
  const [password, setPassword] = useState("");
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
  const [chainPem, setChainPem] = useState("");
  const [rootPem, setRootPem] = useState("");
  const [name, setName] = useState("");
  const [keyType, setKeyType] = useState<KeyType>("KEY_TYPE_RSA_4096");
  const [subject, setSubject] = useState({ commonName: "", country: "", organization: "" });

  const run = async (function_: () => Promise<void>) => {
    setBusy(true);
    setFailure(null);
    try {
      await function_();
    } catch (error) {
      if (isStepUpRequired(error)) {
        requestStepUp(() => void run(function_));
        return;
      }
      setFailure({ checks: validationChecksOf(error), reason: reasonOf(error) });
    } finally {
      setBusy(false);
    }
  };

  const validated = (added: AddedCertificate) => {
    setStep({ added, kind: "validated" });
    onChanged();
  };

  const submitPfx = () =>
    run(async () => {
      if (!pfx) return;
      const secret = password;
      setPassword("");
      validated(
        await tls.importCertificate({ pkcs12: await base64(pfx), pkcs12Password: secret, rootPem }),
      );
    });

  const submitPem = () =>
    run(async () =>
      validated(
        await tls.importCertificate({ certificatePem: certPem, chainPem, keyPem, rootPem }),
      ),
    );

  const generate = () =>
    run(async () => {
      const { csr } = await tls.generateCsr({
        commonName: subject.commonName,
        country: subject.country,
        keyType,
        names: name.trim() ? [name.trim()] : [],
        organization: subject.organization,
      });
      setStep({ csr, kind: "csr-download" });
      onChanged();
    });

  const complete = (csr: PendingCsr) =>
    run(async () => validated(await tls.completeCsr(csr.id, certPem, chainPem, rootPem)));

  const apply = (cert: StoredCertificate) =>
    run(async () => {
      const { endpoint } = await tls.assign("admin", cert.id);
      setStep({ fingerprint: endpoint.servingFingerprint ?? cert.fingerprint, kind: "applied" });
      onChanged();
    });

  const nameProblem = csrNameProblem(name);
  const steps = step.kind === "choose" ? [] : STEPS[path];
  const current = stepIndex(path, step);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add certificate</DialogTitle>
          <DialogDescription>
            Keys are sealed on this box. Every change needs an owner and a recent sign-in.
          </DialogDescription>
        </DialogHeader>
        {steps.length > 0 && (
          <ol aria-label="Steps" className="flex flex-wrap gap-2 text-small">
            {steps.map((label, index) => (
              <li aria-current={index === current ? "step" : undefined} key={label}>
                <Pill tone={index < current ? "ok" : index === current ? "primary" : "neutral"}>
                  {String(index + 1)} {label}
                </Pill>
              </li>
            ))}
          </ol>
        )}

        {step.kind === "choose" && (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">How the certificate comes in</legend>
            <Choice
              checked={path === "pfx"}
              detail="One .pfx or .p12 file with the certificate (a wildcard works), its private key and the full chain. The password is used once, never kept."
              label="Upload PFX / PKCS#12"
              onSelect={() => setPath("pfx")}
              recommended
              value="pfx"
            />
            <Choice
              checked={path === "pem"}
              detail="The certificate, the private key and the chain as PEM."
              label="Upload PEM"
              onSelect={() => setPath("pem")}
              value="pem"
            />
            <Choice
              checked={path === "csr"}
              detail="For a single-name certificate. The key is made here and never leaves."
              label="Create a request on this box (CSR)"
              onSelect={() => setPath("csr")}
              value="csr"
            />
          </fieldset>
        )}

        {step.kind === "pfx" && (
          <div className="flex flex-col gap-3">
            <Field
              hint="The certificate, its private key and the full chain to the root."
              label="PFX file"
            >
              <input
                accept=".pfx,.p12"
                onChange={(event) => setPfx(event.target.files?.[0])}
                type="file"
              />
            </Field>
            <Field hint="Write-only: used for this import, never kept." label="Password">
              <Input
                autoComplete="off"
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </Field>
            <RootField onChange={setRootPem} value={rootPem} />
          </div>
        )}

        {step.kind === "pem" && (
          <div className="flex flex-col gap-3">
            <PemField label="Certificate (PEM)" onChange={setCertPem} value={certPem} />
            <PemField label="Private key (PEM)" onChange={setKeyPem} value={keyPem} />
            <PemField label="Chain (PEM)" onChange={setChainPem} value={chainPem} />
            <RootField onChange={setRootPem} value={rootPem} />
          </div>
        )}

        {step.kind === "csr-details" && (
          <div className="flex flex-col gap-3">
            <Field
              error={name && nameProblem ? nameProblem : undefined}
              hint="The box's host name and management addresses are always included."
              label="Name for the certificate (one, optional)"
            >
              <Input mono onChange={(event) => setName(event.target.value)} value={name} />
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 font-bold">Key type</legend>
              {KEY_TYPES.map((k) => (
                <label className="flex items-center gap-2" key={k.value}>
                  <input
                    checked={keyType === k.value}
                    name="key-type"
                    onChange={() => setKeyType(k.value)}
                    type="radio"
                    value={k.value}
                  />
                  {k.label}
                </label>
              ))}
              <p className="text-small text-muted">
                Nothing weaker than RSA 3072 is offered or accepted.
              </p>
            </fieldset>
            <Advanced label="Advanced: subject">
              <Field label="Common name">
                <Input
                  mono
                  onChange={(event) => setSubject({ ...subject, commonName: event.target.value })}
                  value={subject.commonName}
                />
              </Field>
              <Field label="Organisation">
                <Input
                  onChange={(event) => setSubject({ ...subject, organization: event.target.value })}
                  value={subject.organization}
                />
              </Field>
              <Field hint="Two letters." label="Country">
                <Input
                  maxLength={2}
                  onChange={(event) =>
                    setSubject({ ...subject, country: event.target.value.toUpperCase() })
                  }
                  value={subject.country}
                />
              </Field>
            </Advanced>
          </div>
        )}

        {step.kind === "csr-download" && (
          <div className="flex flex-col gap-3">
            <Alert role="status" title="CSR generated" tone="ok">
              Send it to your CA. It stays under Pending requests until the signed certificate is
              uploaded.
            </Alert>
            <p className="text-small">
              {step.csr.keyType} . {step.csr.names.join(", ")}
            </p>
            <Textarea aria-label="CSR" mono readOnly rows={6} value={step.csr.csrPem} />
            <div>
              <Button
                onClick={() => saveText(`${step.csr.names[0] ?? "box"}.csr`, step.csr.csrPem)}
                variant="secondary"
              >
                Download CSR
              </Button>
            </div>
          </div>
        )}

        {step.kind === "csr-upload" && (
          <div className="flex flex-col gap-3">
            <p className="text-small">
              For request {step.csr.id}: {step.csr.names.join(", ")}
            </p>
            <PemField label="Signed certificate (PEM)" onChange={setCertPem} value={certPem} />
            <PemField
              label="Chain: intermediates, and the root if you have it (PEM)"
              onChange={setChainPem}
              value={chainPem}
            />
            <RootField onChange={setRootPem} value={rootPem} />
          </div>
        )}

        {step.kind === "validated" && (
          <div className="flex flex-col gap-3">
            <ValidationList checks={step.added.checks} passed />
            <p className="text-small">
              Saved to the store. Apply it to :8443 now, or assign it later under Endpoints.
            </p>
          </div>
        )}

        {step.kind === "applied" && (
          <Alert role="status" title="Done" tone="ok">
            Applied. :8443 now serves <span className="font-mono">{step.fingerprint}</span>. Your
            browser reconnects with the new certificate; the console shows the new fingerprint.
          </Alert>
        )}

        {failure && (
          <div className="flex flex-col gap-3">
            {failure.checks.length > 0 && <ValidationList checks={failure.checks} passed={false} />}
            <Alert role="alert" title="Not saved" tone="danger">
              <p>{failure.reason}</p>
              <p>Nothing was changed; :8443 keeps its current certificate.</p>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step.kind === "choose" && (
            <Button
              onClick={() => setStep(path === "csr" ? { kind: "csr-details" } : { kind: path })}
            >
              Continue
            </Button>
          )}
          {(step.kind === "pfx" || step.kind === "pem") && (
            <Button
              disabled={busy || (step.kind === "pfx" ? !pfx : !certPem || !keyPem)}
              onClick={() => void (step.kind === "pfx" ? submitPfx() : submitPem())}
            >
              Validate and save
            </Button>
          )}
          {step.kind === "csr-details" && (
            <Button disabled={busy || nameProblem !== null} onClick={() => void generate()}>
              Generate CSR
            </Button>
          )}
          {step.kind === "csr-download" && (
            <Button onClick={() => setStep({ csr: step.csr, kind: "csr-upload" })}>
              Next: upload signed certificate
            </Button>
          )}
          {step.kind === "csr-upload" && (
            <Button disabled={busy || !certPem} onClick={() => void complete(step.csr)}>
              Validate and save
            </Button>
          )}
          {step.kind === "validated" && (
            <Button disabled={busy} onClick={() => void apply(step.added.certificate)}>
              Apply to :8443
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            {step.kind === "applied" ? "Done" : step.kind === "validated" ? "Not now" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Choice = ({
  checked,
  detail,
  label,
  onSelect,
  recommended,
  value,
}: {
  checked: boolean;
  detail: string;
  label: string;
  onSelect: () => void;
  recommended?: boolean;
  value: Path;
}) => (
  <label className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 rounded-lg border border-border p-3.5">
    <input checked={checked} name="add-path" onChange={onSelect} type="radio" value={value} />
    <span className="flex items-center gap-2 font-bold">
      {label}
      {recommended && <Pill tone="primary">Recommended</Pill>}
    </span>
    <span className="col-start-2 text-small text-muted">{detail}</span>
  </label>
);

const PemField = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <Field label={label}>
      <Textarea mono onChange={(event) => onChange(event.target.value)} rows={4} value={value} />
    </Field>
    <input
      accept=".pem,.crt,.cer,.key"
      aria-label={`${label}: choose file`}
      onChange={(event) => void readText(event.target.files?.[0]).then(onChange)}
      type="file"
    />
  </div>
);

const RootField = ({ onChange, value }: { onChange: (value: string) => void; value: string }) => (
  <Advanced label="Advanced: root certificate, if the chain doesn't include it">
    <PemField label="Root certificate (PEM)" onChange={onChange} value={value} />
  </Advanced>
);
