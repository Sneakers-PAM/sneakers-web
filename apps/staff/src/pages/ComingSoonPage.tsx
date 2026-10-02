import { EmptyState, PageHeader } from "@sneakers-web/ui";

/** A page whose screen hasn't been built yet. */
export const ComingSoonPage = ({ title }: { title: string }) => {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        body="This screen is part of the next set of staff screens."
        title="Not built yet"
      />
    </>
  );
};
