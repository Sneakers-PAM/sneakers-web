import { RouteError, routeErrorRefusal } from "@sneakers-web/shell";
import { Alert, Button, EmptyState, Skeleton } from "@sneakers-web/ui";
import {
  isRouteErrorResponse,
  Link,
  useLocation,
  useRevalidator,
  useRouteError,
} from "react-router";

export const SharingSkeleton = () => (
  <div aria-busy className="flex flex-col gap-3.5" data-testid="sharing-skeleton">
    <Skeleton className="h-16 w-2/3 rounded-lg" />
    <Skeleton className="h-30 rounded-xl" />
    <Skeleton className="h-65 rounded-xl" />
  </div>
);

/** The sharing page's error state: missing says so, a failed load offers Retry. */
export const SharingError = () => {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const secret = useLocation().pathname.startsWith("/secret/");
  const refusal = routeErrorRefusal(error);
  if (refusal) {
    return (
      <EmptyState
        action={
          <Button asChild variant="secondary">
            <Link to="/browse">All folders</Link>
          </Button>
        }
        body={
          <>
            This {secret ? "secret" : "folder"} doesn&apos;t exist, or you don&apos;t have access to
            it.
            {refusal.metadata.id && (
              <>
                <br />
                <span className="font-mono text-small text-muted">{refusal.metadata.id}</span>
              </>
            )}
          </>
        }
        title={secret ? "Secret not found" : "Folder not found"}
      />
    );
  }
  if (isRouteErrorResponse(error) && error.status === 503) return <RouteError />;
  return (
    <Alert
      action={
        <Button
          loading={revalidator.state === "loading"}
          onClick={() => void revalidator.revalidate()}
          variant="ink"
        >
          Retry
        </Button>
      }
      role="alert"
      title="Couldn't load sharing"
      tone="danger"
    >
      The server didn&apos;t answer. Your access hasn&apos;t changed.
    </Alert>
  );
};
