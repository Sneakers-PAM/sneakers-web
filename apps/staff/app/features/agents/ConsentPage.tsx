import { getAssertion, passkeysSupported } from "@sneakers-web/api-client";
import { CenteredFrame } from "@sneakers-web/shell";
import { Button, cn, CodeInput, Field, Input, Skeleton, useIsClient } from "@sneakers-web/ui";
import { Check, CircleHelp, SquareTerminal, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Form, useFetcher } from "react-router";

import type { ConsentData, ConsentResult } from "@/features/agents/consent.server";

type Problem = Extract<ConsentResult, { problem: string }>["problem"];

const PROBLEMS: Record<Problem, [string, string]> = {
  code: ["That code didn't work.", "Check the code and try again."],
  email: ["We couldn't send the email.", "Try again in a minute, or use your authenticator."],
  expired: ["This request expired.", "Go back to the app and start sign-in again."],
  passkey: ["Passkey didn't work.", "It was cancelled or not recognised."],
  unavailable: ["We couldn't check that just now.", "Try again in a moment."],
};

const End = ({
  body,
  children,
  icon,
  title,
  tone,
}: {
  body: ReactNode;
  children?: ReactNode;
  icon: ReactNode;
  title: string;
  tone: "neutral" | "ok" | "warn";
}) => (
  <div className="flex flex-col items-start gap-3.5">
    <span
      aria-hidden
      className={cn(
        "flex size-14 items-center justify-center rounded-2xl [&_svg]:size-6.5",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "neutral" && "bg-neutral-soft text-ink",
        tone === "warn" && "bg-warn-soft text-warn",
      )}
    >
      {icon}
    </span>
    <h1 className="m-0 font-display text-[1.75rem] leading-[1.15] font-bold tracking-[-0.01em]">
      {title}
    </h1>
    <p className="m-0 text-body-lg leading-normal text-muted">{body}</p>
    {children}
  </div>
);

const Promise_ = ({ children, yes }: { children: ReactNode; yes: boolean }) => (
  <li className="flex gap-3 text-[0.9375rem] leading-[1.45]">
    {yes ? (
      <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-ok" strokeWidth={3} />
    ) : (
      <X aria-hidden className="mt-0.5 size-4.5 shrink-0 text-danger" strokeWidth={3} />
    )}
    <span>{children}</span>
  </li>
);

const Detail = ({ label, mono, value }: { label: string; mono?: boolean; value: ReactNode }) => (
  <div className="flex gap-3 border-border py-2.25 text-[0.875rem] leading-[1.35] not-last:border-b">
    <dt className="w-28 shrink-0 text-muted">{label}</dt>
    <dd className={cn("m-0 min-w-0 break-words", mono && "font-mono")}>{value}</dd>
  </div>
);

