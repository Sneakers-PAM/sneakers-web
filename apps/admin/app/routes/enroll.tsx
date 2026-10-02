import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { enrollAction, enrollLoader } from "@sneakers-web/shell/server";

export const loader = (arguments_: LoaderFunctionArgs) => enrollLoader(arguments_);
export const action = (arguments_: ActionFunctionArgs) => enrollAction(arguments_);
export const meta = () => [{ title: "Second factor · Sneakers-PAM" }];

export { EnrollPage as default } from "@sneakers-web/shell";
