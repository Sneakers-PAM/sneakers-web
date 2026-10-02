import { type Refusal, refusalMessage } from "@sneakers-web/shell";
import { RouteError } from "@sneakers-web/shell";
import { Button, EmptyState } from "@sneakers-web/ui";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

/**
 * A page's error boundary inside the console frame: a refusal (403) or a missing item (404)
 * says so in place, with a way back. Anything else falls through to the app's error screen.
 */
export const PageError = ({
  back = "/",
  backLabel = "Back",
}: {
  back?: string;
  backLabel?: string;
}) => {
  const error = useRouteError();
  if (!isRouteErrorResponse(error) || (error.status !== 403 && error.status !== 404))
    return <RouteError />;
  const refusal = error.data as Partial<Refusal> | undefined;
  return (
    <EmptyState
      action={
        <Button asChild variant="secondary">
          <Link to={back}>{backLabel}</Link>
        </Button>
      }
      body={
        refusal?.detail === undefined
          ? "It may have been deleted, or the link is wrong."
          : refusalMessage({ detail: "", metadata: {}, ...refusal } as Refusal)
      }
      title={error.status === 404 ? "Not found" : "You can't open this"}
    />
  );
};
