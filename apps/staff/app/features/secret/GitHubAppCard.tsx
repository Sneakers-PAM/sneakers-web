import { Button, cn } from "@sneakers-web/ui";
import { KeyRound } from "lucide-react";
import { type ReactNode } from "react";

import type { SecretType } from "@/features/secret/secret.server";

import { CopyFieldButton } from "@/features/secret/FieldsCard";
import { Panel, Row } from "@/features/secret/Panel";
import { SensitiveValue } from "@/features/secret/SensitiveValue";

/** The App's details, shown at a glance. */
const DETAILS = ["appId", "installationId", "ownerOrg", "clientId"];

/** The App's secrets, each behind its own recorded reveal. */
const SECRETS = ["privateKey", "clientSecret", "webhookSecret"];

/** The fields this card shows, so the Fields card leaves them out. */
export const GITHUB_APP_SHOWN = new Set([...DETAILS, ...SECRETS]);

const Tile = ({ children, copy, label }: { children: ReactNode; copy?: string; label: string }) => (
  <div className="flex min-w-0 flex-col gap-1.5 rounded-lg bg-sunken p-3.5">
    <span className="font-mono text-label tracking-[0.08em] uppercase">{label}</span>
    <div className="flex min-w-0 items-center gap-2">
      <b className={cn("min-w-0 flex-1 truncate", copy && "font-mono")} title={copy}>
        {children}
      </b>
      {copy && <CopyFieldButton label={label} value={copy} />}
    </div>
  </div>
);

/**
 * U-04 GitHub App: the App's ids and owner at a glance, its private key and secrets masked
 * behind the normal reveal, and replacing the key as its own action.
 */
export const GitHubAppCard = ({
  fields,
  locked,
  onReplaceKey,
  plainHidden,
  type,
}: {
  fields: Record<string, string>;
  /** Why the secrets can't be revealed now, or undefined when they can. */
  locked?: string;
  onReplaceKey?: () => void;
  /** The person can't read the secret, so even the ids aren't shown. */
  plainHidden: boolean;
  type: SecretType;
}) => {
  const label = (key: string) => type.fields.find((f) => f.key === key)?.label ?? key;
  return (
    <Panel
      aside={
        onReplaceKey && (
          <Button onClick={onReplaceKey} size="sm" variant="secondary">
            <KeyRound aria-hidden />
            Replace private key…
          </Button>
        )
      }
      subtitle="Revealing a key or secret is recorded in the audit log."
      title="GitHub App"
    >
      <div className="grid gap-3 border-b border-border px-6 py-5 tablet:grid-cols-2">
        {DETAILS.map((key) => {
          const value = fields[key];
          return (
            <Tile copy={plainHidden || !value ? undefined : value} key={key} label={label(key)}>
              {plainHidden ? (
                <span className="font-normal text-muted">Hidden</span>
              ) : (
                value || <span className="font-normal text-muted">—</span>
              )}
            </Tile>
          );
        })}
      </div>
      {SECRETS.map((key) => {
        const f = type.fields.find((x) => x.key === key);
        if (!f) return null;
        return (
          <Row key={key} label={f.label}>
            <SensitiveValue field={f} locked={locked} target={{ fieldKey: key }} />
          </Row>
        );
      })}
    </Panel>
  );
};
