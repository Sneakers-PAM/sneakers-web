import type { ActionFunctionArgs } from "react-router";

import { resetAction } from "@sneakers-web/shell/server";

export const action = (arguments_: ActionFunctionArgs) => resetAction(arguments_);
export const meta = () => [{ title: "Reset your password · Sneakers-PAM" }];

export { ResetPage as default } from "@sneakers-web/shell";
