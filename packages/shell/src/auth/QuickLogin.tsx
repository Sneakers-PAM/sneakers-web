import type { QuickLoginUser } from "@sneakers-web/api-client";

import {
  Badge,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sneakers-web/ui";
import { useId } from "react";
import { useSubmit } from "react-router";

/**
 * Dev builds only: sign in as a test user in one pick. A mock build offers the fixture users;
 * a live dev build offers the local accounts its server reads from the users file, and the
 * pick goes through the gateway's password step. The sign-in page loads this module only
 * when one of the build flags is set, so `check:no-mock` fails if it reaches a release build.
 */
export const QuickLogin = ({
  intent,
  next,
  users,
}: {
  intent: "dev-quick-login" | "mock-quick-login";
  next: string;
  users: QuickLoginUser[];
}) => {
  const id = useId();
  const submit = useSubmit();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Label id={id}>Dev quick login</Label>
        <Badge tone="warn">DEV</Badge>
      </div>
      <Select onValueChange={(userId) => void submit({ intent, next, userId }, { method: "post" })}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder="Sign in as a test user" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.note ? `${u.label} · ${u.note}` : u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
