import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import {
  AdminConfirmEmailVerificationDocument,
  AdminRequestEmailVerificationDocument,
  AdminUserDocument,
  GraphQLRequestError,
} from "@sneakers-web/api-client";
import { refusalMessage } from "@sneakers-web/shell";
import { Alert, Button, Card, CodeInput, toast } from "@sneakers-web/ui";
import { CheckCircle2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData, useSearchParams } from "react-router";

import { PageError } from "@/components/PageError";
import { adminAct, adminLoad, text } from "@/lib/admin.server";

export const loader = ({ params, request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const { user } = await gw.gql(AdminUserDocument, { id: params.id ?? "" });
    if (!user)
      throw new GraphQLRequestError([
        { extensions: { code: "NOT_FOUND" }, message: "user not found" },
      ]);
    return {
      user: {
        email: user.email,
        emailVerified: user.emailVerified,
        id: user.id,
        name: user.name,
        username: user.username,
      },
    };
  });

/** "verify" answers "verified" or "wrong" in `done`; "resend" answers a note for the toast. */
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const intent = text(form, "intent");
  const userId = params.id ?? "";
  return adminAct(request, intent, async (gw) => {
    if (intent === "resend") {
      await gw.gql(AdminRequestEmailVerificationDocument, { userId });
      return "A new code is on its way.";
    }
    const code = text(form, "code").replaceAll(/\D/g, "");
    if (code.length !== 6) return "wrong";
    const r = await gw.gql(AdminConfirmEmailVerificationDocument, { code, userId });
    return r.confirmEmailVerification ? "verified" : "wrong";
  });
};

export const meta = () => [{ title: "Verify email · Sneakers-PAM admin console" }];

const VerifyEmail = () => {
  const { user } = useLoaderData<typeof loader>();
  const [search] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const [typed, setTyped] = useState<{ code: string; for: unknown }>({ code: "", for: undefined });
  const input = useRef<HTMLInputElement>(null);
  const result = fetcher.data;
  const verified =
    user.emailVerified || (result?.ok && result.intent === "verify" && result.done === "verified");
  const wrong =
    !!result?.ok && result.intent === "verify" && result.done === "wrong" && typed.for !== result;
  const handled = useRef<unknown>(undefined);

  useEffect(() => {
    if (!result || handled.current === result) return;
    handled.current = result;
    if (!result.ok) toast.error(refusalMessage(result.refusal));
    else if (result.intent === "resend") toast(result.done);
  }, [result]);

  useEffect(() => {
    input.current?.focus();
  }, [wrong]);

  const verify = (code: string) =>
    void fetcher.submit({ code, intent: "verify" }, { method: "post" });

  return (
    <div className="flex justify-center py-8">
      <Card className="flex w-full max-w-[30rem] flex-col gap-5 p-8 shadow-dialog">
        {verified ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle2 aria-hidden className="size-9 text-ok" />
            <h1 className="m-0 font-display text-[1.5rem] font-bold">Email verified</h1>
            <p className="m-0 text-muted">
              <span className="font-mono">{user.username}</span> · {user.email}
            </p>
            <Button asChild variant="secondary">
              <Link to={`/users/${user.id}`}>View {user.name}</Link>
            </Button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              verify(typed.code);
            }}
          >
            {search.get("created") === "1" && (
              <Alert tone="ok">
                {user.name}&apos;s account is ready. We emailed them a code to confirm the address.
              </Alert>
            )}
            <div className="flex flex-col gap-2">
              <h1 className="m-0 font-display text-[1.5rem] font-bold">Verify email</h1>
              <p className="m-0 text-muted">
                Enter the 6-digit code sent to {user.email} for{" "}
                <b className="text-ink">{user.username}</b>. If either is spelled wrong, fix the
                account first.
              </p>
            </div>
            <CodeInput
              aria-describedby={wrong ? "verify-wrong" : undefined}
              invalid={wrong}
              onChange={(code) => setTyped({ code, for: result })}
              onComplete={verify}
              ref={input}
              size="md"
              value={typed.code}
            />
            {wrong && (
              <span
                className="text-[0.875rem] font-bold text-danger"
                id="verify-wrong"
                role="alert"
              >
                <X aria-hidden className="mr-1 inline size-3.5 align-[-2px]" strokeWidth={3} />
                That code is wrong or has expired. Send a new one and try again.
              </span>
            )}
            <span className="text-small text-muted">
              Didn&apos;t get it?{" "}
              <button
                className="font-bold text-primary hover:text-ink"
                onClick={() => void fetcher.submit({ intent: "resend" }, { method: "post" })}
                type="button"
              >
                Resend code
              </button>
            </span>
            <Button
              block
              disabled={typed.code.length !== 6}
              loading={fetcher.state !== "idle"}
              loadingLabel="Verifying…"
              type="submit"
            >
              Verify
            </Button>
            <Link className="self-center text-small font-bold" to={`/users/${user.id}`}>
              Skip for now
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
};

export default VerifyEmail;

export const ErrorBoundary = () => <PageError back="/users" backLabel="Back to users" />;
