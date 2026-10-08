import { Button, Card, CardHeader, Field, Input, Segmented } from "@sneakers-web/ui";
import { useState } from "react";

import type { AccessPolicy, LockoutMode } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { access } from "@/lib/osadmin/client";

const DEFAULTS: AccessPolicy = {
  lockoutMode: "LOCKOUT_MODE_TIMED",
  rootCodeMinutes: 10,
  rootSessionMinutes: 10,
  sshKeyValidDays: 365,
};

/** Owners only: the lockout, the root-shell code and session lifetimes, the SSH key validity. */
export const AccessSettingsCard = ({
  onSaved,
  policy,
}: {
  onSaved: () => void;
  policy?: AccessPolicy;
}) => {
  const start = { ...DEFAULTS, ...policy };
  const [lockoutMode, setLockoutMode] = useState<LockoutMode>(
    start.lockoutMode === "LOCKOUT_MODE_UNTIL_UNLOCKED" ? start.lockoutMode : "LOCKOUT_MODE_TIMED",
  );
  const [codeMinutes, setCodeMinutes] = useState(String(start.rootCodeMinutes || 10));
  const [sessionMinutes, setSessionMinutes] = useState(String(start.rootSessionMinutes || 10));
  const [validDays, setValidDays] = useState(String(start.sshKeyValidDays || 365));
  return (
    <Card>
      <CardHeader title="Access settings" />
      <form
        aria-label="Access settings"
        className="flex flex-col gap-4 p-5.5"
        onSubmit={(event) => {
          event.preventDefault();
          void runAction(
            () =>
              access.setAccessPolicy({
                lockoutMode,
                rootCodeMinutes: Number(codeMinutes),
                rootSessionMinutes: Number(sessionMinutes),
                sshKeyValidDays: Number(validDays),
              }),
            { onSuccess: onSaved, successMessage: "Access settings saved." },
          );
        }}
      >
        <div className="flex flex-col gap-2">
          <span className="text-[0.875rem] font-bold text-ink">
            After 3 wrong tries in 15 minutes, lock the account
          </span>
          <Segmented
            label="Lockout"
            onChange={setLockoutMode}
            options={[
              { label: "For 15 minutes", value: "LOCKOUT_MODE_TIMED" },
              { label: "Until an owner unlocks it", value: "LOCKOUT_MODE_UNTIL_UNLOCKED" },
            ]}
            value={lockoutMode}
          />
          <span className="text-small text-muted">
            The same rule covers SSH, this page, step-ups and the one-time codes.
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          <Field hint="1 to 60" label="Root-shell code lifetime (minutes)">
            <Input
              inputMode="numeric"
              onChange={(event) => setCodeMinutes(event.target.value)}
              value={codeMinutes}
            />
          </Field>
          <Field hint="1 to 60" label="Root-shell session limit (minutes)">
            <Input
              inputMode="numeric"
              onChange={(event) => setSessionMinutes(event.target.value)}
              value={sessionMinutes}
            />
          </Field>
          <Field hint="1 to 1825" label="SSH key validity (days)">
            <Input
              inputMode="numeric"
              onChange={(event) => setValidDays(event.target.value)}
              value={validDays}
            />
          </Field>
        </div>
        <div>
          <Button type="submit">Save access settings</Button>
        </div>
      </form>
    </Card>
  );
};
