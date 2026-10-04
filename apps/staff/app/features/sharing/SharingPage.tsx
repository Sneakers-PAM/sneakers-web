import {
  type RaciDecisionView,
  refusalMessage,
  type RulesetDraft,
  RulesetEditor,
  RulesetSimulator,
  type RulesetSubject,
} from "@sneakers-web/shell";
import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Button,
  PageHeader,
  toast,
} from "@sneakers-web/ui";
import { ChevronLeft } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useBlocker, useFetcher } from "react-router";

import type { RulesetData, SharingResult } from "@/features/sharing/types";

import { useActionCall } from "@/features/sharing/useActionCall";

const listOf = (names: string[]) => {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

const same = (a: RulesetDraft, b: RulesetDraft) => JSON.stringify(a) === JSON.stringify(b);

/** U-07 / D-11: a folder's or secret's sharing, editable by its owners and view-only to readers. */
export const SharingPage = ({ data }: { data: RulesetData }) => {
  const saved = JSON.stringify(data.value);
  // The draft belongs to the saved ruleset it was made from; a new saved one starts afresh.
  const [edit, setEdit] = useState<{ base: string; draft: RulesetDraft }>({
    base: saved,
    draft: data.value,
  });
  const draft = edit.base === saved ? edit.draft : data.value;
  const setDraft = useCallback(
    (next: RulesetDraft) => setEdit({ base: saved, draft: next }),
    [saved],
  );
  const [resets, setResets] = useState(0);
  const saver = useFetcher<SharingResult>();
  const call = useActionCall();
  const searchCall = useActionCall();
  const editable = data.mode === "edit";
  const dirty = editable && !same(draft, data.value);
  const saving = saver.state !== "idle";
  const failed = saver.state === "idle" && saver.data?.ok === false ? saver.data.refusal : null;

  useEffect(() => {
    if (saver.state === "idle" && saver.data?.ok && saver.data.intent === "save") {
      toast(`${saver.data.done}.`);
    }
  }, [saver.state, saver.data]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !saving && currentLocation.pathname !== nextLocation.pathname,
  );

  const search = useCallback(
    async (query: string): Promise<RulesetSubject[]> => {
      const r = await searchCall({ intent: "search", query });
      return r.ok && r.intent === "search" ? r.people : [];
    },
    [searchCall],
  );

  const draftJson = JSON.stringify(draft);
  const simulate = useCallback(
    async (userId: string): Promise<RaciDecisionView> => {
      const r = await call({ draft: draftJson, intent: "simulate", userId });
      if (r.ok && r.intent === "simulate") return r.decision;
      throw new Error("simulation refused");
    },
    [call, draftJson],
  );

  const owners = listOf(data.ownerNames);
  const readOnlyReason = editable
    ? undefined
    : `Only owners manage sharing. You can see who has access here, but you can't change it.${
        owners
          ? ` ${owners} ${data.ownerNames.length === 1 ? "is the owner" : "are the owners"}.`
          : ""
      }`;
  const reach =
    data.kind === "folder"
      ? data.secretCount == null
        ? "Changes apply to everything in this folder and its subfolders once saved."
        : `Changes apply to all ${data.secretCount} secrets in this folder and its subfolders once saved.`
      : "Changes apply to this secret once saved.";

  return (
    <div className="flex min-w-0 flex-col gap-5.5 pb-4">
      <PageHeader
        actions={
          <>
            {dirty && (
              <span
                className="rounded-full border-[1.5px] border-warn bg-warn-soft px-2.75 py-1.75 text-[0.8125rem] leading-none font-bold text-warn"
                role="status"
              >
                Unsaved changes
              </span>
            )}
            <Button asChild variant="secondary">
              <Link to={data.backTo}>
                <ChevronLeft aria-hidden />
                Back
              </Link>
            </Button>
          </>
        }
        eyebrow={data.eyebrow}
        subtitle={data.subtitle}
        title={data.title}
      />

      {failed && (
        <Alert role="alert" title="Couldn't save." tone="danger">
          {refusalMessage(failed)} Nobody&apos;s access has changed, and your edits are still here.
        </Alert>
      )}

      <RulesetEditor
        canEditEveryone={data.canEditEveryone}
        inherited={data.inherited}
        inheritedOwners={data.inheritedOwners}
        key={`${resets}:${saved}`}
        labels={data.labels}
        onChange={setDraft}
        readOnlyReason={readOnlyReason}
        scope={data.kind}
        searchSubjects={search}
        subjectOptions={data.subjectOptions}
        value={data.value}
      />

      {editable && (
        <div className="grid min-w-0 gap-5.5 desktop:grid-cols-2">
          <RulesetSimulator searchUsers={search} simulate={simulate} />
        </div>
      )}

      {editable && (
        <saver.Form
          className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border border-border-strong bg-surface px-4.5 py-3.5 shadow-menu"
          method="post"
        >
          <input name="intent" type="hidden" value="save" />
          <input name="draft" type="hidden" value={draftJson} />
          <span className="text-[0.875rem] leading-[1.3] text-muted">
            {dirty ? reach : "All changes saved."}
          </span>
          <span className="ml-auto flex gap-3">
            <Button
              disabled={!dirty || saving}
              onClick={() => {
                setDraft(data.value);
                setResets((n) => n + 1);
              }}
              type="button"
              variant="secondary"
            >
              Discard
            </Button>
            <Button disabled={!dirty} loading={saving} type="submit">
              {saving ? "Saving..." : "Save"}
            </Button>
          </span>
        </saver.Form>
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && blocker.state === "blocked") blocker.reset();
        }}
        open={blocker.state === "blocked"}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes to this {data.kind}&apos;s sharing. If you leave, nobody&apos;s
            access changes.
          </AlertDialogDescription>
          <div className="mt-1.5 flex justify-end gap-2.5">
            <AlertDialogAction asChild>
              <Button onClick={() => blocker.proceed?.()} variant="secondary">
                Leave
              </Button>
            </AlertDialogAction>
            <AlertDialogCancel asChild>
              <Button>Stay</Button>
            </AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
