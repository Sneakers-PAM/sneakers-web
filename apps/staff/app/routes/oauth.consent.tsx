import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  ShouldRevalidateFunctionArgs,
} from "react-router";

import { Button, EmptyState } from "@sneakers-web/ui";
import { useState } from "react";
import { useLoaderData, useNavigation, useRevalidator } from "react-router";

import { consentAction, loadConsent } from "@/features/agents/consent.server";
import { ConsentFrame, ConsentPage, ConsentSkeleton } from "@/features/agents/ConsentPage";

export const loader = ({ request }: LoaderFunctionArgs) => loadConsent(request);

/** `allow` (with the factor and the token name), `deny`, `email` and `passkey-begin`, for `?req=`. */
export const action = ({ request }: ActionFunctionArgs) => consentAction(request);

// A decision uses up the request, so reloading after it would show "expired" over the answer.
export const shouldRevalidate = ({
  defaultShouldRevalidate,
  formMethod,
}: ShouldRevalidateFunctionArgs) => (formMethod ? false : defaultShouldRevalidate);

export const meta = () => [{ title: "Allow access · Sneakers-PAM" }];

/** G-10 agent consent: an MCP client asks for a personal token. */
const OAuthConsent = () => {
  const data = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  if (navigation.state === "loading" && !navigation.formMethod) {
    return (
      <ConsentFrame>
        <ConsentSkeleton />
      </ConsentFrame>
    );
  }
  return <ConsentPage data={data} />;
};

export default OAuthConsent;

export const ErrorBoundary = () => {
  const { revalidate, state } = useRevalidator();
  const [retrying, setRetrying] = useState(false);
  return (
    <ConsentFrame>
      {retrying && state === "loading" ? (
        <ConsentSkeleton />
      ) : (
        <EmptyState
          action={
            <Button
              onClick={() => {
                setRetrying(true);
                void revalidate();
              }}
              variant="secondary"
            >
              Retry
            </Button>
          }
          body="The server didn't answer. The app is still waiting; try again in a moment."
          loader={false}
          title="This sign-in didn't load"
        />
      )}
    </ConsentFrame>
  );
};
