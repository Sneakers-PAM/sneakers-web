import { Button, EmptyState } from "@sneakers-web/ui";
import { useState } from "react";
import { useRevalidator } from "react-router";

import { ListSkeleton } from "@/features/requests/ListSkeleton";

/**
 * A page's error state inside the frame: what failed and a Retry. While the retry loads, the
 * page's skeleton stands in.
 */
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
      body="The server didn't answer. Your data is safe; try again in a moment."
      loader={false}
      title={title}
    />
  );
};
