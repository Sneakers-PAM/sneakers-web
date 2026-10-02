import { EmptyState, PageHeader } from "@sneakers-web/ui";

/** A page whose screen hasn't been built yet. */
export const ComingSoonPage = ({ title }: { title: string }) => {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState
        body="This screen is part of the admin console screens still to come."
        title="Not built yet"
      />
    </>
  );
};
