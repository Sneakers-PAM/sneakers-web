import type { LoaderFunctionArgs } from "react-router";

import { frameData } from "@sneakers-web/shell/server";

export const loader = ({ request }: LoaderFunctionArgs) => frameData(request);

export { AdminFrame as default } from "@/frame/AdminFrame";
