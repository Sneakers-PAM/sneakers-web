import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  EmptyState,
  Input,
  Label,
  PageHeader,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetImportResponse, ImportRun } from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { downloadEscrow, ESCROW_NOTE } from "@/features/setup/RecoveryKeysStep";
import { runAction } from "@/lib/osadmin/action";
import { importer } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";
import { useInstalledProduct } from "@/lib/useInstalledProduct";

/** How often the page reads the box again while a step runs. */
export const IMPORT_POLL_MS = 2000;

const FILE_KINDS: { accept: string; hint: string; kind: string; label: string }[] = [
  {
    accept: ".age",
    hint: "the export, encrypted to this box's import key",
    kind: "bundle",
    label: "Export bundle",
  },
  {
    accept: ".json",
    hint: "the approved mapping file (or convert a sheet below)",
    kind: "mapping",
    label: "Mapping file",
  },
  {
    accept: ".tsv,.txt",
    hint: "a proposal sheet, one row per secret",
    kind: "sheet",
    label: "Proposal sheet",
  },
  {
    accept: ".json",
    hint: "the field mappings of the sheet's type changes",
    kind: "types",
    label: "Type rules",
  },
];

const STEP_LABELS: Record<string, string> = {
  check: "Check mapping",
  convert: "Convert sheet",
  import: "Import",
  review: "Review",
  verify: "Verify",
};

