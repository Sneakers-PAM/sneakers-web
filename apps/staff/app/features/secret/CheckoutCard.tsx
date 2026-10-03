import { Button, clockTime, Countdown, Pill, Segmented } from "@sneakers-web/ui";

import type { SecretPage } from "@/features/secret/secret.server";

import { Panel } from "@/features/secret/Panel";

export const LEASE_CHOICES = ["1", "2", "4"] as const;
export type LeaseHours = (typeof LEASE_CHOICES)[number];

/** Check-out for types that need it: free, held by you (with time left), or held by someone else. */
export const CheckoutCard = ({
  busy,
  hours,
  onCheckIn,
  onCheckOut,
  onHours,
  page,
}: {
  busy: boolean;
  hours: LeaseHours;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onHours: (hours: LeaseHours) => void;
  page: SecretPage;
}) => {
  const { lease, viewerId } = page;
  const mine = !!lease && lease.userId === viewerId;
  return (
    <Panel
      aside={
        lease ? (
          <Pill tone={mine ? "ok" : "warn"}>{mine ? "Held by you" : "Checked out"}</Pill>
        ) : (
          <Pill tone="ok">Available</Pill>
        )
      }
      title="Checkout"
    >
      <div className="flex flex-col gap-4 px-6 py-5">
        {mine ? (
          <>
            <div className="flex flex-col gap-1.5 rounded-lg bg-ok-soft px-4 py-3">
              <b>Checked out by you</b>
              <span className="flex flex-wrap items-center gap-2">
                Expires {clockTime(lease.expiresAt)}
                <Countdown label="Time left" until={Date.parse(lease.expiresAt)} />
              </span>
            </div>
            <p className="m-0 text-small text-muted">
              Check in when you&apos;re done. The password rotates to a new value nobody has seen.
            </p>
            <Button
              block
              loading={busy}
              loadingLabel="Checking in…"
              onClick={onCheckIn}
              variant="ink"
            >
              Check in now
            </Button>
          </>
        ) : lease ? (
          <p className="m-0">
            Someone else has it checked out until <b>{clockTime(lease.expiresAt)}</b>. Break glass
            only if it can&apos;t wait.
          </p>
        ) : (
          <>
            <p className="m-0">
              Check out to rotate, verify, and reveal for a limited window. When you check in, the
              password rotates again and the value you saw stops working.
            </p>
            <div className="flex items-center gap-3">
              <b className="text-small">Lease</b>
              <Segmented
                label="Lease length"
                onChange={onHours}
                options={LEASE_CHOICES.map((h) => ({ label: `${h}h`, value: h }))}
                size="sm"
                value={hours}
              />
            </div>
            <Button
              block
              disabled={!page.access.read}
              loading={busy}
              loadingLabel="Checking out…"
              onClick={onCheckOut}
            >
              Check out for {hours} {hours === "1" ? "hour" : "hours"}
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
};
