import { RouteError } from "@sneakers-web/shell";
import { Button, EmptyState } from "@sneakers-web/ui";
import { isRouteErrorResponse, Link, useRevalidator, useRouteError } from "react-router";

/**
 * The browse page's error state: a missing folder says so; a failed load offers Retry. A
 * gateway that's down entirely gets the app's own screen.
 */
export const BrowseError = () => {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <EmptyState
        action={
          <Button asChild variant="secondary">
            <Link to="/browse">All folders</Link>
          </Button>
        }
        body="It may have been deleted or moved somewhere you can't see, or the link is wrong."
        title="Folder not found"
      />
    );
  }
  if (isRouteErrorResponse(error) && error.status === 503) return <RouteError />;
  return (
    <EmptyState
      action={
        <Button
          loading={revalidator.state === "loading"}
          onClick={() => void revalidator.revalidate()}
        >
          Retry
        </Button>
      }
      body="Something went wrong between the app and the server. Your folders are fine."
      loader={false}
      title="This folder didn't load"
    />
  );
};
