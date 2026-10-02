import {
  MarkAllNotificationsReadDocument,
  MarkNotificationReadDocument,
  MyNotificationsDocument,
  UnreadCountDocument,
} from "@sneakers-web/api-client";
import { parseDisplay } from "@sneakers-web/ui";
import { type ActionFunctionArgs, data, type LoaderFunctionArgs } from "react-router";

import { displayCookie } from "#shell/server/root.server";
import { guard, requireUser } from "#shell/server/session.server";

const YEAR = 60 * 60 * 24 * 365;

/** Whether the browser used https, including behind an ingress that terminated TLS. */
const isHttps = (request: Request): boolean =>
  new URL(request.url).protocol === "https:" ||
  request.headers.get("X-Forwarded-Proto")?.split(",", 1)[0]?.trim() === "https";

/** Save the display settings (theme, contrast, motion, text size) to their cookie. */
export const displayAction = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const settings = parseDisplay(String(form.get("settings") ?? ""));
  const secure = isHttps(request) ? "; Secure" : "";
  return data(
    { ok: true },
    {
      headers: {
        "Set-Cookie": `${displayCookie()}=${encodeURIComponent(JSON.stringify(settings))}; Path=/; Max-Age=${YEAR}; SameSite=Lax${secure}`,
      },
    },
  );
};

/** The notification panel: the list (or just the unread count with ?count). */
export const notificationsLoader = async ({ request }: LoaderFunctionArgs) => {
  const { gw } = await requireUser(request);
  return guard(request, async () => {
    if (new URL(request.url).searchParams.has("count")) {
      const d = await gw.gql(UnreadCountDocument);
      return { items: null, unread: d.myUnreadNotificationCount };
    }
    const d = await gw.gql(MyNotificationsDocument, { limit: 50 });
    return { items: d.myNotifications, unread: d.myUnreadNotificationCount };
  });
};

/** Mark one notification read (`id`), or all of them (`all`). */
export const notificationsAction = async ({ request }: ActionFunctionArgs) => {
  const { gw } = await requireUser(request);
  const form = await request.formData();
  const id = form.get("id");
  return guard(request, async () => {
    await (typeof id === "string" && id
      ? gw.gql(MarkNotificationReadDocument, { id })
      : gw.gql(MarkAllNotificationsReadDocument));
    return { ok: true };
  });
};

/** Liveness for the container: the app server is up. It doesn't call the gateway. */
export const healthLoader = () => Response.json({ status: "ok" });
