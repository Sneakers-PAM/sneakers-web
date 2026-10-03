import { Card, Skeleton } from "@sneakers-web/ui";

/** Grey rows standing in for a page's lists while they load. */
export const ListSkeleton = ({ rows = 3, testId }: { rows?: number; testId: string }) => (
  <div
    aria-busy="true"
    aria-label="Loading"
    className="flex flex-col gap-6"
    data-testid={testId}
    role="status"
  >
    <Card>
      <div className="flex flex-col gap-4 p-5.5">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton className="h-10 w-full" key={index} />
        ))}
      </div>
    </Card>
  </div>
);
