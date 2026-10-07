import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Countdown,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Label,
  PageHeader,
  shortDate,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type {
  ActiveSession,
  FactoryReset,
  GetPowerResponse,
  SessionKind,
} from "@/lib/osadmin/types";

import { ResetCountdown } from "@/components/ResetCountdown";
import { runAction } from "@/lib/osadmin/action";
import { power, status } from "@/lib/osadmin/client";
import { useSession } from "@/lib/useSession";

/** How often the page re-reads a factory reset in progress, to see other admins' approvals. */
const RESET_POLL_MS = 5000;

type Target = "reboot" | "shutdown";

const KIND_LABEL: Record<SessionKind, string> = {
  SESSION_KIND_BROWSER: "browser",
  SESSION_KIND_ELEVATED: "elevated shell",
  SESSION_KIND_SSH: "SSH",
  SESSION_KIND_UNSPECIFIED: "unknown",
};

export default function Power() {
  const { isOwner } = useSession();
  const [data, setData] = useState<GetPowerResponse>();
  const [sessions, setSessions] = useState<ActiveSession[]>();
  const [ending, setEnding] = useState<ActiveSession | null>(null);
  const [target, setTarget] = useState<null | Target>(null);
  const [forced, setForced] = useState(false);
  const [forcedConfirmed, setForcedConfirmed] = useState(false);

  const [hostname, setHostname] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const reload = () => void power.get().then(setData);
  // Not fatal: an older box without ListSessions still reboots, shuts down and factory resets.
  const reloadSessions = () =>
    void power
      .listSessions()
      .then((response) => setSessions(response.sessions))
      .catch(() => setSessions([]));
  useEffect(() => {
    reload();
    reloadSessions();
    void status.get().then((response) => setHostname(response.hostname));
  }, []);
  const resetInProgress = !!data?.factoryReset;
  useEffect(() => {
    if (!resetInProgress) return;
    const timer = setInterval(reload, RESET_POLL_MS);
    return () => clearInterval(timer);
  }, [resetInProgress]);

  const closeDialog = () => {
    setTarget(null);
    setForced(false);
    setForcedConfirmed(false);
  };

  const confirm = () => {
    if (!target) return;
    const call = target === "reboot" ? power.reboot : power.shutdown;
    void runAction(() => call(forced, forced && forcedConfirmed), {
      onSuccess: closeDialog,
      successMessage: `${target === "reboot" ? "Rebooting" : "Shutting down"}.`,
    });
  };

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Power" />
      <Card>
        <section aria-label="Active sessions">
          <CardHeader title="Active sessions" />
          <Table aria-label="Active sessions">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Admin</TableHeaderCell>
                <TableHeaderCell>Kind</TableHeaderCell>
                <TableHeaderCell>Source address</TableHeaderCell>
                <TableHeaderCell>Started</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(sessions ?? []).map((session) => (
                <TableRow aria-label={session.admin} key={session.id}>
                  <TableCell>{session.admin}</TableCell>
                  <TableCell>{KIND_LABEL[session.kind]}</TableCell>
                  <TableCell>{session.sourceAddress}</TableCell>
                  <TableCell>{session.signedIn ? shortDate(session.signedIn) : ""}</TableCell>
                  <TableCell>
                    {isOwner && (
                      <Button onClick={() => setEnding(session)} size="sm" variant="secondary">
                        End session
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex gap-3 border-t border-border p-5.5">
            <Button onClick={() => setTarget("reboot")} variant="secondary">
              Reboot
            </Button>
            <Button onClick={() => setTarget("shutdown")} variant="danger">
              Shut down
            </Button>
          </div>
        </section>
      </Card>
      <Card>
        <section aria-label="Factory reset">
          <CardHeader title="Factory reset" />
          <div className="flex flex-col gap-4 p-5.5 text-small">
            {cancelled && <Alert tone="info">The factory reset was cancelled.</Alert>}
            <FactoryResetSection
              data={data}
              hostname={hostname}
              onCancelled={() => {
                setCancelled(true);
                reload();
              }}
              onChanged={(reset) => {
                setCancelled(false);
                setData({ ...data, factoryReset: reset });
              }}
            />
          </div>
        </section>
      </Card>
      <Dialog onOpenChange={(open) => !open && closeDialog()} open={!!target}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target === "reboot" ? "Reboot" : "Shut down"} the appliance</DialogTitle>
            <DialogDescription>
              {data.sessions.length > 0
                ? `${String(data.sessions.length)} active session(s) will be ended.`
                : "No active sessions."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3">
            <Label className="flex items-center gap-3">
              <Switch checked={forced} onCheckedChange={(checked) => setForced(checked === true)} />
              Force (skip the drain)
            </Label>
          </div>
          {forced && (
            <Label className="flex items-start gap-2 text-small text-danger">
              <Checkbox
                checked={forcedConfirmed}
                onCheckedChange={(checked) => setForcedConfirmed(checked === true)}
              />
              I understand sessions will be cut and data in flight may be lost.
            </Label>
          )}
          <DialogFooter>
            <Button onClick={closeDialog} variant="secondary">
              Cancel
            </Button>
            <Button disabled={forced && !forcedConfirmed} onClick={confirm} variant="danger">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setEnding(null)} open={!!ending}>
        {ending && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>End {ending.admin}&apos;s session</DialogTitle>
              <DialogDescription>
                {ending.admin}&apos;s {KIND_LABEL[ending.kind]} session from {ending.sourceAddress}{" "}
                ends at once.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setEnding(null)} variant="secondary">
                Cancel
              </Button>
              <Button
                onClick={() =>
                  void runAction(() => power.endSession(ending.id), {
                    onSuccess: () => {
                      setEnding(null);
                      reloadSessions();
                    },
                  })
                }
                variant="danger"
              >
                End session
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

const WHAT_IT_DESTROYS =
  "A factory reset erases the state, backup and key-file partitions and every key that opens them, then starts over at first boot. The installed release and Secure Boot stay.";

const FactoryResetSection = ({
  data,
  hostname,
  onCancelled,
  onChanged,
}: {
  data: GetPowerResponse;
  hostname: string;
  onCancelled: () => void;
  onChanged: (reset: FactoryReset) => void;
}) => {
  const reset = data.factoryReset;
  if (reset?.state === "FACTORY_RESET_STATE_COUNTDOWN") {
    return <ResetCountdown onCancelled={onCancelled} reset={reset} />;
  }
  if (reset) return <PendingReset onCancelled={onCancelled} onChanged={onChanged} reset={reset} />;
  if (!data.factoryResetAvailable) {
    return (
      <>
        <p>{data.factoryResetUnavailableReason}</p>
        <p className="text-muted">
          With a single admin there&apos;s no factory reset in place: delete and re-create, or
          re-flash, the appliance instead.
        </p>
      </>
    );
  }
  return <RequestReset hostname={hostname} onChanged={onChanged} />;
};

const RequestReset = ({
  hostname,
  onChanged,
}: {
  hostname: string;
  onChanged: (reset: FactoryReset) => void;
}) => {
  const { isOwner } = useSession();
  const [typed, setTyped] = useState("");
  if (!isOwner) {
    return (
      <>
        <p>{WHAT_IT_DESTROYS}</p>
        <p className="text-muted">
          Only an owner can request a factory reset. Any admin on the quorum roster can approve one,
          and any admin can cancel it.
        </p>
      </>
    );
  }
  return (
    <>
      <p>{WHAT_IT_DESTROYS}</p>
      <p className="text-muted">
        The quorum of admins on the roster must approve it, then it waits 10 minutes, during which
        any admin can cancel it.
      </p>
      <Field label={`Type ${hostname} to confirm`}>
        <Input onChange={(event) => setTyped(event.target.value)} value={typed} />
      </Field>
      <div>
        <Button
          disabled={!hostname || typed.trim() !== hostname}
          onClick={() =>
            void runAction(() => power.startFactoryReset(typed.trim()), {
              onSuccess: (response) => onChanged(response.factoryReset),
            })
          }
          size="lg"
          variant="danger"
        >
          Request factory reset
        </Button>
      </div>
    </>
  );
};

const PendingReset = ({
  onCancelled,
  onChanged,
  reset,
}: {
  onCancelled: () => void;
  onChanged: (reset: FactoryReset) => void;
  reset: FactoryReset;
}) => {
  const { session } = useSession();
  const me = session?.admin ?? "";
  const counted = reset.approvals.includes(me);
  const onRoster = reset.members.includes(me);
  return (
    <>
      <Alert title="A factory reset is waiting for approvals" tone="warn">
        Requested by {reset.startedBy}
        {reset.started ? ` at ${new Date(reset.started).toLocaleTimeString()}` : ""}.{" "}
        {WHAT_IT_DESTROYS}
      </Alert>
      <p className="text-body font-bold">
        {reset.approvals.length} of {reset.required} approvals
      </p>
      <p className="text-muted">
        {reset.required} of the {reset.members.length} admins on the quorum roster must approve.
      </p>
      <ul className="flex flex-col gap-2">
        {reset.members.map((member) => {
          const approved = reset.approvals.includes(member);
          return (
            <li
              aria-label={`${member}: ${approved ? "approved" : "waiting"}`}
              className="flex items-center gap-2"
              key={member}
            >
              {member}
              <Badge tone={approved ? "ok" : "neutral"}>{approved ? "approved" : "waiting"}</Badge>
            </li>
          );
        })}
      </ul>
      {reset.expires && (
        <p className="flex items-center gap-2">
          The request expires in{" "}
          <Countdown label="Request expires" until={Date.parse(reset.expires)} warnBelow={300} />
        </p>
      )}
      {counted && <p>Your approval is counted. Another roster member must approve.</p>}
      {!onRoster && <p>You aren&apos;t on the quorum roster, so you can&apos;t approve.</p>}
      <div className="flex flex-wrap gap-3">
        {onRoster && !counted && (
          <Button
            onClick={() =>
              void runAction(() => power.approveFactoryReset(reset.id), {
                onSuccess: (response) => onChanged(response.factoryReset),
              })
            }
            size="lg"
            variant="danger"
          >
            Approve
          </Button>
        )}
        <Button
          onClick={() =>
            void runAction(() => power.cancelFactoryReset(reset.id), { onSuccess: onCancelled })
          }
          size="lg"
          variant="secondary"
        >
          Cancel the request
        </Button>
      </div>
    </>
  );
};
