import { Button, clockTime } from "@sneakers-web/ui";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Link, useFetcher, useRevalidator } from "react-router";

/** An open break-glass session, as the frame shows it. */
export interface BreakGlassState {
  expiresAt: string;
  id: string;
  openedAt: string;
  reason: string;
}

const MAX_TIMEOUT_MS = 2_147_483_647;

/** Where each app's banner posts its Exit. */
export const BREAK_GLASS_ROUTE = "/resources/break-glass";

/**
 * Shown on every page while the signed-in admin is in break-the-glass mode, with an Exit. At
 * the session's expiry the page reloads its data, so the banner goes and the normal app returns.
 * `browse` links to the break-glass view: a path in this app, or a URL in the other one.
 */
export const BreakGlassBanner = ({
  browse,
  session,
}: {
  browse?: { href: string; inApp: boolean };
  session: BreakGlassState | null;
}) => {
  const exit = useFetcher();
  const { revalidate } = useRevalidator();
  const expiresAt = session?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    // setTimeout takes at most 2^31 - 1 ms; a longer wait would fire at once.
    const wait = Math.min(Math.max(Date.parse(expiresAt) - Date.now(), 0) + 1000, MAX_TIMEOUT_MS);
    const timer = setTimeout(() => void revalidate(), wait);
    return () => clearTimeout(timer);
  }, [expiresAt, revalidate]);
  if (!session) return null;
  const leaving = exit.state !== "idle";
  return (
    <div
      aria-label="Break-the-glass mode"
      className="flex flex-none flex-wrap items-center gap-3.5 border-b-[1.5px] border-danger bg-danger-soft px-5 py-3"
      role="status"
    >
      <TriangleAlert aria-hidden className="size-4 text-danger" strokeWidth={2.5} />
      <span className="min-w-0 flex-1 text-body leading-[1.4]">
        <b>You&apos;re in break-the-glass mode.</b> You can see every folder and secret. Each reveal
        is recorded and the secret&apos;s owners are alerted. Ends at {clockTime(session.expiresAt)}
        .
      </span>
      {browse &&
        (browse.inApp ? (
          <Button asChild size="sm" variant="secondary">
            <Link to={browse.href}>All secrets</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="secondary">
            <a href={browse.href}>All secrets</a>
          </Button>
        ))}
      <exit.Form action={BREAK_GLASS_ROUTE} method="post">
        <input name="id" type="hidden" value={session.id} />
        <Button loading={leaving} loadingLabel="Leaving…" size="sm" type="submit" variant="danger">
          Exit break-glass
        </Button>
      </exit.Form>
    </div>
  );
};
