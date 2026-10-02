import { storageKey } from "@sneakers-web/api-client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@sneakers-web/ui";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

import { useAuth } from "#shell/auth/AuthProvider";
import { EnrollFactor } from "#shell/auth/EnrollFactor";

const SNOOZE = storageKey("mfa-nudge-snoozed");

/**
 * The nudge for an account with no second factor (when MFA is optional). "Remind me later"
 * hides it until the next sign-in; "Set up now" enrols without leaving the page.
 */
export const MfaBanner = () => {
  const { markEnrolled, mfaSetupRecommended } = useAuth();
  const [snoozed, setSnoozed] = useState(() => sessionStorage.getItem(SNOOZE) === "1");
  const [open, setOpen] = useState(false);
  if (!mfaSetupRecommended || snoozed) return null;
  return (
    <>
      <div
        aria-label="Account security"
        className="flex flex-none flex-wrap items-center gap-3.5 border-b-[1.5px] border-warn bg-warn-soft px-5 py-3"
        role="region"
      >
        <TriangleAlert aria-hidden className="size-4 text-warn" strokeWidth={2.5} />
        <span className="text-body leading-[1.4]">
          <b>Add a second factor to your account.</b> Without one, anyone with your password can
          sign in as you.
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button onClick={() => setOpen(true)} size="sm" variant="ink">
            Set up now
          </Button>
          <Button
            className="text-ink hover:bg-transparent hover:underline"
            onClick={() => {
              sessionStorage.setItem(SNOOZE, "1");
              setSnoozed(true);
            }}
            size="sm"
            variant="ghost"
          >
            Remind me later
          </Button>
        </div>
      </div>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Protect your account</DialogTitle>
            <DialogDescription>
              Add a second factor so a stolen password isn't enough to get in.
            </DialogDescription>
          </DialogHeader>
          <EnrollFactor
            onDone={() => {
              setOpen(false);
              markEnrolled();
            }}
            secondary={
              <Button onClick={() => setOpen(false)} variant="link">
                Skip for now
              </Button>
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
