import { Button } from "@sneakers-web/ui";
import { useState } from "react";
import {
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRevalidator,
  useRouteError,
} from "react-router";

import type { TerminalData } from "@/features/targets/terminal.server";

import { Console } from "@/features/targets/terminal/Console";
import { NoSession } from "@/features/targets/terminal/NoSession";

const BackToSecret = ({ id }: { id: string }) => (
  <Button asChild variant="secondary">
    <Link to={`/secret/${id}`}>Back to secret</Link>
  </Button>
);

/** U-12: the session, or the card that says why this secret has none. */
export const TerminalPage = () => {
  const { secret, session } = useLoaderData<TerminalData>();
  switch (session.kind) {
    case "locked": {
      return (
        <NoSession
          actions={
            <>
              <Button asChild>
                <Link to={`/requests?new=${secret.id}`}>Request access</Link>
              </Button>
              <BackToSecret id={secret.id} />
            </>
          }
          body={`A terminal session uses ${secret.name}, so it needs read access to it. Ask for access first.`}
          title="You can't use this key yet"
        />
      );
    }
    case "not-ssh": {
      return (
        <NoSession
          actions={
            <>
              <Button asChild>
                <Link to={`/secret/${secret.id}/edit`}>Attach a target</Link>
              </Button>
              <BackToSecret id={secret.id} />
            </>
          }
          body={`Terminal sessions need an SSH Key secret with a target reached over SSH. Attach a target to ${secret.name}, then try again.`}
          title="This secret isn't an SSH key bound to a target"
        />
      );
    }
    case "ready": {
      return <Console secret={secret} session={session} />;
    }
    case "retired": {
      return (
        <NoSession
          actions={<BackToSecret id={secret.id} />}
          body={`${secret.name} is retired, so it can't open sessions any more.`}
          title="This key is retired"
        />
      );
    }
  }
};

/** The terminal's error screen: a missing secret, or a load that failed, with Retry. */
export const TerminalError = () => {
  const error = useRouteError();
  const { revalidate, state } = useRevalidator();
  const [retrying, setRetrying] = useState(false);
  if (isRouteErrorResponse(error) && error.status === 404)
    return (
      <NoSession
        actions={
          <Button asChild variant="secondary">
            <Link to="/">Back to the dashboard</Link>
          </Button>
        }
        body="That secret doesn't exist, or you can't see it."
        title="No such secret"
      />
    );
  return (
    <NoSession
      actions={
        <>
          <Button
            loading={retrying && state === "loading"}
            onClick={() => {
              setRetrying(true);
              void revalidate();
            }}
          >
            Retry
          </Button>
          <Button asChild variant="secondary">
            <Link to="/">Back to the dashboard</Link>
          </Button>
        </>
      }
      body="The server didn't answer. Nothing was opened, and the key stays in the vault."
      title="The terminal didn't load"
    />
  );
};
