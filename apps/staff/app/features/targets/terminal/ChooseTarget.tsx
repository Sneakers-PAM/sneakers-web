import { EdgeBanner } from "@sneakers-web/shell";
import { Button, Wordmark } from "@sneakers-web/ui";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

/**
 * #168: a secret attached to more than one usable target needs one picked before a session can
 * open. Each choice links to the same page with ?target=<id>, so refreshing or bookmarking the
 * link keeps it, and the Console's reconnect reuses the id already in the session.
 */
export const ChooseTarget = ({
  secret,
  targets,
}: {
  secret: { id: string; name: string };
  targets: { hostname: string; id: string; name: string }[];
}) => (
  <div className="flex min-h-dvh flex-col bg-bg text-ink">
    <EdgeBanner />
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Wordmark className="text-[1.5rem]" />
      <section className="flex w-full max-w-[480px] flex-col gap-4.5 rounded-[24px] border border-border bg-surface p-6 shadow-menu tablet:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[1.5rem] leading-[1.15] font-bold">
            Choose a target
          </h1>
          <p className="m-0 text-body leading-[1.5] text-muted">
            {secret.name} is attached to more than one target. Pick which one to open a session on.
          </p>
        </div>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {targets.map((t) => (
            <li key={t.id}>
              <Link
                aria-label={`${t.name}, ${t.hostname}`}
                className="flex items-center justify-between gap-3 rounded-[14px] border-[1.5px] border-border-strong bg-surface px-4 py-3 no-underline hover:border-control"
                to={`/secret/${secret.id}/terminal?target=${t.id}`}
              >
                <span aria-hidden className="flex min-w-0 flex-col">
                  <b className="truncate text-body font-bold text-ink">{t.name}</b>
                  <span className="truncate font-mono text-small text-muted">{t.hostname}</span>
                </span>
                <ChevronRight aria-hidden className="shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
        <Button asChild variant="secondary">
          <Link to={`/secret/${secret.id}`}>Back to secret</Link>
        </Button>
      </section>
    </main>
  </div>
);
