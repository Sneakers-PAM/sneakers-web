import type { TotpEnrollment } from "@sneakers-web/api-client";

import { groupKey } from "@sneakers-web/shell";
import {
  Button,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  QrBlock,
} from "@sneakers-web/ui";
import { X } from "lucide-react";
import { useState } from "react";

/**
 * D-21: add an authenticator app without leaving the page. `wrong` is the server's last
 * answer to a code; the mark stays until the person edits the code.
 */
export const SetupAuthenticatorDialog = ({
  busy,
  enrollment,
  onConfirm,
  onOpenChange,
  wrong,
}: {
  busy: boolean;
  enrollment: null | TotpEnrollment;
  onConfirm: (code: string) => void;
  onOpenChange: (open: boolean) => void;
  wrong: object | undefined;
}) => {
  const [typed, setTyped] = useState<{ code: string; for: object | undefined }>({
    code: "",
    for: undefined,
  });
  const marked = !!wrong && typed.for !== wrong;
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setTyped({ code: "", for: undefined });
        onOpenChange(open);
      }}
      open={enrollment !== null}
    >
      <DialogContent>
        {enrollment && (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              if (typed.code.length === 6) onConfirm(typed.code);
            }}
          >
            <DialogHeader>
              <DialogTitle>Set up a second factor</DialogTitle>
              <DialogDescription>
                Scan the code with your authenticator app, then enter the 6 digits.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-start gap-4 tablet:flex-row tablet:items-center">
              <QrBlock label="Authenticator setup code" size={148} value={enrollment.otpauthUri} />
              <div className="flex min-w-0 flex-col gap-2">
                <span className="text-small text-muted">Can&apos;t scan? Enter this key:</span>
                <span className="rounded-sm bg-sunken px-2.5 py-2 font-mono text-[0.875rem] leading-normal font-medium break-all">
                  {groupKey(enrollment.secret)}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <CodeInput
                aria-describedby={marked ? "setup-wrong" : undefined}
                invalid={marked}
                onChange={(code) => setTyped({ code, for: wrong })}
                onComplete={onConfirm}
                size="md"
                value={typed.code}
              />
              {marked && (
                <span className="text-small font-bold text-danger" id="setup-wrong" role="alert">
                  <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
                  That code didn&apos;t match. Check the time on your phone.
                </span>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)} variant="secondary">
                Later
              </Button>
              <Button
                disabled={typed.code.length !== 6}
                loading={busy}
                loadingLabel="Confirming…"
                type="submit"
              >
                Confirm
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
