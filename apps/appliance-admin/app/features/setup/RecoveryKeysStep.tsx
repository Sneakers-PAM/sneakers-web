import { Button, Field, Input } from "@sneakers-web/ui";
import { useState } from "react";

import type { GetSetupResponse } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { setup } from "@/lib/osadmin/client";

/** Saves the newest escrow file the box wrote for the recovery keys. */
export const downloadEscrow = () =>
  void runAction(async () => {
    const response = await setup.downloadEscrow();
    const bytes = Uint8Array.from(atob(response.content), (c) => c.codePointAt(0) ?? 0);
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = response.fileName;
    a.click();
    URL.revokeObjectURL(url);
  });

/** Step 3: at least one recovery key (an SSH public key kept offline), and the escrow. */
export const RecoveryKeysStep = ({
  data,
  onChanged,
}: {
  data: GetSetupResponse;
  onChanged: () => void;
}) => {
  const [publicKey, setPublicKey] = useState("");
  const [label, setLabel] = useState("");
  const keys = data.recoveryKeys ?? [];
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-body">
        A recovery key is an SSH key you keep offline. Any one of them opens your backups if this
        box is lost. Add at least one. A second one, held by someone else, is safer (up to{" "}
        {data.maxRecoveryKeys}).
      </p>
      {keys.length > 0 && (
        <ul aria-label="Recovery keys" className="m-0 flex list-none flex-col gap-2 p-0">
          {keys.map((key) => (
            <li
              className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
              key={key.fingerprint}
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-bold">{key.label || key.type}</span>
                <span className="truncate font-mono text-small text-muted">
                  {key.type} {key.fingerprint}
                </span>
              </div>
              {keys.length > 1 && (
                <Button
                  onClick={() =>
                    void runAction(() => setup.removeRecoveryKey(key.fingerprint), {
                      onSuccess: onChanged,
                    })
                  }
                  size="sm"
                  variant="secondary"
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {keys.length < data.maxRecoveryKeys && (
        <form
          aria-label="Add a recovery key"
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(() => setup.addRecoveryKey(publicKey.trim(), label.trim()), {
              onSuccess: () => {
                setPublicKey("");
                setLabel("");
                onChanged();
              },
            });
          }}
        >
          <Field hint="ssh-ed25519, or ssh-rsa of 3072 bits or more" label="Public key">
            <Input
              mono
              onChange={(event) => setPublicKey(event.target.value)}
              placeholder="ssh-ed25519 AAAA..."
              spellCheck={false}
              value={publicKey}
            />
          </Field>
          <Field label="Label">
            <Input onChange={(event) => setLabel(event.target.value)} value={label} />
          </Field>
          <Button
            className="self-start"
            disabled={!publicKey.trim()}
            type="submit"
            variant="secondary"
          >
            Add
          </Button>
        </form>
      )}
      {data.escrowFile && (
        <Button className="self-start" onClick={downloadEscrow} variant="secondary">
          Download the recovery bundle {data.escrowFile}
        </Button>
      )}
      <p className="m-0 text-small text-muted">
        Keep the private keys off this box. Without one of them, the backups can&apos;t be read.
      </p>
    </div>
  );
};
