import { Alert, Button } from "@sneakers-web/ui";
import { RotateCw } from "lucide-react";
import { useRevalidator } from "react-router";

import type { LoadFailure } from "@/features/dashboard/dashboard.server";

/** A page's data didn't load: what went wrong, and Retry when another try could help. */
export const LoadFailed = ({ failure, title }: { failure: LoadFailure; title: string }) => {
  const revalidator = useRevalidator();
  return (
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
      title={title}
      tone={failure.retry ? "danger" : "warn"}
    >
      {failure.message}
    </Alert>
  );
};
