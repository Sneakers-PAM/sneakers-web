import { EmptyState } from "@sneakers-web/ui";

/**
 * What a page -- or a section of one -- shows when its backend isn't on the box yet: the
 * same message a Connect `unimplemented` refusal gets.
 */
export const NotAvailable = ({ name }: { name: string }) => (
  <EmptyState
    body="This appliance's release doesn't have this part yet."
    loader={false}
    title={`${name}: not available in this release`}
  />
);
