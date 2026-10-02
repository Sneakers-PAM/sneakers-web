import { UnreadCountDocument } from "@sneakers-web/api-client";

import { isAdmin, requireUser, type SessionUser } from "#shell/server/session.server";

export interface FrameData {
  isAdmin: boolean;
  /** MFA is optional and this user has no factor: show the nudge. */
  mfaSetupRecommended: boolean;
  unread: number;
  user: SessionUser;
}

/** What every signed-in page's frame shows: who you are, the MFA nudge and the unread count. */
export const frameData = async (request: Request): Promise<FrameData> => {
  const { gw, session, user } = await requireUser(request);
  const unread = await gw
    .gql(UnreadCountDocument)
    .then((d) => d.myUnreadNotificationCount)
    .catch(() => 0);
  return { isAdmin: isAdmin(user), mfaSetupRecommended: session.setupRecommended, unread, user };
};
