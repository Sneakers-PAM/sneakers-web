import type { ActionFunctionArgs } from "react-router";

import { tlsCertPinAction } from "@sneakers-web/shell/server";

export const action = (arguments_: ActionFunctionArgs) => tlsCertPinAction(arguments_);
