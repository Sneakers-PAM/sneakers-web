import {
  Button,
  clockTime,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  shortDate,
} from "@sneakers-web/ui";

import type { Invitation } from "@/lib/osadmin/types";

/** The one-time invitation code, shown once, with where the new admin types it. */
export const InvitationDialog = ({
  invitation,
  onDone,
}: {
  invitation: Invitation;
  onDone: () => void;
}) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Invitation for {invitation.admin}</DialogTitle>
      <DialogDescription>
        This code is shown once. Give it to {invitation.admin}: they type it on this box&apos;s
        setup page ({globalThis.location?.origin ?? ""}/setup) to set a password and an
        authenticator.
      </DialogDescription>
    </DialogHeader>
    <output
      aria-label={`Invitation code for ${invitation.admin}`}
      className="block rounded-md border-[1.5px] border-control bg-sunken py-4 text-center font-mono text-[1.75rem] font-bold tracking-[0.2em]"
    >
      {invitation.code}
    </output>
    {invitation.expires && (
      <p className="m-0 text-small text-muted">
        It works once, until {shortDate(invitation.expires)} {clockTime(invitation.expires)}.
      </p>
    )}
    <DialogFooter>
      <Button onClick={onDone}>Done</Button>
    </DialogFooter>
  </DialogContent>
);
