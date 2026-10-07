import { useCallback, useEffect, useRef, useState } from "react";

import { setSession } from "@/lib/osadmin/sessionStore";
import { signIn } from "@/lib/osadmin/client";
import type { BeginSignInResponse, Session } from "@/lib/osadmin/types";

export type SignInCodeState = "error" | "expired" | "pending" | "signed-in" | "starting";

export interface SignInCode {
  begun?: BeginSignInResponse;
  restart: () => void;
  session?: Session;
  state: SignInCodeState;
}

const POLL_MS = 2000;

/**
 * Issues a sign-in code and polls it, the same flow the sign-in page and the step-up dialog
 * both need: `ssh <admin>@<address> login XXXX-XXXX` approves it. Stops polling once the
 * code is approved, expired, or the caller unmounts or restarts.
 */
export const useSignInCode = (active: boolean): SignInCode => {
  const [begun, setBegun] = useState<BeginSignInResponse>();
  const [state, setState] = useState<SignInCodeState>("starting");
  const [session, setLocalSession] = useState<Session>();
  const generation = useRef(0);

  const start = useCallback(() => {
    const gen = ++generation.current;
    setState("starting");
    setBegun(undefined);
    setLocalSession(undefined);
    void signIn
      .begin()
      .then((response) => {
        if (generation.current !== gen) return;
        setBegun(response);
        setState("pending");
      })
      .catch(() => {
        if (generation.current === gen) setState("error");
      });
  }, []);

  useEffect(() => {
    if (!active) return;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!active || state !== "pending" || !begun) return;
    const gen = generation.current;
    const interval = setInterval(() => {
      void signIn
        .poll(begun.pollToken)
        .then((response) => {
          if (generation.current !== gen) return;
          if (response.state === "SIGN_IN_STATE_APPROVED" && response.session) {
            setSession(response.session);
            setLocalSession(response.session);
            setState("signed-in");
          } else if (response.state === "SIGN_IN_STATE_EXPIRED") {
            setState("expired");
          }
        })
        .catch(() => {
          if (generation.current === gen) setState("error");
        });
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [active, begun, state]);

  return { begun, restart: start, session, state };
};
