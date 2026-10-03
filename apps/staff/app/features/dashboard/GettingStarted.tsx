import { Card, cn, Mark } from "@sneakers-web/ui";
import { Check } from "lucide-react";
import { Link } from "react-router";

interface Step {
  body: string;
  done?: boolean;
  title: string;
  to: string;
}

/** U-01 for someone with nothing to see yet: four first steps, any of which can be skipped. */
export const GettingStarted = ({ hasSecondFactor }: { hasSecondFactor: boolean }) => {
  const steps: Step[] = [
    {
      body: "Authenticator app or passkey. Takes a minute.",
      done: hasSecondFactor,
      title: "Add a second factor",
      to: "/security",
    },
    {
      body: "Start in your private personal folder.",
      title: "Save your first secret",
      to: "/secret/new",
    },
    {
      body: "See what your team has shared with you.",
      title: "Look around shared folders",
      to: "/browse",
    },
    {
      body: "Let a script use secrets with your approval.",
      title: "Connect an AI agent",
      to: "/tokens",
    },
  ];
  return (
    <Card
      aria-label="Getting started"
      className="flex flex-col gap-6 p-5 tablet:flex-row tablet:items-center tablet:gap-8 tablet:p-6"
    >
      <div className="hidden shrink-0 justify-center tablet:flex tablet:w-50">
        <Mark size={168} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="m-0 font-display text-h2 font-bold">{"Let's lace up"}</h2>
          <p className="m-0 text-muted">Four steps to get going. You can skip any of them.</p>
        </div>
        <ul className="m-0 grid list-none gap-2.5 p-0 tablet:grid-cols-2">
          {steps.map((s) => (
            <li key={s.title}>
              <Link
                className="flex h-full items-start gap-3 rounded-lg border border-border px-3.5 py-3 text-ink no-underline hover:border-control hover:bg-sunken hover:text-ink"
                to={s.to}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px]",
                    s.done ? "border-ok bg-ok text-surface" : "border-control",
                  )}
                >
                  {s.done && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <b className="text-body">
                    {s.title}
                    {s.done && <span className="sr-only"> (done)</span>}
                  </b>
                  <span className="text-small text-muted">{s.body}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};
