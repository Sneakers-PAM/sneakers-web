import {
  Button,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  PageHeader,
  Switch,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetPowerResponse } from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { runAction } from "@/lib/osadmin/action";
import { power } from "@/lib/osadmin/client";

type Target = "reboot" | "shutdown";

export default function Power() {
  const [data, setData] = useState<GetPowerResponse>();
  const [target, setTarget] = useState<null | Target>(null);
  const [forced, setForced] = useState(false);
  const [forcedConfirmed, setForcedConfirmed] = useState(false);

  const reload = () => void power.get().then(setData);
  useEffect(reload, []);

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
        <CardHeader title="Active sessions" />
        <div className="flex flex-col gap-1 p-5.5 text-small">
          {data.sessions.length === 0 && <p className="text-muted">None.</p>}
          {data.sessions.map((session) => (
            <p key={`${session.admin}-${session.sourceAddress}`}>
              {session.admin} from {session.sourceAddress}
            </p>
          ))}
        </div>
        <div className="flex gap-3 border-t border-border p-5.5">
          <Button onClick={() => setTarget("reboot")} variant="secondary">
            Reboot
          </Button>
          <Button onClick={() => setTarget("shutdown")} variant="danger">
            Shut down
          </Button>
        </div>
      </Card>
      <Card>
        <CardHeader title="Factory reset" />
        <div className="p-5.5">
          <NotAvailable name="Factory reset" />
        </div>
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
    </div>
  );
}
