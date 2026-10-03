import { Button, EmptyState } from "@sneakers-web/ui";
import { useState } from "react";
import { useRevalidator } from "react-router";

import { SecuritySkeleton } from "@/features/settings/SecuritySkeleton";

/** The page's error state: what failed and a Retry, with the skeleton while it reloads. */
export const SecurityFailure = () => {
  const { revalidate, state } = useRevalidator();
  const [retrying, setRetrying] = useState(false);
  if (retrying && state === "loading") return <SecuritySkeleton />;
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
      body="The server didn't answer. Your sign-in methods haven't changed; try again in a moment."
      className="max-w-160"
      loader={false}
      title="Security didn't load"
    />
  );
};
