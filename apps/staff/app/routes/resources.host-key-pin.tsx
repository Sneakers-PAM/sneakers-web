import type { ActionFunctionArgs } from "react-router";

import { hostKeyPinAction } from "@sneakers-web/shell/server";

export const action = (arguments_: ActionFunctionArgs) => hostKeyPinAction(arguments_);
