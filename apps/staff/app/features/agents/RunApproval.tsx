import { getAssertion, passkeysSupported } from "@sneakers-web/api-client";
import { EdgeBanner, useQuietRefresh } from "@sneakers-web/shell";
import {
  Alert,
  announce,
  Button,
  Card,
  clockTime,
  cn,
  CodeInput,
  EmptyState,
  plural,
  Spinner,
  useBreakpoint,
  useIsClient,
} from "@sneakers-web/ui";
import { KeyRound, ShieldCheck, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type {
  RunData,
  RunOutcome,
  RunProblem,
  RunResult,
  RunUse,
} from "@/features/agents/run.server";

import { RUN_REFUSAL } from "@/features/agents/messages";
import { RunUseCard } from "@/features/agents/RunUseCard";

// Agents wait on this page, so it checks for new requests as often as the approvals list.
const REFRESH_MS = 5000;
const TICK_MS = 1000;

const PROBLEMS: Record<Exclude<RunProblem, "step-up">, string> = {
  batch: "Tick between 1 and 20 requests, then try again.",
  code: "That code didn't work. Nothing was approved.",
  passkey: "The passkey step didn't finish. Try again, or use a code.",
  unavailable: "We couldn't decide these just now. Try again in a moment.",
};

/** The time now, moving once a second, so expiry and the factor window follow the clock. */
const useNow = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(iv);
  }, []);
  return now;
};

/** Full-screen on a phone; a centred card on anything wider. Nothing else on the page. */
export const RunFrame = ({ children }: { children: ReactNode }) => {
  const phone = useBreakpoint() === "phone";
  return (
    <div className={cn("flex min-h-dvh flex-col", phone ? "bg-surface" : "bg-sunken")}>
      <EdgeBanner />
      {phone ? (
        <main className="flex flex-1 flex-col gap-5 px-4 py-5">{children}</main>
      ) : (
        <main className="flex flex-1 items-center justify-center px-6 py-12">
          <Card className="flex w-full max-w-140 flex-col gap-5 p-8 shadow-menu">{children}</Card>
        </main>
      )}
    </div>
  );
};

interface Decided {
  decision: "approve" | "deny";
  /** The ids on the page when the batch went, so later arrivals read as new. */
  onPage: Set<string>;
  outcomes: RunOutcome[];
  uses: Map<string, RunUse>;
}

const nameOf = (uses: Map<string, RunUse>, id: string) => {
  const u = uses.get(id);
  return u ? `${u.secretName} · ${u.fieldKey}` : "A request";
};

const Result = ({
  decided,
  onMore,
  waiting,
}: {
  decided: Decided;
  onMore: () => void;
  waiting: RunUse[];
}) => {
  const done = decided.outcomes.filter((o) => o.decided);
  const refused = decided.outcomes.filter((o) => !o.decided);
  const approve = decided.decision === "approve";
  const fresh = waiting.filter((u) => !decided.onPage.has(u.id));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="m-0 font-display text-[1.5rem] leading-[1.2] font-bold">
        {approve ? "Done" : "Denied"}
      </h1>
      {done.length > 0 && (
        <section aria-label={approve ? "Approved" : "Denied"}>
          <Alert
            title={
              approve
                ? `Approved ${plural(done.length, "request")}`
                : `Denied ${plural(done.length, "request")}`
            }
            tone={approve ? "ok" : "info"}
          >
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {done.map((o) => (
                <li key={o.id}>{nameOf(decided.uses, o.id)}</li>
              ))}
            </ul>
            <span className="mt-1.5 block text-muted">
              {approve
                ? "The agent can now collect these within 60 seconds. Each one is logged."
                : "The agent was told no."}
            </span>
          </Alert>
        </section>
      )}
      {refused.length > 0 && (
        <section aria-label="Not decided">
          <Alert
            role="status"
            title={`Not decided: ${plural(refused.length, "request")}`}
            tone="warn"
          >
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {refused.map((o) => (
                <li key={o.id}>
                  <b>{nameOf(decided.uses, o.id)}</b>. {o.reason ? RUN_REFUSAL[o.reason] : ""}
                </li>
              ))}
            </ul>
          </Alert>
        </section>
      )}
      {waiting.length > 0 && (
        <Button onClick={onMore} variant="secondary">
          {fresh.length === waiting.length
            ? plural(waiting.length, "new request")
            : `${plural(waiting.length, "request")} still waiting`}
        </Button>
      )}
      <Link className="text-small font-bold text-primary hover:text-ink" to="/approvals">
        All approvals
      </Link>
    </div>
  );
};

