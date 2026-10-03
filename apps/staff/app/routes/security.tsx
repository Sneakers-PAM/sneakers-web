import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { PageHeader } from "@sneakers-web/ui";
import { useLocation, useNavigation } from "react-router";

import { loadSecurity, securityAction } from "@/features/settings/security.server";
import { SecurityFailure } from "@/features/settings/SecurityFailure";
import { SecurityPage } from "@/features/settings/SecurityPage";
import { SecuritySkeleton } from "@/features/settings/SecuritySkeleton";

export const loader = ({ request }: LoaderFunctionArgs) => loadSecurity(request);

/** `remove-totp`, `totp-begin`, `totp-confirm`, `passkey-begin` and `passkey-finish`. */
export const action = ({ request }: ActionFunctionArgs) => securityAction(request);

export const meta = () => [{ title: "Security · Sneakers-PAM" }];

const Header = () => (
  <PageHeader eyebrow="Account" subtitle="Your sign-in methods." title="Security" />
);

/** U-17 security, with D-21 (the authenticator setup) in the page. */
const Security = () => {
  const location = useLocation();
  const navigation = useNavigation();
  const reloading =
    navigation.state === "loading" &&
    !navigation.formMethod &&
    navigation.location.pathname === location.pathname &&
    navigation.location.search === location.search;
  return (
    <div className="flex flex-col gap-6">
      <Header />
      {reloading ? <SecuritySkeleton /> : <SecurityPage />}
    </div>
  );
};

export default Security;

export const ErrorBoundary = () => (
  <div className="flex flex-col gap-6">
    <Header />
    <SecurityFailure />
  </div>
);
