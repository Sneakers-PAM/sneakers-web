import { edge } from "@sneakers-web/edge";
import { CenteredFrame, FrameTitle } from "@sneakers-web/shell";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  toast,
} from "@sneakers-web/ui";
import { Copy } from "lucide-react";
import { useId } from "react";
import { Navigate } from "react-router";

import type { BeginSignInResponse } from "@/lib/osadmin/types";

import { setSession } from "@/lib/osadmin/sessionStore";
import { useSignInCode } from "@/lib/osadmin/useSignInCode";
import { useSession } from "@/lib/useSession";

/** The Recover access docs, for an admin who no longer holds a key. */
const RECOVER_ACCESS_URL = "https://docs.sneakers-pam.com/appliance/recover-access";

const commandFor = (begun: BeginSignInResponse): string =>
  `ssh <you>@${begun.sourceAddress} login ${begun.code}`;

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

/** The explanation behind the "How does sign-in work?" link, opened from a dialog, not inline. */
const HowSignInWorksDialog = ({ begun }: { begun: BeginSignInResponse }) => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="link">How does sign-in work?</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>How signing in works</DialogTitle>
      </DialogHeader>
      <ol className="flex flex-col gap-2.5 pl-5 text-body leading-[1.5]">
        <li>This code is valid for 5 minutes and works once.</li>
        <li>
          Run <code className="font-mono">{commandFor(begun)}</code> from your own machine, or type{" "}
          <code className="font-mono">login {begun.code}</code> in the closed shell.
        </li>
        <li>Your SSH key proves who you are, and it can be a hardware key.</li>
        <li>Confirm the browser address and agent shown in the prompt.</li>
        <li>This page signs in by itself.</li>
      </ol>
      <p className="m-0 text-small text-muted">
        There are no passwords on this box. Sessions end after 15 minutes idle or 8 hours. Removing
        your key ends your sessions.
      </p>
      <DialogFooter>
        <Button asChild variant="link">
          <a href={RECOVER_ACCESS_URL} rel="noreferrer" target="_blank">
            Recover access
          </a>
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const SignInCode = ({ begun }: { begun: BeginSignInResponse }) => {
  const command = commandFor(begun);
  return (
    <>
      <p
        aria-label={`Sign-in code ${begun.code}`}
        className="rounded-md border-[1.5px] border-control bg-sunken py-4 text-center font-mono text-[1.75rem] font-bold tracking-[0.2em]"
      >
        {begun.code}
      </p>
      <div className="flex items-center justify-between gap-2">
        <code className="min-w-0 flex-1 truncate text-small">{command}</code>
        <Button
          onClick={() => void navigator.clipboard?.writeText(command).then(() => toast("Copied."))}
          size="sm"
          variant="secondary"
        >
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
      <HowSignInWorksDialog begun={begun} />
    </>
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
        <SignInCode begun={code.begun} />
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
