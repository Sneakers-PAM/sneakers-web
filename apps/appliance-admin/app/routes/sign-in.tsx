import { edge } from "@sneakers-web/edge";
import { CenteredFrame, FrameTitle } from "@sneakers-web/shell";
import {
  Badge,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from "@sneakers-web/ui";
import { useId } from "react";
import { Navigate } from "react-router";

import { setSession } from "@/lib/osadmin/sessionStore";
import { useSignInCode } from "@/lib/osadmin/useSignInCode";
import { useSession } from "@/lib/useSession";

const DevelopmentQuickLogin = () => {
  const id = useId();
  // A literal, so a live build's bundler drops this whole branch (and the text below with
  // it); edge.quickLogin only ever exists on the mock edge anyway.
  if (import.meta.env.SNEAKERS_MOCK !== "true" || !edge.quickLogin) return null;
  const { quickLogin } = edge;
  return (
    <div className="flex flex-col gap-1.5 border-t border-border pt-4">
      <div className="flex items-center gap-2">
        <Label id={id}>Dev quick login</Label>
        <Badge tone="warn">DEV</Badge>
      </div>
      <Select onValueChange={(name) => setSession(quickLogin.signIn(name))}>
        <SelectTrigger aria-labelledby={id}>
          <SelectValue placeholder="Sign in as a test admin" />
        </SelectTrigger>
        <SelectContent>
          {quickLogin.users().map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.note ? `${u.label} · ${u.note}` : u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default function SignIn() {
  const { session } = useSession();
  const code = useSignInCode(!session);
  if (session || code.state === "signed-in") return <Navigate replace to="/home" />;
  return (
    <CenteredFrame>
      <FrameTitle body="The :8443 appliance admin" title="Sign in" />
      {code.state === "starting" && (
        <div className="flex items-center justify-center py-6">
          <Spinner />
        </div>
      )}
      {code.state === "error" && (
        <p className="text-small text-danger">Couldn&apos;t reach the appliance. Try again.</p>
      )}
      {code.begun && (code.state === "pending" || code.state === "expired") && (
        <>
          <p
            aria-label={`Sign-in code ${code.begun.code}`}
            className="rounded-md border-[1.5px] border-control bg-sunken py-4 text-center font-mono text-[1.75rem] font-bold tracking-[0.2em]"
          >
            {code.begun.code}
          </p>
          <p className="text-small text-muted">
            From a session you trust, run{" "}
            <code className="font-mono">
              ssh &lt;admin&gt;@{code.begun.sourceAddress} login {code.begun.code}
            </code>{" "}
            and approve the sign-in shown as {code.begun.userAgent}.
          </p>
        </>
      )}
      {code.state === "expired" && (
        <Button onClick={code.restart} variant="secondary">
          Get a new code
        </Button>
      )}
      <DevelopmentQuickLogin />
    </CenteredFrame>
  );
}
