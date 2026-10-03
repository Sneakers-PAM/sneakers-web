import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Segmented,
  Textarea,
} from "@sneakers-web/ui";
import { type ChangeEvent, useState } from "react";

import { armor, keyPairMatch, parsePrivateKey, parsePublicKey } from "@/features/editors/sshKey";

export interface ImportedKey {
  passphrase: string;
  privateKey: string;
  publicKey: string;
}

interface Errors {
  passphrase?: string;
  privateKey?: string;
  publicKey?: string;
}

const check = (k: ImportedKey): Errors => {
  const out: Errors = {};
  const priv = parsePrivateKey(k.privateKey);
  if (!k.privateKey.trim()) out.privateKey = "Paste or upload the private key.";
  else if (!priv) out.privateKey = "That isn't an SSH private key.";
  if (priv?.encrypted && !k.passphrase)
    out.passphrase = "This key is encrypted. Enter its passphrase.";
  if (k.publicKey.trim()) {
    if (!parsePublicKey(k.publicKey)) out.publicKey = "That isn't an SSH public key.";
    else if (keyPairMatch(k.privateKey, k.publicKey) === "mismatch")
      out.publicKey = "Doesn't match the private key.";
  }
  return out;
};

const readText = (set: (value: string) => void) => (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (file) void file.text().then(set);
};

/** D-10: bring an existing key pair instead of generating one, checked before it's taken. */
export const ImportKeyDialog = ({
  onClose,
  onImport,
  open,
}: {
  onClose: () => void;
  onImport: (key: ImportedKey) => void;
  open: boolean;
}) => {
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [privateKey, setPrivateKey] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const close = () => {
    setPrivateKey("");
    setPassphrase("");
    setPublicKey("");
    setErrors({});
    onClose();
  };

  const submit = () => {
    const key = { passphrase, privateKey: privateKey.trim(), publicKey: publicKey.trim() };
    const found = check(key);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onImport(key);
    close();
  };

  return (
    <Dialog onOpenChange={(o) => !o && close()} open={open}>
      <DialogContent className="max-w-[38.75rem]" hideClose>
        <DialogHeader>
          <DialogTitle>Import SSH key</DialogTitle>
          <DialogDescription>
            Paste or upload. The private key is required; the public key is optional and checked
            against it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Segmented
            className="w-64 self-start"
            label="How to bring the key"
            onChange={setMode}
            options={[
              { label: "Paste", value: "paste" },
              { label: "Upload file", value: "upload" },
            ]}
            size="sm"
            value={mode}
          />
          {mode === "upload" && (
            <Field hint="A .pem, .key or OpenSSH key file." label="Private key file">
              <Input className="py-2" onChange={readText(setPrivateKey)} type="file" />
            </Field>
          )}
          <Field error={errors.privateKey} label="Private key">
            <Textarea
              autoComplete="off"
              className="max-h-48"
              mono
              onChange={(event) => setPrivateKey(event.target.value)}
              placeholder={armor("BEGIN", "OPENSSH PRIVATE KEY")}
              rows={4}
              spellCheck={false}
              value={privateKey}
            />
          </Field>
          <Field error={errors.passphrase} label="Passphrase">
            <Input
              autoComplete="new-password"
              mono
              onChange={(event) => setPassphrase(event.target.value)}
              type="password"
              value={passphrase}
            />
          </Field>
          {mode === "upload" && (
            <Field label="Public key file">
              <Input className="py-2" onChange={readText(setPublicKey)} type="file" />
            </Field>
          )}
          <Field
            error={errors.publicKey}
            label={
              <>
                Public key <span className="font-normal text-muted">(optional)</span>
              </>
            }
          >
            <Input
              autoComplete="off"
              mono
              onChange={(event) => setPublicKey(event.target.value)}
              placeholder="ssh-ed25519 AAAA… user@host"
              spellCheck={false}
              value={publicKey}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button onClick={close} variant="secondary">
            Cancel
          </Button>
          <Button onClick={submit}>Import</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
