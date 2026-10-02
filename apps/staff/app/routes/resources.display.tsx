import type { ActionFunctionArgs } from "react-router";

import { displayAction } from "@sneakers-web/shell/server";

export const action = (arguments_: ActionFunctionArgs) => displayAction(arguments_);
