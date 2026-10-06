import { refusalMessage } from "@sneakers-web/shell";
import {
  Button,
  Card,
  cn,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Pill,
  Textarea,
} from "@sneakers-web/ui";
import { FolderLock, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useFetcher, useSearchParams } from "react-router";

import type {
  BreakGlassActionResult,
  BreakGlassFolder,
  BreakGlassSecret,
  BreakGlassView,
} from "@/features/breakGlass/breakGlass.server";

import { BreakGlassCard } from "@/features/secret/BreakGlass";

/** The gateway checks the code itself and refuses a bad one with no reason (and, live, no code). */
const wrongCode = (result: BreakGlassActionResult | undefined) =>
  !!result &&
  !result.ok &&
  (result.refusal.reason === "BREAK_GLASS_CODE_INVALID" ||
    !result.refusal.code ||
    result.refusal.code === "UNAUTHENTICATED");

const Warning = ({ children }: { children: React.ReactNode }) => (
  <ul className="m-0 flex list-none flex-col gap-2 rounded-lg border-[1.5px] border-danger bg-danger-soft p-4 text-[0.875rem] text-ink">
    {children}
  </ul>
);

/** No session yet: a reason and a fresh authenticator code open one. No approver is asked. */
const OpenBreakGlass = () => {
  const fetcher = useFetcher<BreakGlassActionResult>();
  const [reason, setReason] = useState("");
  const [code, setCode] = useState({ after: fetcher.data, value: "" });
  const result = fetcher.data?.intent === "open" ? fetcher.data : undefined;
  const refusal = result && !result.ok && code.after !== result ? result.refusal : undefined;
  const wrong = !!refusal && wrongCode(result);
  return (
    <Card className="flex max-w-[44rem] flex-col gap-5 p-5.5">
      <fetcher.Form className="flex flex-col gap-5" method="post">
        <input name="intent" type="hidden" value="open" />
        <h2 className="m-0 flex items-center gap-3 font-display text-[1.25rem] font-bold">
          <span className="inline-flex size-11 items-center justify-center rounded-lg bg-danger text-on-danger">
            <TriangleAlert aria-hidden className="size-5" />
          </span>
          Break the glass?
        </h2>
        <Warning>
          <li>
            <b>You see every folder and secret</b>, other people&apos;s personal folders included.
          </li>
          <li>
            <b>Each reveal alerts the secret&apos;s owners</b> and queues a rotation.
          </li>
          <li>You get no edit rights. Nobody approves this; it&apos;s recorded instead.</li>
          <li>
            The audit log shows one entry when you start and one when you leave, with every secret
            you revealed. It ends by itself after 15 minutes.
          </li>
        </Warning>
        <Field label="Reason" required>
          <Textarea
            maxLength={500}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder="What is the emergency?"
            value={reason}
          />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[0.875rem] font-bold">
            Authenticator code <span className="text-danger">*</span>
          </span>
          <CodeInput
            aria-describedby={refusal ? "break-glass-open-refused" : undefined}
            invalid={wrong}
            onChange={(value) => setCode({ after: fetcher.data, value })}
            size="md"
            value={wrong ? "" : code.value}
          />
          <input name="code" type="hidden" value={code.value} />
        </div>
        {refusal && (
          <span
            className="text-small font-bold text-danger"
            id="break-glass-open-refused"
            role="alert"
          >
            {wrong ? "That code didn't work. Try again." : refusalMessage(refusal)}
          </span>
        )}
        <div>
          <Button
            disabled={!reason.trim() || code.value.length !== 6 || wrong}
            loading={fetcher.state !== "idle"}
            loadingLabel="Breaking glass…"
            type="submit"
            variant="danger"
          >
            Break glass
          </Button>
        </div>
      </fetcher.Form>
    </Card>
  );
};

/** A folder's place in the tree, for the list: "Personal: Bob / My secrets", "Platform / DB". */
const pathOf = (
  folder: BreakGlassFolder,
  byId: Map<string, BreakGlassFolder>,
  owners: Record<string, string>,
) => {
  const names: string[] = [];
  let f: BreakGlassFolder | undefined = folder;
  const seen = new Set<string>();
  while (f && !seen.has(f.id)) {
    seen.add(f.id);
    names.unshift(f.name);
    f = f.parentId ? byId.get(f.parentId) : undefined;
  }
  if (folder.scope === "personal" && folder.ownerUserId)
    names.unshift(`Personal: ${owners[folder.ownerUserId] ?? folder.ownerUserId}`);
  return names.join(" / ");
};

