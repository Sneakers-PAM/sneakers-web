import { Alert, Skeleton } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetStatusResponse } from "@/lib/osadmin/types";

import { status } from "@/lib/osadmin/client";

/** Step 5 (read only): the protection the box chose from its hardware, in plain words. */
export const ProtectionStep = () => {
  const [data, setData] = useState<GetStatusResponse>();
  useEffect(() => void status.get().then(setData), []);
  if (!data) return <Skeleton className="h-40" />;
  const full = data.protection === "PROTECTION_FULL";
  const tpm = data.custodyMode === "tpm";
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-body">
        The box chose this from its hardware.{full ? " Nothing to do here." : ""}
      </p>
      <dl className="m-0 flex flex-col gap-2 text-small">
        <div className="flex gap-4">
          <dt className="w-32 shrink-0 text-muted">Protection</dt>
          <dd className="m-0 font-bold">{full ? "Full" : "Reduced"}</dd>
        </div>
        <div className="flex gap-4">
          <dt className="w-32 shrink-0 text-muted">Secure Boot</dt>
          <dd className="m-0">
            {full
              ? "On: only this project's signed software starts"
              : data.protectionReason || "Off"}
          </dd>
        </div>
        <div className="flex gap-4">
          <dt className="w-32 shrink-0 text-muted">Data key</dt>
          <dd className="m-0">
            {tpm
              ? "Sealed in the TPM: a copied disk can't be read"
              : "In a key file on the disk (no TPM)"}
          </dd>
        </div>
      </dl>
      {full ? (
        <p className="m-0 text-small text-muted">
          You can change Secure Boot later on the Status page.
        </p>
      ) : (
        <Alert title="Reduced protection" tone="warn">
          <div className="flex flex-col gap-2">
            <p className="m-0">
              Someone who takes this disk could read its data or change its software. The box still
              works, and backups stay encrypted to your recovery keys.
            </p>
            <p className="m-0">
              To raise it, move to hardware or a VM with Secure Boot and a TPM (or vTPM) and restore
              a backup there. If the firmware has Secure Boot but it&apos;s switched off, turn it on
              later from the Status page, with no reinstall.
            </p>
          </div>
        </Alert>
      )}
    </div>
  );
};
