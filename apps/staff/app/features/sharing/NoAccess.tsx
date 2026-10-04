import { Button, Card, SneakerLoader } from "@sneakers-web/ui";
import { Link } from "react-router";

import type { NoAccessData } from "@/features/sharing/types";

const either = (names: string[]) => {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
};

/** U-07 no access: the user can't read the folder or secret, so sees only who to ask. */
export const NoAccess = ({ data, id }: { data: NoAccessData; id: string }) => {
  const thing = data.kind === "folder" ? "folder" : "secret";
  const who = either(data.ownerNames);
  return (
    <Card className="flex flex-col items-start gap-6 p-7 tablet:flex-row tablet:items-center tablet:gap-7 tablet:p-10">
      <SneakerLoader className="shrink-0" hole="var(--color-surface)" size={120} />
      <div className="flex max-w-[35rem] flex-col gap-2.5">
        <h2 className="m-0 font-display text-[1.625rem] leading-[1.15] font-bold">
          You don&apos;t have access to manage this {thing}
        </h2>
        <p className="m-0 text-body leading-normal text-muted">
          Only its owners can see or change who has access.
          {who
            ? ` Ask ${who}, or request access to the secrets you need.`
            : " Request access to the secrets you need."}
        </p>
        <div className="flex flex-wrap gap-2.5 pt-1.5">
          {data.kind === "secret" && (
            <Button asChild>
              <Link to={`/requests?new=${id}`}>Request access</Link>
            </Button>
          )}
          <Button asChild variant="secondary">
            <Link to={data.backTo}>Back to {thing}</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
};