const download = (name: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

/** The installed product's Import page: an earlier install's export comes in before setup. */
export default function Import() {
  const { loaded, product } = useInstalledProduct();
  const [data, setData] = useState<GetImportResponse>();
  const [unavailable, setUnavailable] = useState(false);
  const [rehearsal, setRehearsal] = useState(true);
  const [wipe, setWipe] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [parent, setParent] = useState("");
  const [personal, setPersonal] = useState("");
  const [shown, setShown] = useState<{ job: string; password: string }>();
  const reload = () =>
    void importer
      .get()
      .then(setData)
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(() => {
    if (product) reload();
  }, [product]);
  const running = data?.runs.some((r) => r.state === "running") ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, IMPORT_POLL_MS);
    return () => clearInterval(timer);
  }, [running]);

  if (!loaded) return null;
  if (!product) {
    return (
      <div className="p-5.5">
        <EmptyState
          body="This page belongs to a product, and no product is installed on this box."
          loader={false}
          title="Nothing here"
        />
      </div>
    );
  }
  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Import" />
      </div>
    );
  }
  if (!data) return null;

  const has = (kind: string) => data.files.find((f) => f.kind === kind);
  const run = (step: string) =>
    void runAction(
      () =>
        importer.run({
          newFolderParent: step === "convert" ? parent : undefined,
          ownerEmail: step === "import" ? ownerEmail : undefined,
          personal: step === "convert" ? personal : undefined,
          rehearsal: step === "import" ? rehearsal : undefined,
          step,
          wipe: step === "import" ? wipe : undefined,
        }),
      { onSuccess: reload },
    );

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow={product.name} title="Import" />
      {data.imported && (
        <Alert title="Imported-users mode" tone="ok">
          <span>
            {`This box's users and data came from an import (bundle ${data.importedBundle}). ${product.name}'s own first-run setup is skipped: each user sets a new password with "Forgot password" and enrols a second factor at first sign-in. `}
            {ESCROW_NOTE}
          </span>
          <Button className="mt-3 self-start" onClick={downloadEscrow} variant="secondary">
            Download the escrow
          </Button>
        </Alert>
      )}
      {!data.available && (
        <EmptyState
          body={data.reason || "This product takes no import."}
          loader={false}
          title="No import"
        />
      )}
      {data.available && data.setupDone && (
        <Alert title="Setup is done" tone="warn">
          {data.reason}
        </Alert>
      )}
      {data.available && !data.open && !data.setupDone && (
        <Card>
          <CardHeader
            subtitle="Bring an earlier install's users, secrets and audit chain in before this product's own setup. Opening needs a fresh code."
            title={data.label || "Import"}
          />
          <div className="flex flex-col gap-4 p-5.5">
            <p className="m-0 text-small">
              Opening makes the import key on this box. The export is encrypted to it, and it never
              leaves the box; closing the import removes it with the export.
            </p>
            <div>
              <Button onClick={() => void runAction(() => importer.open(), { onSuccess: reload })}>
                Open an import
              </Button>
            </div>
          </div>
        </Card>
      )}
      {data.open && (
        <>
          <Card>
            <CardHeader subtitle="Export to this key, on the earlier install." title="Import key" />
            <div className="flex flex-col gap-3 p-5.5">
              <code className="break-all text-small" data-testid="import-recipient">
                {data.recipient}
              </code>
              <pre className="m-0 overflow-x-auto text-small">{`sneakers-migrate export --current-only --reset-sign-in \\\n  --recipient ${data.recipient} --out bundle.age`}</pre>
            </div>
          </Card>
          <Card>
            <CardHeader
              subtitle="Each upload replaces the earlier file of its kind."
              title="Files"
            />
            <div className="flex flex-col gap-4 p-5.5">
              {FILE_KINDS.map((f) => {
                const present = has(f.kind);
                return (
                  <div className="flex flex-wrap items-center gap-3" key={f.kind}>
                    <Label className="flex min-w-48 flex-col gap-1">
                      {f.label}
                      <input
                        accept={f.accept}
                        aria-label={f.label}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file)
                            void runAction(() => importer.upload(f.kind, file), {
                              onSuccess: reload,
                              successMessage: `${f.label} uploaded.`,
                            });
                        }}
                        type="file"
                      />
                    </Label>
                    <span className="text-small">
                      {present
                        ? `${String(present.size)} bytes, ${present.uploadedAt}`
                        : `none yet: ${f.hint}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
          <Card>
            <CardHeader
              subtitle="Each step runs sneakers-migrate on the box and keeps its output here. One step at a time; each needs a fresh code."
              title="Steps"
            />
            <div className="flex flex-col gap-4 p-5.5">
              <div className="flex flex-wrap gap-3">
                <Button
                  disabled={running || !has("bundle")}
                  onClick={() => run("review")}
                  variant="secondary"
                >
                  Review
                </Button>
                <Button
                  disabled={running || !has("mapping")}
                  onClick={() => run("check")}
                  variant="secondary"
                >
                  Check mapping
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Label className="flex flex-col gap-1">
                  New folders under
                  <Input
                    onChange={(event) => setParent(event.target.value)}
                    placeholder="Infrastructure"
                    value={parent}
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  The sheet&apos;s Personal rows belong to
                  <Input
                    onChange={(event) => setPersonal(event.target.value)}
                    placeholder="user@example.org"
                    value={personal}
                  />
                </Label>
                <Button
                  disabled={running || !has("sheet")}
                  onClick={() => run("convert")}
                  variant="secondary"
                >
                  Convert sheet
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <Label className="flex items-center gap-2">
                  <Checkbox checked={rehearsal} onCheckedChange={(v) => setRehearsal(v === true)} />
                  Rehearsal
                </Label>
                <Label className="flex items-center gap-2">
                  <Checkbox checked={wipe} onCheckedChange={(v) => setWipe(v === true)} />
                  Re-import (empty the box first)
                </Label>
                <Label className="flex flex-col gap-1">
                  First admin&apos;s email
                  <Input
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="admin@example.org"
                    value={ownerEmail}
                  />
                </Label>
                <Button disabled={running || !has("bundle")} onClick={() => run("import")}>
                  Import
                </Button>
                <Button
                  disabled={running || !has("bundle")}
                  onClick={() => run("verify")}
                  variant="secondary"
                >
                  Verify
                </Button>
              </div>
              <p className="m-0 text-small">
                There is no rollback: if something is wrong, fix it and import again with Re-import.
                The box restarts the vault after an import that passes.
              </p>
            </div>
          </Card>
          {shown && (
            <Alert title={`The first admin's one-time password (${shown.job})`} tone="warn">
              <span>
                Shown once, and not kept on the box. Sign in with it, change it and enrol a second
                factor:{" "}
              </span>
              <code data-testid="owner-password">{shown.password}</code>
            </Alert>
          )}
          {data.runs.toReversed().map((r) => (
            <RunCard
              key={r.job}
              onShowPassword={() =>
                void runAction(() => importer.takeOwnerPassword(r.job), {
                  onSuccess: (out) => {
                    setShown({ job: r.job, password: out.password ?? "" });
                    reload();
                  },
                })
              }
              run={r}
            />
          ))}
          <Card>
            <CardHeader
              subtitle="Removes the export, the import key and the outputs from the box, and the migrate service account with them."
              title="Close the import"
            />
            <div className="flex flex-col gap-4 p-5.5">
              <p className="m-0 text-small">
                After Verify passes, download the escrow and keep it with the recovery keys.{" "}
                {ESCROW_NOTE}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={downloadEscrow} variant="secondary">
                  Download the escrow
                </Button>
                <Button
                  disabled={running}
                  onClick={() =>
                    void runAction(() => importer.close(), {
                      onSuccess: () => {
                        setShown(undefined);
                        reload();
                      },
                    })
                  }
                  variant="danger"
                >
                  Close the import
                </Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

const RunCard = ({ onShowPassword, run }: { onShowPassword: () => void; run: ImportRun }) => {
  const tone = run.state === "passed" ? "ok" : run.state === "failed" ? "warn" : "neutral";
  const word =
    run.state === "running"
      ? "Running"
      : run.state === "passed"
        ? "Passed"
        : `Failed (exit ${String(run.exitCode)})`;
  const flags = [
    run.rehearsal && "rehearsal",
    run.wipe && "re-import",
    run.ownerEmail && `first admin ${run.ownerEmail}`,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <Card>
      <CardHeader
        aside={<Badge tone={tone}>{word}</Badge>}
        subtitle={`${run.job} started ${run.startedAt}${flags ? ` (${flags})` : ""}`}
        title={STEP_LABELS[run.step] ?? run.step}
      />
      <div className="flex flex-col gap-3 p-5.5">
        <pre className="m-0 max-h-96 overflow-auto text-small">
          {run.output || "No output yet."}
        </pre>
        <div className="flex flex-wrap gap-3">
          {run.template && (
            <Button
              onClick={() => download(`${run.job}.mapping.json`, run.template)}
              variant="secondary"
            >
              Download the mapping template
            </Button>
          )}
          {run.report && (
            <Button
              onClick={() => download(`${run.job}.report.json`, run.report)}
              variant="secondary"
            >
              Download the report
            </Button>
          )}
          {run.ownerPasswordWaiting && (
            <Button onClick={onShowPassword}>Show the one-time password</Button>
          )}
        </div>
      </div>
    </Card>
  );
};
