import { Card, Skeleton } from "@sneakers-web/ui";

/** The tiles and the top list's outline while the dashboard loads. */
export const DashboardSkeleton = () => {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your dashboard"
      className="flex flex-col gap-5"
      role="status"
    >
      <div className="grid grid-cols-2 gap-3 tablet:gap-4 desktop:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card className="flex flex-col gap-3 px-5 py-4.5" key={index}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-16" />
            <Skeleton className="h-3.5 w-28" />
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-4 p-5.5">
        <Skeleton className="h-5 w-48" />
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton className="h-5 w-full" key={index} />
        ))}
      </Card>
    </div>
  );
};
