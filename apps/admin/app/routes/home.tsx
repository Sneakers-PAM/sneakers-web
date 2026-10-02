import { appPath } from "@sneakers-web/shell/server";
import { redirect } from "react-router";

/** The console opens on the shared folders, as it always has. */
export const loader = () => redirect(appPath("folders"));
