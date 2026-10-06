import { createContext, type ReactNode, useContext, useState } from "react";

/** One task's run id: `web_` and 32 hex digits, within the vault's [A-Za-z0-9_-]{1,64}. */
const newRunId = () => `web_${crypto.randomUUID().replaceAll("-", "")}`;

const RevealRunContext = createContext<null | string>(null);

/**
 * Every reveal on one visit to a secret's page shares a run, so the reveals its approval level
 * holds are decided (or confirmed) together, once.
 */
export const RevealRunProvider = ({ children }: { children: ReactNode }) => {
  const [id] = useState(newRunId);
  return <RevealRunContext.Provider value={id}>{children}</RevealRunContext.Provider>;
};

/** The page's run id, or one of the caller's own outside a provider. */
export const useRevealRunId = (): string => {
  const shared = useContext(RevealRunContext);
  const [own] = useState(newRunId);
  return shared ?? own;
};
