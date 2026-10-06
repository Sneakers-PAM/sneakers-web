import type { ActionFunctionArgs } from "react-router";

import { breakGlassExitAction } from "@sneakers-web/shell/server";

/** The break-glass banner's Exit. */
export const action = (arguments_: ActionFunctionArgs) => breakGlassExitAction(arguments_);
