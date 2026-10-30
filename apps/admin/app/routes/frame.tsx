import type { LoaderFunctionArgs } from "react-router";

import { frameData } from "@sneakers-web/shell/server";

import { applianceAdminLink } from "@/lib/applianceAdmin.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const [frame, applianceAdmin] = await Promise.all([
    frameData(request),
    applianceAdminLink(request),
  ]);
  return { ...frame, applianceAdmin };
};

export { AdminFrame as default } from "@/frame/AdminFrame";
