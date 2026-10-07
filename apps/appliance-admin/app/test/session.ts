import { setSession } from "@/lib/osadmin/sessionStore";
import { edge } from "@/mock/edge.mock";

/** Signs the browser in as one of the mock world's admins, as the quick login does. */
export const signInAs = (admin: string): void => {
  const session = edge.quickLogin?.signIn(admin) ?? null;
  if (!session) throw new Error(`no mock admin ${admin}`);
  setSession(session);
};
