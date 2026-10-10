import { Segmented, Switch } from "@sneakers-web/ui";
import { type ReactNode, useId } from "react";

import type { SecretPage } from "@/features/secret/secret.server";

import { Panel } from "@/features/secret/Panel";
import { notRotating } from "@/features/secret/rotation";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

/** Shown under a settings card the viewer can see but not change: the vault's own reason, not ours. */
const MANAGE_HINT = "Only the secret's owners or authors can change this.";

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
        <span className="text-small text-muted" id={`${id}-body`}>
          {body}
        </span>
      </div>
      <Switch
        aria-describedby={`${id}-body`}
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
  const canManage = access.manage;
  const locked = secret.retired || !canManage;
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
              ? rotationOff || !notRotating(page)
                ? `Every ${secret.rotationIntervalDays ?? 30} days, from the policy`
                : "Not rotating: it needs a target with a connection."
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
        {!secret.retired && !canManage && (
          <p className="m-0 text-small text-muted">{MANAGE_HINT}</p>
        )}
      </div>
    </Panel>
  );
};

type ApprovalLevel = "always" | "off" | "required";

const LEVEL_TEXT: Record<ApprovalLevel, string> = {
  always:
    "Every reveal or agent use waits for another owner or an approver of this secret, owners' own included. If nobody else can decide, the person confirms the task once with their second factor.",
  off: "Anyone who can read this secret reveals it, in the web or through their agent, without an approval.",
  required:
    "Owners reveal without an approval. Anyone else who can read it, in the web or through their agent, waits until one owner approves.",
};

/**
 * The secret's approval level: off, approval-required (owners exempt) or always-approve
 * (everyone). Nobody approves their own request. Service accounts are never held for
 * approval.
 */
export const AgentAccessCard = ({ page }: { page: SecretPage }) => {
  const fetcher = useSecretFetcher();
  const pending = fetcher.formData?.get("level");
  const saved: ApprovalLevel = page.secret.alwaysRequireApproval
    ? "always"
    : page.secret.requireTokenApproval
      ? "required"
      : "off";
  const level = (typeof pending === "string" ? pending : saved) as ApprovalLevel;
  const canManage = page.access.manage;
  const locked = page.secret.retired || !canManage;
  return (
    <Panel title="Approvals">
      <div className="flex flex-col gap-3 px-6 py-5">
        <Segmented
          label="Approval for reveals"
          onChange={(next) =>
            void fetcher.submit({ intent: "token-approval", level: next }, { method: "post" })
          }
          options={[
            { disabled: locked, label: "Off", value: "off" },
            { disabled: locked, label: "Non-owners", value: "required" },
            { disabled: locked, label: "Everyone", value: "always" },
          ]}
          value={level}
        />
        <p className="m-0 text-[0.875rem]">{LEVEL_TEXT[level]}</p>
        <p className="m-0 text-small text-muted">
          Service accounts are never held for approval: their access rules and the Allow API access
          to sensitive secrets setting decide what they can reveal.
        </p>
        {!page.secret.retired && !canManage && (
          <p className="m-0 text-small text-muted">{MANAGE_HINT}</p>
        )}
      </div>
    </Panel>
  );
};
