import { Button } from "@sneakers-web/ui";

import { useAuth } from "#shell/auth/AuthProvider";
import { EnrollFactor } from "#shell/auth/EnrollFactor";
import { CenteredFrame, FrameTitle } from "#shell/gate/Frames";

/** MFA is enforced and this session has no factor: the only ways out are enrolling or signing out. */
export const EnrollWall = () => {
  const { completeSignIn, signOut } = useAuth();
  return (
    <CenteredFrame>
      <FrameTitle
        body="Your administrator requires it. You can't use Sneakers-PAM until this is done."
        title="Set up a second factor to continue"
      />
      <EnrollFactor
        onDone={() => void completeSignIn()}
        secondary={
          <Button onClick={() => void signOut()} variant="link">
            Sign out
          </Button>
        }
      />
    </CenteredFrame>
  );
};
