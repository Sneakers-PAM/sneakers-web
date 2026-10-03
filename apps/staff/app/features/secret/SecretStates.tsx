import { Alert, Button, Card, EmptyState, PageHeader, Skeleton } from "@sneakers-web/ui";
import { RotateCw } from "lucide-react";
import { Link, useRevalidator } from "react-router";

import type { LoadFailure } from "@/features/secret/secret.server";

/** The page while another secret loads: the header and the two columns, drawn as blocks. */
export const SecretSkeleton = () => (
  <div aria-busy className="flex flex-col gap-6" role="status">
    <span className="sr-only">Loading the secret…</span>
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-10 w-80 max-w-full" />
      <Skeleton className="h-4 w-56" />
    </div>
    <div className="grid gap-6 desktop:grid-cols-[minmax(0,1fr)_23.75rem]">
      <Card className="flex flex-col gap-4 p-6">
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-10" key={index} />
        ))}
      </Card>
      <Card className="flex flex-col gap-4 p-6">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-8" key={index} />
        ))}
      </Card>
    </div>
  </div>
);

/** The secret's data didn't load: why, and Retry when another try could help. */
export const SecretLoadFailed = ({ failure }: { failure: LoadFailure }) => {
  const revalidator = useRevalidator();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Secret" title="Secret" />
      <Alert
        action={
          failure.retry && (
            <Button
              loading={revalidator.state === "loading"}
              loadingLabel="Retrying…"
              onClick={() => void revalidator.revalidate()}
              size="sm"
              variant="secondary"
            >
              <RotateCw aria-hidden />
              Retry
            </Button>
          )
        }
        role="alert"
        title="Couldn't load this secret"
        tone={failure.retry ? "danger" : "warn"}
      >
        {failure.message}
      </Alert>
    </div>
  );
};

/** A secret that doesn't exist, or one the person can't see (the gateway doesn't say which). */
export const SecretNotFound = () => (
  <EmptyState
    action={
      <Button asChild variant="secondary">
        <Link to="/browse">Browse folders</Link>
      </Button>
    }
    body="It may have been deleted, or it's in a folder you can't see."
    title="Secret not found"
  />
);
