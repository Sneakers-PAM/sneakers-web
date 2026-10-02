import { EmptyState, PageHeader } from "@sneakers-web/ui";
import { useRouteLoaderData } from "react-router";

import type { loader as frameLoader } from "@/routes/frame";

const greeting = (now = new Date()): string => {
  const h = now.getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export const meta = () => [{ title: "Dashboard · Sneakers-PAM" }];

/** U-01. The tiles, quick cards and top secrets arrive with the staff screens. */
const Home = () => {
  const frame = useRouteLoaderData<typeof frameLoader>("routes/frame");
  return (
    <>
      <PageHeader eyebrow="Dashboard" title={`${greeting()}, ${frame?.user.name ?? ""}`} />
      <EmptyState
        body="Secrets, checkouts and requests show up here."
        title="Your dashboard is lacing up"
      />
    </>
  );
};

export default Home;
