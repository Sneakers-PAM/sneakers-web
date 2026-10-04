import type {
  InheritedOwner,
  InheritedRule,
  RulesetDraft,
  RulesetSubject,
} from "@sneakers-web/shell";

import { refusalMessage, RulesetEditor } from "@sneakers-web/shell";
import { Alert, Button } from "@sneakers-web/ui";
import { useState } from "react";
import { useFetcher } from "react-router";

import type { ActionResult } from "@/lib/admin.server";

import { Panel, useResultToast } from "@/components/Admin";

export interface FolderSharingProps {
  folderId: string;
  inherited: InheritedRule[];
  inheritedOwners: InheritedOwner[];
  labels: Record<string, string>;
  saved: RulesetDraft;
  subjectOptions: RulesetSubject[];
}

/**
 * A folder's owners and RACI rules, edited with the shared editor and saved in one go.
 */
export const FolderSharing = ({
  folderId,
  inherited,
  inheritedOwners,
  labels,
  saved,
  subjectOptions,
}: FolderSharingProps) => {
  const fetcher = useFetcher<ActionResult>();
  useResultToast(fetcher.data);
  const [draft, setDraft] = useState<RulesetDraft>(saved);
  const [version, setVersion] = useState(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const refusal = fetcher.data && !fetcher.data.ok ? fetcher.data.refusal : undefined;
  return (
    <Panel title="Sharing">
      <span className="-mt-2 text-small text-muted">
        Owners can do everything here and below. Rules are checked nearest folder first, and the
        first rule with an answer for an action decides it.
      </span>
      <RulesetEditor
        canEditEveryone
        inherited={inherited}
        inheritedOwners={inheritedOwners}
        key={version}
        labels={labels}
        onChange={setDraft}
        scope="folder"
        subjectOptions={subjectOptions}
        value={saved}
      />
      {refusal && <Alert tone="danger">{refusalMessage(refusal)}</Alert>}
      <fetcher.Form className="flex justify-end gap-2" method="post">
        <input name="intent" type="hidden" value="ruleset" />
        <input name="id" type="hidden" value={folderId} />
        <input name="draft" type="hidden" value={JSON.stringify(draft)} />
        <Button
          disabled={!dirty}
          onClick={() => {
            setDraft(saved);
            setVersion((v) => v + 1);
          }}
          variant="secondary"
        >
          Discard
        </Button>
        <Button
          disabled={!dirty}
          loading={fetcher.state !== "idle"}
          loadingLabel="Saving…"
          type="submit"
        >
          Save sharing
        </Button>
      </fetcher.Form>
    </Panel>
  );
};
