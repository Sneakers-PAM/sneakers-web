import { Link } from "react-router";

import type { CertEndpoint } from "@/lib/osadmin/types";

const isAddress = (name: string): boolean => name.includes(":") || /^[\d.]+$/.test(name);

/** The box's host name among an endpoint's names (the rest are its addresses), if it has one. */
export const hostnameOf = (endpoint?: CertEndpoint): string | undefined =>
  endpoint?.names?.find((name) => !isAddress(name));

/** The link to the Network page, where the box's host name is set. */
export const SetHostnameLink = () => (
  <Link className="font-bold text-primary underline" to="/network">
    Set the host name on Network
  </Link>
);
