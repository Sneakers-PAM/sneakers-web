import { Switch } from "@sneakers-web/ui";
import { type ReactNode, useId } from "react";

import type { SecretPage } from "@/features/secret/secret.server";

import { Panel } from "@/features/secret/Panel";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

const Setting = ({
  body,
  checked,
  disabled,
  onChange,
  title,
}: {
  body: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (on: boolean) => void;
  title: string;
}) => {
  const id = useId();
  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b id={id}>{title}</b>
        <span className="text-small text-muted">{body}</span>
      </div>
      <Switch
        aria-labelledby={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
      />
    </div>
  );
};

/** Per-secret rotation and heartbeat switches (audited overrides of the type's defaults). */
export const AutomationCard = ({ page }: { page: SecretPage }) => {
  const { access, secret, target, type } = page;
  const fetcher = useSecretFetcher();
  const pending = fetcher.formData;
  const rotationOff = pending ? pending.get("disableRotation") === "true" : !!secret.rotationOptOut;
  const heartbeatOff = pending
    ? pending.get("disableHeartbeat") === "true"
    : !!secret.heartbeatOptOut;
  const locked = secret.retired || !(access.manage || page.isAdmin);
  const save = (disableRotation: boolean, disableHeartbeat: boolean) =>
    void fetcher.submit(
      {
        disableHeartbeat: String(disableHeartbeat),
        disableRotation: String(disableRotation),
        intent: "automation",
      },
      { method: "post" },
    );
  return (
    <Panel title="Automation">
      <div className="flex flex-col gap-4 px-6 py-5">
        <Setting
          body={
            type?.rotation
              ? `Every ${secret.rotationIntervalDays ?? 30} days, from the policy`
              : "This type can't rotate."
          }
          checked={!!type?.rotation && !rotationOff}
          disabled={locked || !type?.rotation}
          onChange={(on) => save(!on, heartbeatOff)}
          title="Automatic rotation"
        />
        {type?.heartbeat && (
          <Setting
            body={
              target
                ? `Checks the login on ${target.name} hourly`
                : "Needs a target to check against."
            }
            checked={!heartbeatOff}
            disabled={locked}
            onChange={(on) => save(rotationOff, !on)}
            title="Heartbeat validation"
          />
        )}
      </div>
    </Panel>
  );
};

/** Whether a personal token's reveal needs the owner's approval each time. */
export const AgentAccessCard = ({ page }: { page: SecretPage }) => {
  const fetcher = useSecretFetcher();
  const pending = fetcher.formData;
  const required = pending
    ? pending.get("required") === "true"
    : !!page.secret.requireTokenApproval;
  return (
    <Panel title="Agent access">
      <div className="flex flex-col gap-3 px-6 py-5">
        <Setting
          body=""
          checked={required}
          disabled={page.secret.retired}
          onChange={(on) =>
            void fetcher.submit(
              { intent: "token-approval", required: String(on) },
              { method: "post" },
            )
          }
          title="Require my approval for agent (token) reveals"
        />
        <p className="m-0 text-small text-muted">
          Agents using your token can still ask to use this secret in a command. You approve each
          one in Approvals.
        </p>
      </div>
    </Panel>
  );
};
