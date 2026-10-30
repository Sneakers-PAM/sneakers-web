import { Check, SquareTerminal, X } from "lucide-react";
import { Link } from "react-router";

import type { CliReason, CliSignedInData } from "@/features/agents/cliSignedIn.server";

import { ConsentFrame, End } from "@/features/agents/ConsentPage";

const Command = ({ children }: { children: string }) => (
  <code className="rounded-md bg-sunken px-1.5 py-0.5 font-mono text-[0.9em] text-ink">
    {children}
  </code>
);

const FAILURES: Record<CliReason, { body: string; title: (name: string) => string }> = {
  denied: {
    body: "You denied the request, so no token was made.",
    title: () => "Sign-in denied",
  },
  exchange: {
    body: "You approved it, but the token couldn't be fetched. The terminal shows the reason.",
    title: (name) => `${name} couldn't finish signing in`,
  },
  failed: {
    body: "The terminal shows the reason.",
    title: (name) => `${name} couldn't sign in`,
  },
  state: {
    body: "The browser came back to a sign-in this terminal didn't start, so it was ignored.",
    title: () => "This sign-in didn't match",
  },
};

/** Where the command-line sign-in ends in the browser: signed in, or why not. */
export const CliSignedIn = ({ data }: { data: CliSignedInData }) => {
  const run = data.command ?? "sneakers-put";
  if (data.reason) {
    const f = FAILURES[data.reason];
    return (
      <ConsentFrame user={data.user}>
        <End
          body={f.body}
          icon={data.reason === "denied" ? <X strokeWidth={3} /> : <SquareTerminal />}
          title={f.title(data.command ?? "The command line")}
          tone={data.reason === "denied" ? "neutral" : "warn"}
        >
          <p className="m-0 text-body leading-normal">
            To try again, run <Command>{`${run} login`}</Command> in the terminal.
          </p>
        </End>
      </ConsentFrame>
    );
  }
  return (
    <ConsentFrame user={data.user}>
      <End
        body={
          <>
            It can now use Sneakers-PAM as <b className="text-ink">{data.user.name}</b>. You can
            close this tab and go back to the terminal.
          </>
        }
        icon={<Check strokeWidth={3} />}
        title={`${data.command ?? "The command line"} is signed in`}
        tone="ok"
      >
        <p className="m-0 text-small leading-normal text-muted">
          Its token is listed under{" "}
          <Link className="font-bold text-primary hover:text-ink" to="/tokens">
            My tokens
          </Link>
          , where you can revoke it.
        </p>
      </End>
    </ConsentFrame>
  );
};
