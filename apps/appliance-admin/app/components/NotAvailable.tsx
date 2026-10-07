import { EmptyState } from "@sneakers-web/ui";

/**
 * What a page -- or a section of one -- shows when its backend isn't on the box yet, or when
 * this release doesn't build its UI yet (the Updates page, the factory-reset quorum flow).
 * The same message a Connect `unimplemented` refusal gets.
 */
export const NotAvailable = ({ name }: { name: string }) => (
  <EmptyState
    body="This release of the appliance admin doesn't build this part yet."
    loader={false}
    title={`${name}: not available in this release`}
  />
);
