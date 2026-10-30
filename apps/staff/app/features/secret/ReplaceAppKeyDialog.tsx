import { refusalMessage } from "@sneakers-web/shell";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";

import { AppKeyInput } from "@/features/editors/AppKeyInput";
import { parseAppKey } from "@/features/editors/githubAppKey";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

// The dialog's content unmounts when it closes, so the key never outlives the dialog.
const Body = ({ onClose }: { onClose: () => void }) => {
  const fetcher = useSecretFetcher({ quiet: true });
  const [key, setKey] = useState("");
  const handled = useRef<unknown>(null);
  const result = fetcher.data;
  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (result.ok) onClose();
  }, [onClose, result]);
  const refusal = result && !result.ok ? result.refusal : undefined;
  const ready = !!key.trim() && parseAppKey(key).ok;
  return (
    <>
      <AppKeyInput editing={false} label="New private key" onChange={setKey} value={key} />
      {refusal && (
        <span className="text-small font-bold text-danger" role="alert">
          {refusalMessage(refusal)}
        </span>
      )}
      <DialogFooter>
        <Button onClick={onClose} variant="secondary">
          Cancel
        </Button>
        <Button
          disabled={!ready}
          loading={fetcher.state !== "idle"}
          loadingLabel="Replacing…"
          onClick={() =>
            void fetcher.submit({ intent: "replace-app-key", privateKey: key }, { method: "post" })
          }
        >
          Replace key
        </Button>
      </DialogFooter>
    </>
  );
};

/** Replace a GitHub App's private key with a new .pem; the old one stays in the history. */
export const ReplaceAppKeyDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Replace private key</DialogTitle>
        <DialogDescription>
          Generate a new key in the App&apos;s settings on GitHub and add the .pem here. The old key
          stays in this secret&apos;s history; delete it on GitHub once nothing uses it.
        </DialogDescription>
      </DialogHeader>
      <Body onClose={() => onOpenChange(false)} />
    </DialogContent>
  </Dialog>
);
