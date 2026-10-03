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
  plural,
  Textarea,
} from "@sneakers-web/ui";
import { useState } from "react";

import { DestinationList } from "@/features/browse/DestinationList";
import {
  type Destination,
  findFolder,
  folderDestinations,
  folderLabel,
  moveKind,
  type NavFolder,
  secretDestinations,
  TOP_LEVEL,
} from "@/features/browse/tree";
import { useBrowseAction } from "@/features/browse/useBrowseAction";

/** What is moving: one folder, or secrets picked from the open folder. */
export type MoveSubject =
  | { folder: NavFolder; kind: "folder" }
  | { from: NavFolder; kind: "secrets"; secrets: { id: string; name: string }[] };

type Step = "pick" | "request" | "share";

/**
 * D-05 Move, then D-06 Share on move or D-07 Move-to-personal request when the vault would
 * gate it. The route's action still decides; this only asks the right question first.
 */
export const MoveFlow = ({
  folders,
  isAdmin,
  onClose,
  subject,
}: {
  folders: NavFolder[];
  isAdmin: boolean;
  onClose: () => void;
  subject: MoveSubject;
}) => {
  const [step, setStep] = useState<Step>("pick");
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const { busy, error, submit } = useBrowseAction(onClose);

  const from = subject.kind === "folder" ? subject.folder : subject.from;
  const to = findFolder(folders, destination);
  const toLabel = to ? folderLabel(folders, to) : "the top level";
  const destinations: Destination[] =
    subject.kind === "folder"
      ? folderDestinations(folders, subject.folder)
      : secretDestinations(folders, subject.from);
  const topLevel = subject.kind === "folder" && isAdmin && from.scope !== "personal";
  const name =
    subject.kind === "folder" ? subject.folder.name : plural(subject.secrets.length, "secret");
  const thing = subject.kind === "folder" ? "folder" : "secret";

  const target = destination === TOP_LEVEL ? "" : destination;
  const fields = (): Record<string, string> =>
    subject.kind === "folder"
      ? { dest: target, id: subject.folder.id, name: folderLabel(folders, subject.folder) }
      : { dest: target, secrets: JSON.stringify(subject.secrets) };

  const move = () =>
    submit({ ...fields(), intent: subject.kind === "folder" ? "move-folder" : "move-secrets" });

  const next = () => {
    const kind = moveKind(folders, from, to, isAdmin);
    if (kind === "direct") move();
    else setStep(kind);
  };

  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-w-[31.25rem]" hideClose>
        {step === "pick" && (
          <>
            <DialogHeader>
              <DialogTitle>Move {name}</DialogTitle>
              <DialogDescription>
                Only folders you can manage are listed.
                {subject.kind === "folder" && " It can't go inside itself."}
              </DialogDescription>
            </DialogHeader>
            <DestinationList
              destinations={destinations}
              label="Destination"
              onChange={setDestination}
              topLevel={topLevel}
              value={destination}
            />
          </>
        )}
        {step === "share" && (
          <>
            <DialogHeader>
              <DialogTitle>Share this {thing}?</DialogTitle>
              <DialogDescription>
                Moving <b className="text-ink">{name}</b> from your personal folder into{" "}
                <b className="text-ink">{toLabel}</b> shares it with everyone who can see {toLabel}.
              </DialogDescription>
            </DialogHeader>
            <Alert title={`Once shared, the owner rules of ${toLabel} apply`} tone="warn">
              You can move it back, but that needs a site admin to approve.
            </Alert>
          </>
        )}
        {step === "request" && (
          <>
            <DialogHeader>
              <DialogTitle>Ask to move this to your personal folder</DialogTitle>
              <DialogDescription>
                Moving a shared {thing} into a personal folder hides it from the team. A site admin
                has to approve.
              </DialogDescription>
            </DialogHeader>
            <Field label="Reason" required>
              <Textarea
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                value={reason}
              />
            </Field>
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        <DialogFooter>
          <Button onClick={onClose} variant="secondary">
            Cancel
          </Button>
          {step === "pick" && (
            <Button disabled={!to && destination !== TOP_LEVEL} loading={busy} onClick={next}>
              Move here
            </Button>
          )}
          {step === "share" && (
            <Button loading={busy} onClick={move}>
              Share &amp; move
            </Button>
          )}
          {step === "request" && (
            <Button
              disabled={!reason.trim()}
              loading={busy}
              onClick={() =>
                submit({
                  ...fields(),
                  destName: toLabel,
                  intent: subject.kind === "folder" ? "request-folder-move" : "request-secret-move",
                  reason: reason.trim(),
                })
              }
            >
              Submit request
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
