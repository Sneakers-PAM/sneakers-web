import { useUser } from "@sneakers-web/shell";
import { EmptyState, PageHeader } from "@sneakers-web/ui";

/** U-01. The tiles, quick cards and top secrets arrive with the staff screens. */
export const DashboardPage = () => {
  const user = useUser();
  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`${greeting()}, ${user.name}`} />
      <EmptyState
        body="Secrets, checkouts and requests show up here."
        title="Your dashboard is lacing up"
      />
    </>
  );
};

const greeting = (now = new Date()): string => {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
