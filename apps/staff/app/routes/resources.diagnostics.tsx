import type { LoaderFunctionArgs } from "react-router";

import { diagnosticsLoader } from "@sneakers-web/shell/server";

const load = diagnosticsLoader("staff");

export const loader = (arguments_: LoaderFunctionArgs) => load(arguments_);
