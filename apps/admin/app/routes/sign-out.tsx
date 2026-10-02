import { appPath, signOutAction } from "@sneakers-web/shell/server";
import { type ActionFunctionArgs, redirect } from "react-router";

export const loader = () => redirect(appPath("sign-in"));
export const action = (arguments_: ActionFunctionArgs) => signOutAction(arguments_);
