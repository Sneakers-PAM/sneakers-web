import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sneakers-web/ui";
import { X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { SecretPage } from "@/features/secret/secret.server";

import { Panel, Row } from "@/features/secret/Panel";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

/**
 * #168: the secret's attached targets, added and removed one at a time (never a wholesale
 * replace — that's updateSecret's job). Read-only for anyone without manage.
 */
export const TargetsCard = ({ page }: { page: SecretPage }) => {
  const { access, secret, targetChoices, targets } = page;
  const fetcher = useSecretFetcher();
  const canManage = access.manage && !secret.retired;
  const attached = new Set(targets.map((t) => t.id));
  const choices = targetChoices.filter((t) => !attached.has(t.id));
  const [picked, setPicked] = useState("");
  const busy = fetcher.state !== "idle";

  const attach = (targetId: string) => {
    setPicked("");
    void fetcher.submit({ intent: "attach-target", targetId }, { method: "post" });
  };
  const detach = (targetId: string) =>
    void fetcher.submit({ intent: "detach-target", targetId }, { method: "post" });

  return (
    <Panel title="Targets">
      <Row label="Attached" note={targets.length === 0 ? "No attached targets." : undefined}>
        {targets.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {targets.map((t) => (
              <li
                className="flex items-center justify-between gap-3 rounded-md border-[1.5px] border-border-strong bg-surface px-3 py-2"
                key={t.id}
              >
                <Link
                  aria-label={`${t.name}, ${t.hostname}`}
                  className="flex min-w-0 flex-col"
                  to={`/targets/${t.id}`}
                >
                  <b aria-hidden className="truncate text-[0.875rem] font-bold">
                    {t.name}
                  </b>
                  <span aria-hidden className="truncate font-mono text-small text-muted">
                    {t.hostname}
                  </span>
                </Link>
                {canManage && (
                  <Button
                    aria-label={`Detach ${t.name}`}
                    disabled={busy}
                    onClick={() => detach(t.id)}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && choices.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <Select onValueChange={setPicked} value={picked}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Attach a target…" />
              </SelectTrigger>
              <SelectContent>
                {choices.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!picked || busy} onClick={() => attach(picked)} variant="secondary">
              Attach
            </Button>
          </div>
        )}
      </Row>
    </Panel>
  );
};
