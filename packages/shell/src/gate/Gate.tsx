import { type ReactNode } from "react";

import { AuthProvider, useAuth } from "#shell/auth/AuthProvider";
import { EnrollWall } from "#shell/auth/EnrollWall";
import { SignIn } from "#shell/auth/SignIn";
import { ConnectingScreen, NotSetUpScreen, OfflineScreen } from "#shell/gate/Screens";
import { useGatewayProbe } from "#shell/gate/useGatewayProbe";

/**
 * Everything between page load and the app: reach the gateway, check it's set up, then
 * sign in (and enrol a factor when that's enforced). Children render only for a
 * signed-in user.
 */
export const Gate = ({
  children,
  whenNotSetUp,
}: {
  children: ReactNode;
  /** What to show on an install with no administrator yet (the admin app shows setup). */
  whenNotSetUp?: ReactNode;
}) => {
  const { probe, retry } = useGatewayProbe();
  if (probe.phase === "checking") return <ConnectingScreen />;
  if (probe.phase === "offline") {
    return <OfflineScreen onRetry={retry} retrying={probe.retrying} triedAt={probe.triedAt} />;
  }
  if (probe.needsSetup) return <>{whenNotSetUp ?? <NotSetUpScreen />}</>;
  return (
    <AuthProvider>
      <SignedIn>{children}</SignedIn>
    </AuthProvider>
  );
};

const SignedIn = ({ children }: { children: ReactNode }) => {
  const { completeSignIn, endedReason, status } = useAuth();
  if (status === "loading") return <ConnectingScreen />;
  if (status === "enroll") return <EnrollWall />;
  if (status === "signed-out") {
    return <SignIn onSignedIn={completeSignIn} sessionEnded={endedReason === "expired"} />;
  }
  return <>{children}</>;
};
