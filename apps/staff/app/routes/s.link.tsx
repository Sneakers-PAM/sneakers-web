import type { LoaderFunctionArgs } from "react-router";

import { redirect } from "react-router";

/**
 * The short link a label's QR code holds (#387): `/s/<id>`. It holds no value and grants no
 * access; it only points at the secret's page, whose loader signs the person in first and shows
 * the same not-found page for a secret they can't see as for one that doesn't exist.
 */
export const loader = ({ params }: Pick<LoaderFunctionArgs, "params">) =>
  redirect(params.id ? `/secret/${encodeURIComponent(params.id)}` : "/secrets");
