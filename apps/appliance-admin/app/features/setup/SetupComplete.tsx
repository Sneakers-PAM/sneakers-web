import { FrameTitle } from "@sneakers-web/shell";
import { Button } from "@sneakers-web/ui";

/**
 * After step 6 and the restart into normal operation: setup is closed, every session ended with
 * the restart, and the product bundle is installed from Updates next. The links are full page
 * loads, so the browser opens a new TLS session to the restarted box and signs in first.
 */
export const SetupComplete = () => (
  <>
    <FrameTitle title="Setup is complete" />
    <p className="m-0 text-body">
      The box restarted into normal operation, and every session ended with the restart. Setup is
      closed for good, and the setup code no longer works. Sign in again to go on.
    </p>
    <p className="m-0 text-body">
      Sneakers-PAM isn&apos;t installed yet. Install the product on the Updates page: pick a
      version, or upload the bundle on an air-gapped box. It starts once it&apos;s installed.
    </p>
    <div className="flex flex-wrap gap-3">
      <Button asChild>
        <a href="/updates">Go to Updates</a>
      </Button>
      <Button asChild variant="secondary">
        <a href="/home">Go to Status</a>
      </Button>
    </div>
  </>
);
