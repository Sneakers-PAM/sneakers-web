import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { signInAction, signInLoader } from "@sneakers-web/shell/server";

export const loader = (arguments_: LoaderFunctionArgs) => signInLoader(arguments_);
export const action = (arguments_: ActionFunctionArgs) => signInAction(arguments_);
export const meta = () => [{ title: "Sign in · Sneakers-PAM" }];

export { SignInPage as default } from "@sneakers-web/shell";
