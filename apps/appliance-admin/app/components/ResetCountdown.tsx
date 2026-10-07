import { Alert, Button, Countdown } from "@sneakers-web/ui";

import type { FactoryReset } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { power } from "@/lib/osadmin/client";

/**
 * A factory reset its quorum approved, counting down to the reset, with the one big Cancel any
 * admin may press. Shown on Status and on Power.
 */
export const ResetCountdown = ({
  onCancelled,
  reset,
}: {
  onCancelled: () => void;
  reset: FactoryReset;
}) => (
  <Alert
    role="alert"
    title={
      <>
        Factory reset in <Countdown label="Factory reset" until={Date.parse(reset.runsAt ?? "")} />
      </>
    }
    tone="danger"
  >
    <div className="flex flex-col gap-3">
      <p>
        Requested by {reset.startedBy}, approved by {reset.approvals.join(", ")}. When the timer
        ends, the appliance erases its state, backups and keys and starts over at first boot.
      </p>
      <div>
        <Button
          onClick={() =>
            void runAction(() => power.cancelFactoryReset(reset.id), { onSuccess: onCancelled })
          }
          size="lg"
          variant="primary"
        >
          Cancel the factory reset
        </Button>
      </div>
    </div>
  </Alert>
);