const Header = ({ uses }: { uses: RunUse[] }) => {
  const requesters = [...new Set(uses.map((u) => u.requester))];
  const labels = [...new Set(uses.map((u) => u.clientLabel))].filter(
    (l) => l && !requesters.includes(l),
  );
  const purposes = [...new Set(uses.map((u) => u.purpose))];
  const shared = purposes.length === 1 ? purposes[0] : "";
  return (
    <div className="flex flex-col gap-2.5">
      <span className="eyebrow">Agent approval</span>
      <h1 className="m-0 font-display text-[1.5rem] leading-[1.2] font-bold tracking-[-0.01em]">
        {requesters.join(", ")} is waiting on {plural(uses.length, "request")}
      </h1>
      {labels.length > 0 && <span className="text-small text-muted">{labels.join(", ")}</span>}
      {shared && (
        <p
          aria-label="Agent says"
          className="m-0 rounded-xl bg-sunken px-3.5 py-2.5 text-[0.9375rem] leading-[1.45]"
          role="note"
        >
          <span className="font-bold">Agent says: </span>
          {shared}
        </p>
      )}
    </div>
  );
};

/** U-14b: every pending use one agent run raised, approved or denied together with one factor. */
export const RunApproval = ({ data }: { data: RunData }) => {
  useQuietRefresh(REFRESH_MS);
  const now = useNow();
  const client = useIsClient();
  const fetcher = useFetcher<RunResult>();
  const email = useFetcher<RunResult>();
  const action = `/approvals/run/${encodeURIComponent(data.runId)}`;
  const codeRef = useRef<HTMLInputElement>(null);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [decided, setDecided] = useState<Decided | null>(null);
  const [factor, setFactor] = useState<"email" | "totp">("totp");
  const [code, setCode] = useState("");
  // The window the gateway said had closed; a later step-up moves freshUntil past it.
  const [closedWindow, setClosedWindow] = useState<null | number>(null);
  const [dismissed, setDismissed] = useState<RunResult | undefined>();
  const [passkeyFailed, setPasskeyFailed] = useState(false);
  const submitted = useRef<{ ids: string[]; onPage: Set<string>; uses: Map<string, RunUse> }>(null);
  const handled = useRef<RunResult | undefined>(undefined);

  const live = (u: RunUse) => u.expiresAt > now;
  const ticked = data.uses.filter((u) => live(u) && !unticked.has(u.id));
  const n = ticked.length;
  const fresh = data.freshUntil > now && data.freshUntil !== closedWindow;
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;
  const answered = result && "problem" in result && result !== dismissed ? result.problem : null;
  const problem = passkeyFailed ? "passkey" : answered === "step-up" ? null : answered;
  const purposes = new Set(data.uses.map((u) => u.purpose));

  const send = (fields: Record<string, string>) =>
    void fetcher.submit(fields, { action, method: "post" });

  /** Remember what the batch covers, so the answer can name it and later arrivals read as new. */
  const snapshot = (): string[] => {
    const ids = ticked.map((u) => u.id);
    submitted.current = {
      ids,
      onPage: new Set(data.uses.map((u) => u.id)),
      uses: new Map(data.uses.map((u) => [u.id, u])),
    };
    return ids;
  };

  const decide = (intent: "approve" | "deny", extra: Record<string, string> = {}) =>
    send({ ids: snapshot().join(","), intent, ...extra });

  useEffect(() => {
    const d = fetcher.data;
    if (!d || handled.current === d) return;
    handled.current = d;
    if (d.view === "decided" && submitted.current) {
      const { onPage, uses } = submitted.current;
      setDecided({ decision: d.decision, onPage, outcomes: d.outcomes, uses });
      setCode("");
      const done = d.outcomes.filter((o) => o.decided).length;
      announce(
        `${d.decision === "approve" ? "Approved" : "Denied"} ${plural(done, "request")}` +
          (done < d.outcomes.length ? `, ${d.outcomes.length - done} not decided` : ""),
      );
      return;
    }
    if ("passkey" in d && submitted.current) {
      const { ids } = submitted.current;
      void getAssertion(d.passkey.options)
        .then((credentialJson) =>
          fetcher.submit(
            {
              credentialJson,
              factor: "passkey",
              ids: ids.join(","),
              intent: "approve",
              webauthnSessionId: d.passkey.webauthnSessionId,
            },
            { action, method: "post" },
          ),
        )
        .catch(() => setPasskeyFailed(true));
      return;
    }
    if ("problem" in d && d.problem === "step-up") {
      setClosedWindow(data.freshUntil);
      announce("Your verification ran out. Enter a code to approve.");
    }
  }, [fetcher, fetcher.data, action, data.freshUntil]);

  const toggle = (u: RunUse, on: boolean) => {
    const next = new Set(unticked);
    if (on) next.delete(u.id);
    else next.add(u.id);
    setUnticked(next);
    const count = data.uses.filter((x) => live(x) && !next.has(x.id)).length;
    announce(`${plural(count, "request")} ticked`);
  };

  const clear = () => {
    setDismissed(fetcher.data);
    setPasskeyFailed(false);
  };

  if (decided) {
    return (
      <RunFrame>
        <Result
          decided={decided}
          onMore={() => {
            setDecided(null);
            clear();
          }}
          waiting={data.uses.filter((u) => live(u))}
        />
      </RunFrame>
    );
  }

  if (data.uses.length === 0) {
    return (
      <RunFrame>
        <EmptyState
          action={
            <Link className="text-small font-bold text-primary hover:text-ink" to="/approvals">
              All approvals
            </Link>
          }
          body="It was decided, or its requests expired. If the agent asks again, it sends a new link."
          title="Nothing waiting in this run"
        />
      </RunFrame>
    );
  }

  const needsCode = !fresh;
  const ready = n > 0 && (!needsCode || code.length === 6);
  const emailState = email.data && "emailState" in email.data ? email.data.emailState : undefined;
  return (
    <RunFrame>
      <form
        className="flex flex-1 flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          decide("approve", needsCode ? { code, factor } : {});
        }}
      >
        <Header uses={data.uses} />
        <div className="flex flex-col gap-2.5">
          {data.uses.map((u) => (
            <RunUseCard
              checked={!unticked.has(u.id)}
              expired={!live(u)}
              key={u.id}
              onCheckedChange={(on) => toggle(u, on)}
              showPurpose={purposes.size > 1}
              use={u}
            />
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-4 border-t border-border pt-4">
          {needsCode ? (
            <div className="flex flex-col gap-2">
              {closedWindow !== null && (
                <Alert role="status" tone="warn">
                  Your verification ran out. Enter a code to approve.
                </Alert>
              )}
              <span className="flex flex-wrap items-center gap-2 text-[0.875rem] font-bold">
                {factor === "totp" ? "Authenticator code" : "Email code"}
                <button
                  className="ml-auto font-bold text-primary hover:text-ink"
                  onClick={() => {
                    const next = factor === "totp" ? "email" : "totp";
                    setFactor(next);
                    setCode("");
                    clear();
                    if (next === "email")
                      void email.submit({ intent: "factor-email" }, { action, method: "post" });
                  }}
                  type="button"
                >
                  {factor === "totp" ? "Email me a code" : "Use authenticator instead"}
                </button>
              </span>
              {factor === "email" && emailState && (
                <span className="text-small text-muted">
                  {emailState === "wait"
                    ? "A code was sent a moment ago. Wait a little, then ask for another."
                    : "We emailed you a code. It works for 10 minutes."}
                </span>
              )}
              <CodeInput
                aria-describedby={problem ? "run-problem" : undefined}
                invalid={problem === "code"}
                onChange={(next) => {
                  setCode(next);
                  clear();
                }}
                ref={codeRef}
                value={code}
              />
              {client && passkeysSupported() && (
                <Button
                  disabled={n === 0}
                  onClick={() => {
                    clear();
                    snapshot();
                    send({ intent: "factor-passkey" });
                  }}
                  variant="secondary"
                >
                  <KeyRound aria-hidden />
                  Use a passkey
                </Button>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[0.875rem] text-ok">
              <ShieldCheck aria-hidden className="size-4" />
              Verified, good until {clockTime(data.freshUntil)}
            </span>
          )}
          {problem && (
            <span
              className="text-[0.875rem] leading-[1.3] font-bold text-danger"
              id="run-problem"
              role="alert"
            >
              <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
              {PROBLEMS[problem]}
            </span>
          )}
          <div className="flex gap-2.5">
            <Button
              className="flex-1"
              disabled={n === 0 || busy}
              onClick={() => decide("deny")}
              size="lg"
              variant="secondary"
            >
              {n === data.uses.filter((u) => live(u)).length ? "Deny all" : `Deny ${n}`}
            </Button>
            <Button
              className="flex-2"
              disabled={!ready}
              loading={busy}
              loadingLabel="Checking…"
              size="lg"
              type="submit"
            >
              Approve {plural(n, "request")}
            </Button>
          </div>
        </div>
      </form>
    </RunFrame>
  );
};

/** What stands in for the page while a navigation loads it. */
export const RunLoading = () => (
  <RunFrame>
    <div aria-label="Loading" className="flex justify-center py-10" role="status">
      <Spinner />
    </div>
  </RunFrame>
);
