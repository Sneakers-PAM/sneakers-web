import { FrameTitle } from "@sneakers-web/shell";
import { Button } from "@sneakers-web/ui";
import { Link } from "react-router";

import { useSession } from "@/lib/useSession";

/** After step 6: setup is closed, and the product bundle is installed from Updates next. */
export const SetupComplete = () => {
  const { session } = useSession();
  return (
    <>
      <FrameTitle title="Setup is complete" />
      <p className="m-0 text-body">
        You&apos;re signed in as {session?.admin}. Setup is closed for good, and the setup code no
        longer works.
      </p>
      <p className="m-0 text-body">
        Sneakers-PAM isn&apos;t installed yet. Install the product on the Updates page: pick a
        version, or upload the bundle on an air-gapped box. It starts once it&apos;s installed.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/updates">Go to Updates</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link to="/home">Go to Status</Link>
        </Button>
      </div>
    </>
  );
};
