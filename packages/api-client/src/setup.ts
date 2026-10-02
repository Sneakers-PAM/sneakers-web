import { requestJson } from "#api/http";

/** Whether the install still needs its first administrator. */
export const fetchSetupState = async (): Promise<{ needsSetup: boolean }> => {
  const r = await requestJson<{ needsSetup?: boolean }>("/setup/state", { quietAuth: true });
  return { needsSetup: !!r.needsSetup };
};
