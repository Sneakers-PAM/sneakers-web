import { EmptyState, PageHeader } from "@sneakers-web/ui";
import { useMatches } from "react-router";

const TITLES: Record<string, string> = {
  approvals: "Agent approvals",
  checkouts: "Checkouts",
  grants: "Use grants",
  requests: "Requests",
  secrets: "Secrets",
  security: "Security",
  targets: "Targets",
  tokens: "My tokens",
};

/** A page whose screen hasn't been built yet. */
const ComingSoon = () => {
  const id = useMatches().at(-1)?.id ?? "";
  return (
    <>
      <PageHeader title={TITLES[id] ?? "Coming soon"} />
      <EmptyState
        body="This screen is part of the next set of staff screens."
        title="Not built yet"
      />
    </>
  );
};

export default ComingSoon;
