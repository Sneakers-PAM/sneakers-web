import { Card, Skeleton } from "@sneakers-web/ui";

/** What the folder pane shows while the next folder loads. */
export const BrowseSkeleton = () => {
  return (
    <div aria-busy className="flex flex-col gap-6" data-testid="browse-skeleton">
      <span className="sr-only" role="status">
        Loading folder…
      </span>
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-4 w-44" />
      </div>
      <Card className="flex flex-col gap-3 p-4.5">
        <Skeleton className="h-11 w-full max-w-80" />
        {Array.from({ length: 5 }, (_, index) => (
          <Skeleton className="h-10 w-full" key={index} />
        ))}
      </Card>
    </div>
  );
};
