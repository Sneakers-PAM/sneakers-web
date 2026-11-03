import { Button, Card, CardHeader, Field, Input, Segmented } from "@sneakers-web/ui";
import { useState } from "react";

import type { AccessPolicy, LockoutMode } from "@/lib/osadmin/types";

import { noAutofill } from "@/lib/noAutofill";
import { runAction } from "@/lib/osadmin/action";
import { access } from "@/lib/osadmin/client";

const DEFAULTS: AccessPolicy = {
  lockoutMaxFailures: 0,
  lockoutMode: "LOCKOUT_MODE_TIMED",
  rootCodeMinutes: 10,
  rootSessionMinutes: 10,
  sshKeyValidDays: 365,
};

/** The lockout limits the box takes; 0 on the wire means its default, the last of them. */
const LOCKOUT_LIMITS = ["3", "4", "5"] as const;
type LockoutLimit = (typeof LOCKOUT_LIMITS)[number];
const DEFAULT_LOCKOUT_LIMIT: LockoutLimit = "5";

const limitOf = (failures: number): LockoutLimit =>
  LOCKOUT_LIMITS.find((limit) => Number(limit) === failures) ?? DEFAULT_LOCKOUT_LIMIT;

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
  const [maxFailures, setMaxFailures] = useState<LockoutLimit>(limitOf(start.lockoutMaxFailures));
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
                lockoutMaxFailures: Number(maxFailures),
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
            After {maxFailures} wrong tries in 15 minutes, lock the account
          </span>
          <div className="flex flex-wrap gap-3">
            <Segmented
              label="Wrong tries before a lockout"
              onChange={setMaxFailures}
              options={LOCKOUT_LIMITS.map((limit) => ({ label: limit, value: limit }))}
              value={maxFailures}
            />
            <Segmented
              label="Lockout"
              onChange={setLockoutMode}
              options={[
                { label: "For 15 minutes", value: "LOCKOUT_MODE_TIMED" },
                { label: "Until it's unlocked", value: "LOCKOUT_MODE_UNTIL_UNLOCKED" },
              ]}
              value={lockoutMode}
            />
          </div>
          <span className="text-small text-muted">
            5 by default. A wrong password and a wrong code count toward the same limit, and a lower
            limit counts from the next wrong try, so it locks no one by itself. The same rule covers
            SSH, this page, step-ups and the one-time codes. An owner unlocks an account on this
            page. If no other owner can, use Recover access on the console.
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3">
          <Field hint="1 to 60" label="Root-shell code lifetime (minutes)">
            <Input
              {...noAutofill()}
              inputMode="numeric"
              onChange={(event) => setCodeMinutes(event.target.value)}
              value={codeMinutes}
            />
          </Field>
          <Field hint="1 to 60" label="Root-shell session limit (minutes)">
            <Input
              {...noAutofill()}
              inputMode="numeric"
              onChange={(event) => setSessionMinutes(event.target.value)}
              value={sessionMinutes}
            />
          </Field>
          <Field hint="1 to 1825" label="SSH key validity (days)">
            <Input
              {...noAutofill()}
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
