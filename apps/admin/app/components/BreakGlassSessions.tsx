import type { AdminBreakGlassSessionsQuery } from "@sneakers-web/api-client";

import { Button, Card, clockTime, Pill, plural, shortDate } from "@sneakers-web/ui";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";

export type BreakGlassSessionRow = AdminBreakGlassSessionsQuery["breakGlassSessions"][number];

const ENDED: Record<string, string> = {
  exit: "Exited",
  expired: "Expired after 15 minutes",
  replaced: "Replaced by a new session",
};

const at = (iso: string) => `${shortDate(iso)} ${clockTime(iso)}`;

const Session = ({ s }: { s: BreakGlassSessionRow }) => {
  const [open, setOpen] = useState(false);
  const count = s.reveals.length;
  return (
    <li
      aria-label={`${s.actorName}, ${at(s.openedAt)}`}
      className="flex flex-col gap-2 border-b border-border px-5.5 py-4 last:border-b-0"
      role="group"
    >
      <div className="grid gap-x-4 gap-y-1 tablet:grid-cols-[11rem_minmax(0,1fr)]">
        <span className="font-mono text-small">{at(s.openedAt)}</span>
        <span>
          <b className="text-danger">Entered break-glass</b> · <b>{s.actorName}</b> · {s.reason}
        </span>
        <span className="font-mono text-small">{s.endedAt ? at(s.endedAt) : "—"}</span>
        <span>
          <b>Left break-glass</b> ·{" "}
          {s.endedAt
            ? (ENDED[s.endReason ?? ""] ?? "Ended")
            : `Still open, ends ${clockTime(s.expiresAt)}`}
        </span>
      </div>
      {count > 0 ? (
        <div className="flex flex-col gap-2">
          <Button
            aria-expanded={open}
            className="self-start"
            onClick={() => setOpen(!open)}
            size="sm"
            variant="secondary"
          >
            {open ? "Hide" : "Show"} {plural(count, "secret")} revealed
          </Button>
          {open && (
            <ul
              aria-label="Secrets revealed"
              className="m-0 flex list-none flex-col gap-1.5 rounded-lg bg-sunken p-3 text-small"
            >
              {s.reveals.map((r) => (
                <li className="flex flex-wrap items-center gap-2" key={r.eventId}>
                  <span className="font-mono">{clockTime(r.revealedAt)}</span>
                  <b>{r.secretName || r.secretId}</b>
                  {r.ownerNotified && <Pill tone="danger">owners alerted</Pill>}
                  {r.postRotationScheduled && <Pill tone="warn">rotation queued</Pill>}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <span className="text-small text-muted">No secrets were revealed.</span>
      )}
    </li>
  );
};

/** Each break-glass session as one entered and one left entry, expandable to its reveals. */
export const BreakGlassSessions = ({ sessions }: { sessions: BreakGlassSessionRow[] }) => {
  if (sessions.length === 0) return null;
  return (
    <Card>
      <section aria-labelledby="break-glass-sessions">
        <h2
          className="m-0 flex items-center gap-2 border-b border-border px-5.5 py-4 font-display text-[1.125rem] font-bold"
          id="break-glass-sessions"
        >
          <TriangleAlert aria-hidden className="size-4 text-danger" />
          Break-glass sessions
        </h2>
        <ul className="m-0 flex list-none flex-col p-0">
          {sessions.map((s) => (
            <Session key={s.id} s={s} />
          ))}
        </ul>
      </section>
    </Card>
  );
};
