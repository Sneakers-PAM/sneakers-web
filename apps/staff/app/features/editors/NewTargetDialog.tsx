import { refusalMessage } from "@sneakers-web/shell";
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
} from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

import type { Connection, EditorActionResult, Target } from "@/features/editors/editors.server";

import { PickOne } from "@/features/editors/PickOne";

const connectionLabel = (c: Connection) =>
  [c.name, c.protocol, c.port ? String(c.port) : null].filter(Boolean).join(" · ");

/** D-12: make a personal target without leaving the form, then pick it. */
export const NewTargetDialog = ({
  connections,
  onClose,
  onCreated,
  open,
}: {
  connections: Connection[];
  onClose: () => void;
  onCreated: (target: Target) => void;
  open: boolean;
}) => {
  const fetcher = useFetcher<EditorActionResult>({ key: "editor-new-target" });
  const [name, setName] = useState("");
  const [hostname, setHostname] = useState("");
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [tried, setTried] = useState(false);
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (result?.ok && result.intent === "create-target" && handled.current !== result) {
      handled.current = result;
      onCreated(result.target);
      setName("");
      setHostname("");
      setTried(false);
    }
  }, [result, onCreated]);

  const create = () => {
    setTried(true);
    if (!name.trim() || !hostname.trim() || !connectionId) return;
    void fetcher.submit(
      { connectionId, hostname, intent: "create-target", name },
      { method: "post" },
    );
  };

  const refusal = result && !result.ok ? result.refusal : undefined;
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open={open}>
      <DialogContent className="max-w-[31.25rem]" hideClose>
        <DialogHeader>
          <DialogTitle>New target</DialogTitle>
          <DialogDescription>
            Make a personal target for this secret. Admins manage shared ones.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field
            error={tried && !name.trim() ? "Give the target a name." : undefined}
            label="Name"
            required
          >
            <Input onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          <Field
            error={tried && !hostname.trim() ? "Enter the hostname." : undefined}
            label="Hostname"
            required
          >
            <Input mono onChange={(event) => setHostname(event.target.value)} value={hostname} />
          </Field>
          <Field label="Connection">
            {/* The kit's dropdown layer sits under dialogs; lift it above this one. */}
            <PickOne
              contentClassName="z-[calc(var(--z-dialog)+1)]"
              onChange={setConnectionId}
              options={connections.map((c) => ({ label: connectionLabel(c), value: c.id }))}
              placeholder="Pick a connection"
              value={connectionId}
            />
          </Field>
          {refusal && <Alert tone="danger">{refusalMessage(refusal)}</Alert>}
        </div>
        <DialogFooter>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          <Button loading={fetcher.state !== "idle"} onClick={create}>
            Create target
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
