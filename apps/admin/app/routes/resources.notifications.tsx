import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { notificationsAction, notificationsLoader } from "@sneakers-web/shell/server";

export const loader = (arguments_: LoaderFunctionArgs) => notificationsLoader(arguments_);
export const action = (arguments_: ActionFunctionArgs) => notificationsAction(arguments_);
