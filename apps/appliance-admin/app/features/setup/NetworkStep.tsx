import { Skeleton } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetNetworkResponse } from "@/lib/osadmin/types";

import { network } from "@/lib/osadmin/client";

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 tablet:flex-row tablet:gap-4">
    <dt className="w-40 shrink-0 text-muted">{label}</dt>
    <dd className="m-0 font-mono break-words">{value || "none"}</dd>
  </div>
);

/** Step 4 (optional): the settings the box got, read only; the Network page changes them. */
export const NetworkStep = () => {
  const [data, setData] = useState<GetNetworkResponse>();
  useEffect(
    () =>
      void network
        .get()
        .then(setData)
        .catch(() => setData({} as GetNetworkResponse)),
    [],
  );
  if (!data) return <Skeleton className="h-40" />;
  const settings = data.settings;
  const addresses = (settings?.addresses ?? [])
    .map((a) =>
      a.address
        ? `${a.mode.toUpperCase()} ${a.address}/${String(a.prefix ?? "")}${a.gateway ? `, gateway ${a.gateway}` : ""}`
        : a.mode.toUpperCase(),
    )
    .join("; ");
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-body">
        These are the settings the box has now. Change them only if you need to, on the Network page
        once setup is done.
      </p>
      <dl className="m-0 flex flex-col gap-2 text-small">
        <Row label="Admin port" value={settings?.managementInterface ?? ""} />
        <Row label="Addresses" value={addresses} />
        <Row label="Host name" value={settings?.hostname ?? ""} />
        <Row label="DNS" value={(settings?.dns ?? []).join(", ")} />
        <Row
          label="Time server"
          value={`${(settings?.ntp ?? []).join(", ")}${data.ntpSynced ? ", synced" : ", not synced"}`}
        />
        <Row
          label="Who can reach this page and SSH"
          value={(settings?.allowList ?? []).join(", ")}
        />
      </dl>
    </div>
  );
};
