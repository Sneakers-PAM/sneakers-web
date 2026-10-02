import { EmptyState, PageHeader } from "@sneakers-web/ui";
import { useMatches } from "react-router";

const TITLES: Record<string, string> = {
  audit: "Audit trail",
  connections: "Connections",
  folders: "Shared folders",
  groups: "Groups",
  policies: "Password policies",
  "service-accounts": "Service accounts",
  targets: "Targets",
  types: "Secret types",
  users: "Users",
};

/** A page whose screen hasn't been built yet. */
const ComingSoon = () => {
  const id = useMatches().at(-1)?.id ?? "";
  return (
    <>
      <PageHeader title={TITLES[id] ?? "Coming soon"} />
      <EmptyState
        body="This screen is part of the admin console screens still to come."
        title="Not built yet"
      />
    </>
  );
};

export default ComingSoon;
