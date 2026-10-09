import { Alert, Button } from "@sneakers-web/ui";

import { useServedWebVersion } from "@/lib/webVersion";

/**
 * After a Base Web update swaps the :8443 pages under an open browser, the box's answers name
 * the new pages' version: this page is the older set, so it offers a reload. The old pages keep
 * working until then.
 */
export const PagesUpdatedBanner = ({ own = __APP_VERSION__ }: { own?: string }) => {
  const served = useServedWebVersion();
  if (!served || served === own) return null;
  return (
    <Alert role="status" title="The admin pages were updated" tone="info">
      <div className="flex flex-wrap items-center gap-3">
        <span>{`The admin pages were updated to ${served}. Reload to use them.`}</span>
        <Button onClick={() => globalThis.location.reload()} size="sm" variant="secondary">
          Reload
        </Button>
      </div>
    </Alert>
  );
};
