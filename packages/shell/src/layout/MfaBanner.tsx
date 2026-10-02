import { Button, useSessionValue } from "@sneakers-web/ui";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { useRootData } from "#shell/root/useRootData";

/**
 * The nudge for an account with no second factor (when MFA is optional). "Set up now" opens
 * the enrolment page; "Remind me later" hides the nudge until this browser tab closes.
 */
export const MfaBanner = ({ show }: { show: boolean }) => {
  const { storagePrefix } = useRootData();
  const key = `${storagePrefix}sneakers.mfa-nudge-snoozed`;
  const { pathname, search } = useLocation();
  const [writes, setWrites] = useState(0);
  const snoozed = useSessionValue(key, writes) === "1";
  if (!show || snoozed) return null;
  return (
    <div
      aria-label="Account security"
      className="flex flex-none flex-wrap items-center gap-3.5 border-b-[1.5px] border-warn bg-warn-soft px-5 py-3"
      role="region"
    >
      <TriangleAlert aria-hidden className="size-4 text-warn" strokeWidth={2.5} />
      <span className="text-body leading-[1.4]">
        <b>Add a second factor to your account.</b> Without one, anyone with your password can sign
        in as you.
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button asChild size="sm" variant="ink">
          <Link to={`/enroll?next=${encodeURIComponent(pathname + search)}`}>Set up now</Link>
        </Button>
        <Button
          className="text-ink hover:bg-transparent hover:underline"
          onClick={() => {
            sessionStorage.setItem(key, "1");
            setWrites((n) => n + 1);
          }}
          size="sm"
          variant="ghost"
        >
          Remind me later
        </Button>
      </div>
    </div>
  );
};
