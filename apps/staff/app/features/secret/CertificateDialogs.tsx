import { refusalMessage } from "@sneakers-web/shell";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from "@sneakers-web/ui";
import { useEffect, useId, useRef, useState } from "react";

import type { SecretActionResult } from "@/features/secret/secret.server";

import { EXPORT_FORMATS, exportBlocked } from "@/features/secret/certificate";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

const download = (file: { contentType: string; fileBase64: string; filename: string }) => {
  const bytes = Uint8Array.from(atob(file.fileBase64), (c) => c.codePointAt(0) ?? 0);
  const url = URL.createObjectURL(new Blob([bytes], { type: file.contentType }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file.filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.append(a);
  a.dispatchEvent(new MouseEvent("click"));
  a.remove();
  URL.revokeObjectURL(url);
};

/** A chosen file as base64, the way the gateway takes it. */
const asBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      resolve(String(reader.result).replace(/^data:[^,]*,/, "")),
    );
    reader.addEventListener("error", () =>
      reject(reader.error ?? new Error("couldn't read the file")),
    );
    reader.readAsDataURL(file);
  });

const useClosesOnSuccess = (
  result: SecretActionResult | undefined,
  onDone: (r: Extract<SecretActionResult, { ok: true }>) => void,
) => {
  const handled = useRef<SecretActionResult | undefined>(undefined);
  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result.ok) onDone(result);
  }, [onDone, result]);
};

/** D-08: pick a format; keyed formats need a key on file and, for containers, a passphrase. */
export const ExportDialog = ({
  hasKey,
  onOpenChange,
  open,
}: {
  hasKey: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const fetcher = useSecretFetcher({ quiet: true });
  const [format, setFormat] = useState(EXPORT_FORMATS[0]!.value);
  const [passphrase, setPassphrase] = useState("");
  const chosen = EXPORT_FORMATS.find((f) => f.value === format) ?? EXPORT_FORMATS[0]!;
  const name = useId();
  useClosesOnSuccess(fetcher.data, (r) => {
    if (r.file) download(r.file);
    setPassphrase("");
    onOpenChange(false);
  });
  const refusal = fetcher.data && !fetcher.data.ok ? fetcher.data.refusal : undefined;
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export certificate</DialogTitle>
          <DialogDescription className="sr-only">Choose a format to download.</DialogDescription>
        </DialogHeader>
        <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend className="mb-2 text-[0.875rem] font-bold">Format</legend>
          {EXPORT_FORMATS.map((f) => {
            const disabled = f.key && !hasKey;
            return (
              <label
                className={cn(
                  "grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 rounded-lg border-[1.5px] border-border-strong px-4 py-3",
                  format === f.value && "border-2 border-primary bg-primary-soft",
                  disabled && "cursor-not-allowed opacity-60",
                )}
                key={f.value}
              >
                <input
                  checked={format === f.value}
                  className="row-span-2 size-4 accent-primary"
                  disabled={disabled}
                  name={name}
                  onChange={() => setFormat(f.value)}
                  type="radio"
                  value={f.value}
                />
                <b>{f.label}</b>
                <span className="text-small text-muted">
                  {disabled ? "No private key on file." : f.hint}
                </span>
              </label>
            );
          })}
        </fieldset>
        {chosen.passphrase && (
          <Field
            hint={
              chosen.passphrase === "required"
                ? "The key is re-encrypted with it."
                : "Optional. Without one the key is exported unencrypted."
            }
            label="New passphrase"
            required={chosen.passphrase === "required"}
          >
            <Input
              autoComplete="new-password"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </Field>
        )}
        {refusal && (
          <span className="text-small font-bold text-danger" role="alert">
            {refusalMessage(refusal)}
          </span>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={exportBlocked(chosen, hasKey, passphrase)}
            loading={fetcher.state !== "idle"}
            loadingLabel="Exporting…"
            onClick={() =>
              void fetcher.submit(
                { format, intent: "export", ...(chosen.passphrase ? { passphrase } : {}) },
                { method: "post" },
              )
            }
          >
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** D-09: upload the reissued certificate; it replaces the current one in place. */
export const ReplaceDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const fetcher = useSecretFetcher({ quiet: true });
  const [file, setFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const input = useId();
  useClosesOnSuccess(fetcher.data, () => {
    setFile(null);
    setPassphrase("");
    onOpenChange(false);
  });
  const refusal = fetcher.data && !fetcher.data.ok ? fetcher.data.refusal : undefined;
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Replace certificate</DialogTitle>
          <DialogDescription>
            Upload the new certificate. It replaces the current one in place, keeps the history, and
            anything that reads this secret gets the new one.
          </DialogDescription>
        </DialogHeader>
        <label
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-[1.5px] border-dashed border-control bg-sunken px-6 py-7 text-center"
          htmlFor={input}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const dropped = event.dataTransfer.files[0];
            if (dropped) setFile(dropped);
          }}
        >
          <b>{file ? file.name : "Drop a file or choose one"}</b>
          <span className="text-small text-muted">PKCS#12 / PFX, PEM, DER, PKCS#7 or JKS</span>
          <input
            className="sr-only"
            id={input}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        {file && (
          <Field hint="Only if the file is protected with one." label="File passphrase">
            <Input
              autoComplete="off"
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </Field>
        )}
        {refusal && (
          <span className="text-small font-bold text-danger" role="alert">
            {refusalMessage(refusal)}
          </span>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Cancel
          </Button>
          <Button
            disabled={!file}
            loading={fetcher.state !== "idle"}
            loadingLabel="Replacing…"
            onClick={() => {
              if (!file) return;
              void asBase64(file).then((fileBase64) =>
                fetcher.submit(
                  { fileBase64, intent: "replace", ...(passphrase ? { passphrase } : {}) },
                  { method: "post" },
                ),
              );
            }}
          >
            Replace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
