import { BotOff, Wrench } from "lucide-react";

/** Read-only: the appliance's platform controller is where maintenance and the MCP are switched. */
export const MaintenanceBanner = ({ reason, show }: { reason: null | string; show: boolean }) => {
  if (!show) return null;
  return (
    <div
      aria-label="Maintenance mode"
      className="flex flex-none flex-wrap items-center gap-3.5 border-b-[1.5px] border-warn bg-warn-soft px-5 py-3"
      role="status"
    >
      <Wrench aria-hidden className="size-4 text-warn" strokeWidth={2.5} />
      <span className="text-body leading-[1.4]">
        <b>Maintenance mode is on.</b>{" "}
        {reason ?? "The appliance is refusing writes until it's off."}
      </span>
    </div>
  );
};

export const McpOffNotice = ({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <div
      aria-label="MCP status"
      className="flex flex-none flex-wrap items-center gap-3.5 border-b-[1.5px] border-primary bg-primary-soft px-5 py-3"
      role="status"
    >
      <BotOff aria-hidden className="size-4 text-primary" strokeWidth={2.5} />
      <span className="text-body leading-[1.4]">
        <b>MCP: off.</b> Agents can&apos;t connect to this install until the appliance turns it back
        on.
      </span>
    </div>
  );
};

/** The appliance's read-only banners, shared by the staff and admin frames. */
export const ApplianceBanners = ({
  maintenance,
  maintenanceReason,
  mcpOff,
}: {
  maintenance: boolean;
  maintenanceReason: null | string;
  mcpOff: boolean;
}) => (
  <>
    <MaintenanceBanner reason={maintenanceReason} show={maintenance} />
    <McpOffNotice show={mcpOff} />
  </>
);
