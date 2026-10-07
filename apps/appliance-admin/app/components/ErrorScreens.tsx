import { CenteredFrame, CopyDiagnostics, FrameTitle } from "@sneakers-web/shell";
import { Button } from "@sneakers-web/ui";
import { Link } from "react-router";

const ACCESS_COPY = {
  401: {
    body: "Your session ended, or never started. Sign in again to continue.",
    title: "Sign in again",
  },
  403: {
    body: "Your role doesn't allow this. Ask an owner if you need access.",
    title: "Not allowed",
  },
} as const;

/** 401 (no session) or 403 (session, but not allowed): the real pages, not a generic crash. */
export const AccessScreen = ({ status }: { status: 401 | 403 }) => {
  const { body, title } = ACCESS_COPY[status];
  return (
    <CenteredFrame>
      <FrameTitle body={body} title={title} />
      <div className="flex flex-wrap gap-2.5">
        <Button asChild>
          <Link to="/">Go to the start</Link>
        </Button>
        <CopyDiagnostics problem={{ message: title }} size="md" />
      </div>
    </CenteredFrame>
  );
};

/** A 5xx that isn't the gateway-unreachable case (that's shell's OfflineScreen, 503). */
export const ServerErrorScreen = () => (
  <CenteredFrame>
    <FrameTitle
      body="The box hit a problem answering that. Try again in a moment."
      title="The box had a problem"
    />
    <div className="flex flex-wrap gap-2.5">
      <Button onClick={() => globalThis.location.reload()}>Reload page</Button>
      <Button asChild variant="secondary">
        <Link to="/">Go to the start</Link>
      </Button>
      <CopyDiagnostics problem={{ message: "The box had a problem" }} size="md" />
    </div>
  </CenteredFrame>
);