/** One break-glass reveal: a fresh code, then every field. The owners are alerted. */
const RevealDialog = ({
  onClose,
  secret,
  sessionId,
}: {
  onClose: () => void;
  secret: BreakGlassSecret;
  sessionId: string;
}) => {
  const fetcher = useFetcher<BreakGlassActionResult>();
  const [reason, setReason] = useState("");
  const [code, setCode] = useState({ after: fetcher.data, value: "" });
  const result = fetcher.data?.intent === "reveal" ? fetcher.data : undefined;
  const refusal = result && !result.ok && code.after !== result ? result.refusal : undefined;
  const wrong = !!refusal && wrongCode(result);
  const revealed = result?.ok ? result : undefined;
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent className={cn(revealed && "max-w-[48rem]")}>
        {revealed ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{secret.name}</DialogTitle>
              <DialogDescription>
                The owners were alerted and the reveal is recorded in this break-glass session.
              </DialogDescription>
            </DialogHeader>
            <BreakGlassCard
              at={revealed.at}
              by="you"
              fields={revealed.fields}
              onEnd={onClose}
              type={null}
            />
          </div>
        ) : (
          <fetcher.Form className="flex flex-col gap-5" method="post">
            <input name="intent" type="hidden" value="reveal" />
            <input name="secretId" type="hidden" value={secret.id} />
            <input name="sessionId" type="hidden" value={sessionId} />
            <input name="code" type="hidden" value={code.value} />
            <DialogHeader>
              <DialogTitle>Reveal {secret.name}?</DialogTitle>
              <DialogDescription asChild>
                <Warning>
                  <li>
                    <b>The secret&apos;s owners will be notified</b> straight away.
                  </li>
                  <li>
                    <b>Every field is shown</b>, and the secret is queued for rotation.
                  </li>
                  <li>It&apos;s recorded under this break-glass session.</li>
                </Warning>
              </DialogDescription>
            </DialogHeader>
            <Field hint="Leave empty to use the session's reason." label="Reason for this one">
              <Input
                name="reason"
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </Field>
            <div className="flex flex-col gap-2">
              <span className="text-[0.875rem] font-bold">
                Authenticator code <span className="text-danger">*</span>
              </span>
              <CodeInput
                aria-describedby={refusal ? "break-glass-reveal-refused" : undefined}
                invalid={wrong}
                onChange={(value) => setCode({ after: fetcher.data, value })}
                size="md"
                value={wrong ? "" : code.value}
              />
            </div>
            {refusal && (
              <span
                className="text-small font-bold text-danger"
                id="break-glass-reveal-refused"
                role="alert"
              >
                {wrong ? "That code didn't work. Try again." : refusalMessage(refusal)}
              </span>
            )}
            <DialogFooter>
              <Button onClick={onClose} variant="secondary">
                Cancel
              </Button>
              <Button
                disabled={code.value.length !== 6 || wrong}
                loading={fetcher.state !== "idle"}
                loadingLabel="Revealing…"
                type="submit"
                variant="danger"
              >
                Reveal
              </Button>
            </DialogFooter>
          </fetcher.Form>
        )}
      </DialogContent>
    </Dialog>
  );
};

/** In a session: every folder, and the selected folder's secrets with a break-glass reveal. */
const Browse = ({
  view,
}: {
  view: { session: NonNullable<BreakGlassView["session"]> } & BreakGlassView;
}) => {
  const [parameters, setParameters] = useSearchParams();
  const [revealing, setRevealing] = useState<BreakGlassSecret | null>(null);
  const byId = new Map(view.folders.map((f) => [f.id, f]));
  const folders = view.folders
    .map((f) => ({ folder: f, path: pathOf(f, byId, view.owners) }))
    .toSorted((a, b) => a.path.localeCompare(b.path));
  const selectedId = parameters.get("folder") ?? folders[0]?.folder.id;
  const selected = folders.find((f) => f.folder.id === selectedId);
  const secrets = view.secrets
    .filter((s) => s.folderId === selectedId)
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="grid gap-5 desktop:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <Card className="flex flex-col p-2">
        <nav aria-label="All folders">
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {folders.map(({ folder, path }) => (
              <li key={folder.id}>
                <button
                  aria-current={folder.id === selectedId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-small",
                    folder.id === selectedId ? "bg-danger-soft font-bold" : "hover:bg-sunken",
                  )}
                  onClick={() =>
                    setParameters(
                      { folder: folder.id },
                      { preventScrollReset: true, replace: true },
                    )
                  }
                  type="button"
                >
                  {folder.scope === "personal" && (
                    <FolderLock aria-hidden className="size-4 flex-none" />
                  )}
                  <span className="min-w-0 break-words">{path}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </Card>
      <Card className="flex flex-col">
        <h2 className="m-0 border-b border-border px-5.5 py-4 font-display text-[1.125rem] font-bold">
          {selected?.path ?? "No folders"}
        </h2>
        {secrets.length === 0 ? (
          <EmptyState body="No live secrets in this folder." loader={false} title="Empty" />
        ) : (
          <ul aria-label="Secrets" className="m-0 flex list-none flex-col p-0">
            {secrets.map((s) => (
              <li
                className="flex flex-wrap items-center gap-3 border-b border-border px-5.5 py-3 last:border-b-0"
                key={s.id}
              >
                <span className="min-w-0 flex-1 font-bold break-words">{s.name}</span>
                <Pill tone="neutral">{view.types[s.typeId] ?? s.typeId}</Pill>
                <Button
                  aria-label={`Reveal ${s.name}`}
                  onClick={() => setRevealing(s)}
                  size="sm"
                  variant="danger"
                >
                  Reveal…
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {revealing && (
        <RevealDialog
          key={revealing.id}
          onClose={() => setRevealing(null)}
          secret={revealing}
          sessionId={view.session.id}
        />
      )}
    </div>
  );
};

/** Break-the-glass mode (site admins): open a session, then browse and reveal any secret. */
export const BreakGlassPage = ({ view }: { view: BreakGlassView }) => (
  <div className="flex flex-col gap-6">
    <PageHeader
      eyebrow="Emergency access"
      subtitle={
        view.session
          ? `Reason: ${view.session.reason}`
          : "For when an owner can't be reached in time. Site admins only."
      }
      title={view.session ? "Every folder and secret" : "Break the glass"}
    />
    {view.session ? <Browse view={{ ...view, session: view.session }} /> : <OpenBreakGlass />}
  </div>
);
