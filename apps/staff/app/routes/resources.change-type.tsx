import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { changeTypeAction, loadChangeType } from "@/features/editors/changeType.server";

export const loader = ({ request }: LoaderFunctionArgs) => loadChangeType(request);

export const action = ({ request }: ActionFunctionArgs) => changeTypeAction(request);
