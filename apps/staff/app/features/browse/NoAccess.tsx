import { Button, Card, Mark } from "@sneakers-web/ui";
import { Link } from "react-router";

const names = (owners: { name: string }[]): string => {
  const list = owners.map((o) => o.name);
  if (list.length <= 1) return list[0] ?? "";
  return `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
};

/** U-03 No access: the folder exists and is listed, but nothing in it is shared with you. */
export const NoAccess = ({ folder, owners }: { folder: string; owners: { name: string }[] }) => {
  const who = names(owners);
  return (
    <Card className="flex flex-col items-start gap-6 p-7 tablet:flex-row tablet:items-center tablet:gap-10 tablet:px-11">
      <Mark className="shrink-0" hole="var(--color-surface)" size={112} />
      <div className="flex flex-col gap-3">
        <h2 className="m-0 font-display text-h2 font-bold">You can&apos;t open this folder</h2>
        <p className="m-0 max-w-[32rem] text-body text-muted">
          You can see that {folder} exists, but nobody has shared its secrets with you.
          {who && ` ${who} ${owners.length === 1 ? "owns" : "own"} it.`}
        </p>
        <div className="flex flex-wrap gap-2.5 pt-1">
          <Button asChild variant="secondary">
            <Link to="/">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
};
