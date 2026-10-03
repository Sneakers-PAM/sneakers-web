import { CenteredFrame, FrameTitle } from "@sneakers-web/shell";
import { Button } from "@sneakers-web/ui";
import { Link, Outlet, useLocation } from "react-router";

/**
 * What the console shows while the install has no administrator: the setup wizard on
 * /setup, and everywhere else the first step, "Check", with the way in.
 */
export const SetupGate = () => {
  const { pathname } = useLocation();
  if (pathname.replace(/\/$/, "").endsWith("/setup")) return <Outlet />;
  return (
    <CenteredFrame>
      <FrameTitle
        body="Sneakers-PAM is installed and reachable, but it has no administrator yet. Create the first one to finish setting it up."
        title="Set up Sneakers-PAM"
      />
      <div>
        <Button asChild size="lg">
          <Link to="/setup">Start setup</Link>
        </Button>
      </div>
    </CenteredFrame>
  );
};
