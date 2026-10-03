import { Button, Card, EmptyState, Skeleton } from "@sneakers-web/ui";
import { useState } from "react";
import { useRevalidator } from "react-router";

/** Grey rows standing in for an agents list while it loads. */
export const ListSkeleton = ({ rows = 3, testId }: { rows?: number; testId: string }) => (
  <div aria-busy="true" aria-label="Loading" data-testid={testId} role="status">
    <Card>
      <div className="flex flex-col gap-4 p-5.5">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton className="h-10 w-full" key={index} />
        ))}
      </div>
    </Card>
  </div>
);

/** An agents page's error state: what failed and a Retry, with the skeleton while it retries. */
export const PageFailure = ({ testId, title }: { testId: string; title: string }) => {
  const { revalidate, state } = useRevalidator();
  const [retrying, setRetrying] = useState(false);
  if (retrying && state === "loading") return <ListSkeleton testId={testId} />;
  return (
    <EmptyState
      action={
        <Button
          onClick={() => {
            setRetrying(true);
            void revalidate();
          }}
          variant="secondary"
        >
          Retry
        </Button>
      }
      body="The server didn't answer. Nothing was changed; try again in a moment."
      loader={false}
      title={title}
    />
  );
};
