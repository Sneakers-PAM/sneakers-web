import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  ShouldRevalidateFunctionArgs,
} from "react-router";

import { useLoaderData, useLocation, useNavigation, useParams } from "react-router";

import { NoAccess } from "@/features/sharing/NoAccess";
import { loadSharing, sharingAction } from "@/features/sharing/sharing.server";
import { SharingPage } from "@/features/sharing/SharingPage";
import { SharingSkeleton } from "@/features/sharing/SharingStates";

/** One module serves /folder/:id/sharing and /secret/:id/sharing; the path says which. */
const kindOf = (request: Request) =>
  new URL(request.url).pathname.startsWith("/secret/") ? "secret" : "folder";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  loadSharing(request, kindOf(request), params.id);

export const action = ({ params, request }: ActionFunctionArgs) =>
  sharingAction(request, kindOf(request), params.id);

/** Searching people and simulating change nothing, so the page doesn't reload after them. */
export const shouldRevalidate = ({
  defaultShouldRevalidate,
  formData,
}: ShouldRevalidateFunctionArgs) => {
  const intent = formData?.get("intent");
  if (intent === "search" || intent === "simulate") return false;
  return defaultShouldRevalidate;
};

export const meta = ({ data }: MetaArgs<typeof loader>) => [
  { title: `Sharing${data ? ` · ${data.title}` : ""} · Sneakers-PAM` },
];

/** U-07 Sharing and D-11 the RACI editor, for a folder or a secret. */
const Sharing = () => {
  const data = useLoaderData<typeof loader>();
  const { id = "" } = useParams();
  const navigation = useNavigation();
  const location = useLocation();
  const leaving = navigation.state === "loading" ? navigation.location.pathname : null;
  if (leaving?.endsWith("/sharing") && leaving !== location.pathname) return <SharingSkeleton />;
  if (data.mode === "none") return <NoAccess data={data} id={id} />;
  return <SharingPage data={data} key={`${data.kind}:${id}`} />;
};

export default Sharing;

export { SharingError as ErrorBoundary } from "@/features/sharing/SharingStates";
