import type { LoaderFunctionArgs } from "react-router";

import { PageHeader } from "@sneakers-web/ui";
import { useLoaderData, useNavigation, useRouteLoaderData } from "react-router";

import type { loader as frameLoader } from "@/routes/frame";

import { AgentWaitingCard } from "@/features/dashboard/AgentWaitingCard";
import { CheckedOutCard } from "@/features/dashboard/CheckedOutCard";
import { loadDashboard } from "@/features/dashboard/dashboard.server";
import { DashboardSkeleton } from "@/features/dashboard/DashboardSkeleton";
import { greeting } from "@/features/dashboard/format";
import { GettingStarted } from "@/features/dashboard/GettingStarted";
import { LiveStamp } from "@/features/dashboard/LiveStamp";
import { LoadFailed } from "@/features/dashboard/LoadFailed";
import { PendingRequestCard } from "@/features/dashboard/PendingRequestCard";
import { StatTiles } from "@/features/dashboard/StatTiles";
import { TopSecrets } from "@/features/dashboard/TopSecrets";

export const loader = ({ request }: LoaderFunctionArgs) => loadDashboard(request);

export const meta = () => [{ title: "Dashboard · Sneakers-PAM" }];

const attention = (n: number): string =>
  n === 0
    ? "Nothing needs you right now. Everything looks healthy."
    : `${n === 1 ? "1 thing needs" : `${n} things need`} you. Everything else looks healthy.`;

/** U-01: quick cards for what needs the user now, the stat tiles, and the most-opened secrets. */
const Home = () => {
  const frame = useRouteLoaderData<typeof frameLoader>("routes/frame");
  const data = useLoaderData<typeof loader>() as Awaited<ReturnType<typeof loader>> | undefined;
  const navigation = useNavigation();
  const name = frame?.user.name ?? "";
  const reloading = navigation.state === "loading" && navigation.location.pathname === "/";

  if (!data || reloading)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Dashboard" title={`${greeting()}, ${name}`} />
        <DashboardSkeleton />
      </div>
    );

  if (!data.ok)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader eyebrow="Dashboard" title={`${greeting()}, ${name}`} />
        <LoadFailed failure={data.failure} title="Couldn't load your dashboard" />
      </div>
    );

  const fresh = data.stats.total === 0;
  const cards = [data.agents, data.checkouts, data.requests].filter((c) => c.length > 0).length;
  return (
    <div className="flex flex-col gap-5 tablet:gap-6">
      <PageHeader
        actions={<LiveStamp loadedAt={data.loadedAt} />}
        eyebrow="Dashboard"
        subtitle={fresh ? "Your vault is empty for now. Here is how to start." : attention(cards)}
        title={fresh ? `Welcome, ${name}` : `${greeting()}, ${name}`}
      />
      {cards > 0 && (
        <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          <AgentWaitingCard agents={data.agents} />
          <CheckedOutCard checkouts={data.checkouts} />
          <PendingRequestCard requests={data.requests} />
        </div>
      )}
      {fresh && <GettingStarted hasSecondFactor={!frame?.mfaSetupRecommended} />}
      <StatTiles stats={data.stats} />
      <TopSecrets now={data.loadedAt} secrets={data.top} />
    </div>
  );
};

export default Home;