const ConsentForm = ({ data }: { data: Extract<ConsentData, { view: "form" }> }) => {
  const fetcher = useFetcher<ConsentResult>();
  const client = useIsClient();
  const codeRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState(data.clientName);
  const [factor, setFactor] = useState<"email" | "totp">("totp");
  const [code, setCode] = useState("");
  // A problem stays shown until the person edits past it; "expired" never clears.
  const [dismissed, setDismissed] = useState<ConsentResult | undefined>();
  const [passkeyFailed, setPasskeyFailed] = useState(false);
  const handled = useRef<ConsentResult | undefined>(undefined);
  const action = `/oauth/consent?req=${encodeURIComponent(data.req)}`;
  const busy = fetcher.state !== "idle";
  const d = fetcher.data;
  const end = d && "redirect" in d ? d : null;
  const answered = d && "problem" in d ? d.problem : null;
  const problem: null | Problem =
    answered === "expired"
      ? "expired"
      : passkeyFailed
        ? "passkey"
        : answered && d !== dismissed
          ? answered
          : null;

  const send = (fields: Record<string, string>) =>
    void fetcher.submit({ label, ...fields }, { action, method: "post" });
  const clear = () => {
    setDismissed(d);
    setPasskeyFailed(false);
  };

  useEffect(() => {
    if (!d || handled.current === d) return;
    handled.current = d;
    if ("passkey" in d) {
      void getAssertion(d.passkey.options)
        .then((credentialJson) =>
          fetcher.submit(
            {
              credentialJson,
              factor: "passkey",
              intent: "allow",
              label,
              webauthnSessionId: d.passkey.webauthnSessionId,
            },
            { action, method: "post" },
          ),
        )
        .catch(() => setPasskeyFailed(true));
      return;
    }
    // The app is listening on its loopback address for this redirect; it carries the code.
    if ("redirect" in d) globalThis.location.assign(d.redirect);
  }, [fetcher, d, action, label]);

  if (end?.view === "done") {
    return (
      <End
        body={
          <>
            &ldquo;{end.label || data.clientName}&rdquo; is connected. You can close this tab.
            Approve its requests under Approvals.
          </>
        }
        icon={<Check strokeWidth={3} />}
        title="You can go back to the app"
        tone="ok"
      />
    );
  }
  if (end?.view === "denied") {
    return (
      <End
        body="The app did not get a token. You can close this tab."
        icon={<X strokeWidth={3} />}
        title="Request denied"
        tone="neutral"
      />
    );
  }

  const ready = code.length === 6 && problem !== "expired";
  const shown = problem ? PROBLEMS[problem] : null;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) send({ code, factor, intent: "allow" });
      }}
    >
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-13 shrink-0 items-center justify-center rounded-[14px] bg-term-bg text-term-fg"
        >
          <SquareTerminal className="size-6" />
        </span>
        <div className="flex flex-col gap-1">
          <span className="eyebrow">Agent sign-in</span>
          <h1 className="m-0 font-display text-[1.625rem] leading-[1.15] font-bold tracking-[-0.01em]">
            Allow {data.clientName} to use Sneakers-PAM as you?
          </h1>
        </div>
      </div>
      <dl className="m-0 flex flex-col rounded-[14px] bg-sunken px-4 py-1.5">
        <Detail label="App" value={<b>{data.clientName}</b>} />
        {data.redirectHost && <Detail label="Returns to" mono value={data.redirectHost} />}
      </dl>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        <Promise_ yes>
          It acts with <b>your current access</b>. If you lose access to something, so does the app.
        </Promise_>
        <Promise_ yes>
          It works until you revoke it under <b>My tokens</b>.
        </Promise_>
        <Promise_ yes={false}>
          It can <b>never reveal values or break glass on its own</b>. Each use waits for your
          approval.
        </Promise_>
      </ul>
      {shown && (
        <div
          className="flex gap-3 rounded-[14px] border-[1.5px] border-danger bg-danger-soft px-3.5 py-3 text-[0.875rem] leading-[1.45]"
          role="alert"
        >
          <X aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" strokeWidth={3} />
          <span>
            <b>{shown[0]}</b> {shown[1]}
          </span>
        </div>
      )}
      <Field hint="Shown in My tokens so you can tell your apps apart." label="Token name">
        <Input onChange={(event) => setLabel(event.target.value)} value={label} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="flex text-[0.875rem] font-bold">
          {factor === "totp" ? "Authenticator code" : "Email code"}
          <button
            className="ml-auto font-bold text-primary hover:text-ink"
            onClick={() => {
              const next = factor === "totp" ? "email" : "totp";
              setFactor(next);
              setCode("");
              clear();
              if (next === "email") send({ intent: "email" });
            }}
            type="button"
          >
            {factor === "totp" ? "Email me a code instead" : "Use authenticator instead"}
          </button>
        </span>
        <CodeInput
          invalid={problem === "code"}
          onChange={(next) => {
            setCode(next);
            clear();
          }}
          ref={codeRef}
          value={code}
        />
        {client && passkeysSupported() && (
          <button
            className="self-start text-small font-bold text-primary hover:text-ink"
            onClick={() => send({ intent: "passkey-begin" })}
            type="button"
          >
            Use a passkey
          </button>
        )}
      </div>
      <div className="mt-1 flex gap-2.5">
        <Button
          block
          className="flex-1"
          disabled={busy}
          onClick={() => send({ intent: "deny" })}
          size="lg"
          variant="secondary"
        >
          Deny
        </Button>
        <Button
          className="flex-2"
          disabled={!ready}
          loading={busy}
          loadingLabel="Checking…"
          size="lg"
          type="submit"
        >
          Allow
        </Button>
      </div>
    </form>
  );
};

const SignedInAs = ({ user }: { user: { email: string; name: string } }) => (
  <Form action="/sign-out" className="text-small text-muted" method="post">
    Signed in as {user.name}
    {user.email && ` · ${user.email}`} ·{" "}
    <button className="font-bold text-primary hover:text-ink" type="submit">
      Not you?
    </button>
  </Form>
);

/** The consent card's shell: the brand, the card, and who is signed in below it. */
export const ConsentFrame = ({
  children,
  user,
}: {
  children: ReactNode;
  user?: { email: string; name: string };
}) => (
  <CenteredFrame className="max-w-140 gap-5">
    {children}
    {user && (
      <div className="border-t border-border pt-4">
        <SignedInAs user={user} />
      </div>
    )}
  </CenteredFrame>
);

/** G-10: the page an agent opens to get a personal token, outside the frame. */
export const ConsentPage = ({ data }: { data: ConsentData }) => (
  <ConsentFrame user={data.user}>
    {data.view === "form" ? (
      <ConsentForm data={data} />
    ) : data.view === "expired" ? (
      <End
        body="Go back to the app and start sign-in again."
        icon={<X strokeWidth={3} />}
        title="This request expired"
        tone="warn"
      />
    ) : (
      <End
        body="This page needs to be opened by an app. Start sign-in again from the app you are connecting."
        icon={<CircleHelp />}
        title="Can't continue this sign-in"
        tone="warn"
      />
    )}
  </ConsentFrame>
);

/** What stands in for the card while a navigation loads it. */
export const ConsentSkeleton = () => (
  <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-3.5" role="status">
    <Skeleton className="h-7 w-4/5" />
    <Skeleton className="h-3.5 w-3/5" />
    <Skeleton className="h-22 w-full" />
    <Skeleton className="h-12 w-full" />
  </div>
);
