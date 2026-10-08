import { Field } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import { PasswordInput } from "@/components/PasswordInput";
import { noAutofill } from "@/lib/noAutofill";
import { setup } from "@/lib/osadmin/client";

const CHECK_DELAY_MS = 250;

export interface NewPassword {
  again: string;
  password: string;
}

type Check = { message: string; state: "refused" } | { state: "idle" | "ok" };

/**
 * A new password typed twice, checked by the box as it's typed (SetupService.CheckPassword:
 * 12 or more characters, not breached, not the admin's name). `onValid` hears whether the box
 * takes it and both entries match.
 */
export const NewPasswordFields = ({
  admin,
  label = "Password",
  onChange,
  onValid,
  value,
}: {
  admin: string;
  label?: string;
  onChange: (value: NewPassword) => void;
  onValid: (valid: boolean) => void;
  value: NewPassword;
}) => {
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const { again, password } = value;

  useEffect(() => {
    if (!password) return;
    let current = true;
    const timer = setTimeout(() => {
      setup
        .checkPassword(password, admin)
        .then((response) => {
          if (!current) return;
          setCheck(
            response.ok
              ? { state: "ok" }
              : {
                  message: response.message || "The box won't take this password.",
                  state: "refused",
                },
          );
        })
        .catch(() => current && setCheck({ state: "idle" }));
    }, CHECK_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [admin, password]);

  const checked = password ? check : { state: "idle" as const };
  const mismatch = again.length > 0 && again !== password;
  const valid = checked.state === "ok" && again === password;
  useEffect(() => onValid(valid), [onValid, valid]);

  return (
    <>
      <Field
        error={checked.state === "refused" ? checked.message : undefined}
        hint={
          checked.state === "ok"
            ? "Strong enough."
            : "Use at least 12 characters. Plain words are fine; no symbols needed. Paste from a password manager works."
        }
        label={label}
      >
        <PasswordInput
          {...noAutofill("new-password")}
          onChange={(next) => onChange({ again, password: next })}
          value={password}
        />
      </Field>
      <Field
        error={mismatch ? "The two passwords don't match." : undefined}
        label={`${label} again`}
      >
        <PasswordInput
          {...noAutofill("new-password")}
          label="the password again"
          onChange={(next) => onChange({ again: next, password })}
          value={again}
        />
      </Field>
    </>
  );
};
