import { Card, Skeleton } from "@sneakers-web/ui";

/** The Security page while it loads: three method rows. */
export const SecuritySkeleton = () => (
  <Card className="flex max-w-160 flex-col gap-6 px-5.5 py-5" data-testid="security-loading">
    {[0, 1, 2].map((n) => (
      <div className="flex items-center gap-4" key={n}>
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
    ))}
  </Card>
);
