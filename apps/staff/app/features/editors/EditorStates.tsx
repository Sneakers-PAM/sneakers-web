import { Alert, Button, Card, EmptyState, PageHeader, Skeleton } from "@sneakers-web/ui";
import { RotateCw } from "lucide-react";
import { Link, useRevalidator } from "react-router";

import type { LoadFailure } from "@/features/editors/editors.server";

/** The form while it loads: the header and the two cards, drawn as blocks. */
export const EditorSkeleton = () => (
  <div aria-busy className="flex flex-col gap-6" role="status">
    <span className="sr-only">Loading the editor…</span>
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-10 w-72 max-w-full" />
    </div>
    {[4, 6].map((rows) => (
      <Card className="grid gap-4 p-6 tablet:grid-cols-2" key={rows}>
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton className="h-11" key={index} />
        ))}
      </Card>
    ))}
  </div>
);

/** The form's data didn't load, or the person can't edit this secret: why, and Retry if it helps. */
export const EditorLoadFailed = ({ failure, title }: { failure: LoadFailure; title: string }) => {
  const revalidator = useRevalidator();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Secret" title={title} />
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
        title={failure.retry ? "Couldn't load the form" : "Couldn't open the editor"}
        tone={failure.retry ? "danger" : "warn"}
      >
        {failure.message}
      </Alert>
    </div>
  );
};

/** Nobody has made the person an owner of any folder, so a new secret has nowhere to go. */
export const NoFolders = () => (
  <div className="flex flex-col gap-6">
    <PageHeader eyebrow="Secret" title="New secret" />
    <EmptyState
      action={
        <Button asChild variant="secondary">
          <Link to="/browse">Browse folders</Link>
        </Button>
      }
      body="New secrets go in a folder you own. Ask a folder's owner to add you, or a site admin to make you a folder."
      title="There's nowhere you can add a secret yet"
    />
  </div>
);
