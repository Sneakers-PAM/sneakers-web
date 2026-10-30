import type { LoaderFunctionArgs } from "react-router";

import { useLoaderData } from "react-router";

import { CliSignedIn } from "@/features/agents/CliSignedIn";
import { loadCliSignedIn } from "@/features/agents/cliSignedIn.server";

export const loader = ({ request }: LoaderFunctionArgs) => loadCliSignedIn(request);

export const meta = () => [{ title: "Command-line sign-in · Sneakers-PAM" }];

/** Where `sneakers-put login` and `sneakers-run login` finish in the browser. */
const CliSignedInRoute = () => <CliSignedIn data={useLoaderData<typeof loader>()} />;

export default CliSignedInRoute;
