import { createContext, useContext } from "react";

/** The response's CSP nonce, for the scripts the document renders; undefined in the browser. */
export const NonceContext = createContext<string | undefined>(undefined);

export const useNonce = (): string | undefined => useContext(NonceContext);
