import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Pill,
  Spinner,
  toast,
} from "@sneakers-web/ui";
import { ClipboardCopy } from "lucide-react";
import { useEffect, useState } from "react";

import type { GetStatusResponse } from "@/lib/osadmin/types";

import {
  boxUnreadable,
  buildApplianceReport,
  buildApplianceReportText,
} from "@/lib/diagnostics/report";
import { status as statusClient } from "@/lib/osadmin/client";
import { shortName } from "@/lib/parseVersion";
import { useSession } from "@/lib/useSession";

const Row = ({ label, title, value }: { label: string; title?: string; value: string }) => (
  <div className="flex gap-3 py-1 text-[0.875rem]">
    <dt className="w-32 flex-none text-muted">{label}</dt>
    <dd className="m-0 min-w-0 font-mono text-[0.8125rem] break-all" title={title}>
      {value}
    </dd>
  </div>
);

const Body = ({ open }: { open: boolean }) => {
  const { session } = useSession();
  const [status, setStatus] = useState<GetStatusResponse | null>();
  const [statusError, setStatusError] = useState<unknown>();
  const [reads, setReads] = useState(0);

  useEffect(() => {
    if (!open) return;
    let live = true;
    void statusClient
      .get()
      .then((response) => {
        if (!live) return;
        setStatus(response);
        setStatusError(undefined);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setStatus(null);
        setStatusError(error);
      });
    return () => {
      live = false;
    };
  }, [open, reads]);

  if (status === undefined) {
    return (
      <div className="flex items-center gap-2 text-[0.875rem]" role="status">
        <Spinner /> Reading the box&apos;s status…
      </div>
    );
  }

  const report = buildApplianceReport({
    admin: session ? { name: session.admin, role: session.role } : null,
    status,
    statusError,
  });

  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0">
        <Row
          label="App"
          value={`${report.app.name} ${report.app.version} (${report.app.commit})`}
        />
        <Row
          label="Signed in as"
          value={report.admin ? `${report.admin.name} (${report.admin.role})` : "not signed in"}
        />
        {report.box ? (
          <>
            <Row
              label="Box version"
              title={report.box.version}
              value={shortName(report.box.version)}
            />
            <Row label="Slot" value={report.box.slot} />
            <Row label="Protection" value={report.box.protection} />
            <Row label="Secure Boot" value={report.box.secureBoot} />
          </>
        ) : (
          <Row label="Box" value={boxUnreadable(report.boxError)} />
        )}
      </dl>
      {!report.box && (
        <div>
          <Button
            onClick={() => {
              setStatus(undefined);
              setReads((n) => n + 1);
            }}
            variant="secondary"
          >
            Retry
          </Button>
        </div>
      )}
      {report.health.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="m-0 text-small font-bold">Service health</h3>
          <div className="flex flex-wrap gap-2">
            {report.health.map((c) => (
              <Pill key={c.name} tone={c.ok ? "ok" : "danger"}>
                {c.name}
              </Pill>
            ))}
          </div>
        </section>
      )}
      <div>
        <Button
          onClick={() => {
            void navigator.clipboard
              .writeText(buildApplianceReportText(report))
              .then(() => toast("Diagnostics copied. Paste them into your support request."))
              .catch(() => toast("Couldn't copy. Try again."));
          }}
        >
          <ClipboardCopy aria-hidden />
          Copy diagnostics
        </Button>
      </div>
    </div>
  );
};

/**
 * The account menu's About and diagnostics for the appliance admin (issue #202): this
 * build, the signed-in admin, the box and its service health. There's no Sneakers gateway
 * section -- this app's base path doesn't have one.
 */
export const ApplianceAbout = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>About and diagnostics</DialogTitle>
        <DialogDescription>
          This appliance admin&apos;s build, your session and the box. Copy them into a support
          request.
        </DialogDescription>
      </DialogHeader>
      {open && <Body open={open} />}
    </DialogContent>
  </Dialog>
);
