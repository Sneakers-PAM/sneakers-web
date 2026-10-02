import type { ActionFunctionArgs } from "react-router";

import { stepUpAction } from "@sneakers-web/shell/server";

export const action = (arguments_: ActionFunctionArgs) => stepUpAction(arguments_);
