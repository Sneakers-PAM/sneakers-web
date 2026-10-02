import type { GatewayClient } from "#api/gateway";

/** Whether the install still needs its first administrator. */
export const fetchSetupState = async (gw: GatewayClient): Promise<{ needsSetup: boolean }> => {
  const r = await gw.request<{ needsSetup?: boolean }>("/setup/state");
  return { needsSetup: !!r.needsSetup };
};
