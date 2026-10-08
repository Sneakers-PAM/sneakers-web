import { CenteredFrame, FrameTitle } from "@sneakers-web/shell";
import { Button, Spinner } from "@sneakers-web/ui";
import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import type { CodeKind, GetSetupResponse } from "@/lib/osadmin/types";

import { BoxRestarting } from "@/components/BoxRestarting";
import { StepUpDialog } from "@/components/StepUpDialog";
import { CodeStep } from "@/features/setup/CodeStep";
import { CredentialsStep } from "@/features/setup/CredentialsStep";
import { FinishStep } from "@/features/setup/FinishStep";
import { NetworkStep } from "@/features/setup/NetworkStep";
import { ProtectionStep } from "@/features/setup/ProtectionStep";
import { RecoveryKeysStep } from "@/features/setup/RecoveryKeysStep";
import { SetupComplete } from "@/features/setup/SetupComplete";
import { SetupProgress, STEP_TITLES } from "@/features/setup/SetupProgress";
import { runAction } from "@/lib/osadmin/action";
import { setup, signIn } from "@/lib/osadmin/client";
import { setSession } from "@/lib/osadmin/sessionStore";
import { useSession } from "@/lib/useSession";

type View =
  | { codeKind: CodeKind; fixedAdmin?: string; kind: "credentials"; owners?: string[] }
  | { kind: "code" }
  | { kind: "complete" }
  | { kind: "done" }
  | { kind: "loading" }
  | { kind: "restarting" }
  | { kind: "step"; number: 3 | 4 | 5 | 6 };

/** Where a reload lands: the box's own idea of the first step not done. */
const viewFor = (data: GetSetupResponse): View => {
  if (data.codeKind && data.codeKind !== "CODE_KIND_UNSPECIFIED")
    return {
      codeKind: data.codeKind,
      fixedAdmin: data.codeAdmin || undefined,
      kind: "credentials",
    };
  if (data.done) return { kind: "done" };
  const current = data.current ?? 1;
  if (current >= 3 && current <= 6) return { kind: "step", number: current as 3 | 4 | 5 | 6 };
  return { kind: "code" };
};

const StepTitle = ({
  number,
  title = STEP_TITLES[number - 1],
}: {
  number: number;
  title?: string;
}) => (
  <>
    <SetupProgress current={number} />
    <FrameTitle title={`Step ${String(number)} of 6: ${title ?? ""}`} />
  </>
);

/**
 * The :8443 setup stepper: 1 the console's code, 2 the first admin (password and TOTP), 3 the
 * recovery keys, 4 the network, 5 the protection, 6 one sign-in and Finish. The box keeps
 * where setup is, so a reload resumes at the first step not done. The same page takes an
 * invitation or a Recover access code: then it's only the password and authenticator.
 */
export default function Setup() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: "loading" });
  const [data, setData] = useState<GetSetupResponse>();

  const load = (next?: (response: GetSetupResponse) => View) =>
    setup
      .get()
      .then((response) => {
        setData(response);
        setView(next ? next(response) : viewFor(response));
      })
      .catch(() => setView({ kind: "code" }));

  useEffect(() => {
    void signIn
      .getSession()
      .then((response) => {
        if (response.session) setSession(response.session);
      })
      .catch(() => {})
      .finally(() => void load());
  }, []);

  const reload = () => void load((response) => (view.kind === "step" ? view : viewFor(response)));
  const goTo = (number: 3 | 4 | 5 | 6) => setView({ kind: "step", number });
  const acknowledge = (
    step: "SETUP_STEP_KIND_NETWORK" | "SETUP_STEP_KIND_PROTECTION",
    next: 5 | 6,
  ) =>
    void runAction(() => setup.acknowledgeStep(step), {
      onSuccess: () => void load(() => ({ kind: "step", number: next })),
    });

  if (view.kind === "done") return <Navigate replace to={session ? "/home" : "/"} />;

  return (
    <CenteredFrame className="max-w-160">
      {view.kind === "loading" && (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      )}
      {view.kind === "code" && (
        <>
          <StepTitle number={1} />
          <CodeStep
            onRedeemed={(redeemed) =>
              void load(() =>
                redeemed.kind === "CODE_KIND_SETUP"
                  ? { codeKind: redeemed.kind, kind: "credentials" }
                  : {
                      codeKind: redeemed.kind,
                      fixedAdmin: redeemed.admin || undefined,
                      kind: "credentials",
                      owners: redeemed.existingOwners,
                    },
              )
            }
          />
        </>
      )}
      {view.kind === "credentials" && (
        <CredentialsStep
          fixedAdmin={view.fixedAdmin}
          header={(phase) =>
            view.codeKind === "CODE_KIND_SETUP" ? (
              <StepTitle
                number={2}
                title={phase === "password" ? "Create the first admin" : "Add your authenticator"}
              />
            ) : (
              <FrameTitle
                title={
                  view.codeKind === "CODE_KIND_RECOVER"
                    ? "Recover access"
                    : "Set your password and authenticator"
                }
              />
            )
          }
          kind={view.codeKind}
          onDone={(next) => {
            setSession(next);
            if (view.codeKind === "CODE_KIND_SETUP") void load();
            else navigate("/home", { replace: true });
          }}
          owners={view.owners}
        />
      )}
      {view.kind === "step" && data && (
        <>
          <StepTitle number={view.number} />
          {view.number === 3 && (
            <>
              <RecoveryKeysStep data={data} onChanged={reload} />
              <div className="flex justify-end">
                <Button disabled={(data.recoveryKeys?.length ?? 0) === 0} onClick={() => goTo(4)}>
                  Continue
                </Button>
              </div>
            </>
          )}
          {view.number === 4 && (
            <>
              <NetworkStep />
              <div className="flex justify-between gap-3">
                <Button onClick={() => goTo(3)} variant="secondary">
                  Back
                </Button>
                <Button onClick={() => acknowledge("SETUP_STEP_KIND_NETWORK", 5)}>Continue</Button>
              </div>
            </>
          )}
          {view.number === 5 && (
            <>
              <ProtectionStep />
              <div className="flex justify-between gap-3">
                <Button onClick={() => goTo(4)} variant="secondary">
                  Back
                </Button>
                <Button onClick={() => acknowledge("SETUP_STEP_KIND_PROTECTION", 6)}>
                  Continue
                </Button>
              </div>
            </>
          )}
          {view.number === 6 && (
            <FinishStep
              data={data}
              onBack={() => goTo(5)}
              onFinished={() => setView({ kind: "restarting" })}
            />
          )}
        </>
      )}
      {view.kind === "restarting" && (
        <BoxRestarting onBack={() => setView({ kind: "complete" })}>
          <p className="m-0">
            Setup is closed. The box restarts into normal operation; Updates and Status open once
            it&apos;s back.
          </p>
        </BoxRestarting>
      )}
      {view.kind === "complete" && <SetupComplete />}
      <StepUpDialog />
    </CenteredFrame>
  );
}
