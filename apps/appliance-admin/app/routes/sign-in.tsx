import { edge } from "@sneakers-web/edge";
import { CenteredFrame, FrameTitle } from "@sneakers-web/shell";
import {
  Alert,
  Badge,
  Button,
  CodeInput,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@sneakers-web/ui";
import { useId, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { PasswordInput } from "@/components/PasswordInput";
import { signIn } from "@/lib/osadmin/client";
import { refusalMessage } from "@/lib/osadmin/refusal";
import { setSession } from "@/lib/osadmin/sessionStore";
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

/** The short help behind "Help with signing in", in a dialog rather than inline. */
const SignInHelpDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button className="self-start" variant="link">
        Help with signing in
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Signing in</DialogTitle>
      </DialogHeader>
      <ul className="flex flex-col gap-2.5 pl-5 text-body leading-[1.5]">
        <li>
          Use your admin name, your password and the 6-digit code from your authenticator app.
        </li>
        <li>3 wrong tries in 15 minutes lock the account. An owner can unlock it on Access.</li>
        <li>
          Lost your authenticator? Another owner can reset it. If no admin can sign in, use Recover
          access on the appliance&apos;s console.
        </li>
        <li>
          For SSH, get an SSH key on the Access page once you&apos;re signed in. SSH asks for your
          TOTP code after login.
        </li>
      </ul>
      <p className="m-0 text-small text-muted">Sessions end after 15 minutes idle or 8 hours.</p>
    </DialogContent>
  </Dialog>
);

export default function SignIn() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  if (session) return <Navigate replace to="/home" />;

  const submit = () => {
    setBusy(true);
    setRefusal("");
    signIn
      .signIn(admin.trim(), password, code)
      .then((response) => {
        setSession(response.session);
        navigate("/home", { replace: true });
      })
      .catch((error: unknown) => {
        setRefusal(refusalMessage(error, { what: "sign-in", who: admin.trim() }));
        setPassword("");
        setCode("");
      })
      .finally(() => setBusy(false));
  };

  return (
    <CenteredFrame>
      <FrameTitle body="The appliance admin" title="Sign in" />
      {refusal && (
        <Alert role="alert" tone="danger">
          {refusal}
        </Alert>
      )}
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Field label="Admin name">
          <Input
            autoCapitalize="none"
            autoComplete="username"
            onChange={(event) => setAdmin(event.target.value)}
            spellCheck={false}
            value={admin}
          />
        </Field>
        <Field label="Password">
          <PasswordInput onChange={setPassword} value={password} />
        </Field>
        <Field label="Authenticator code">
          <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
        </Field>
        <Button
          disabled={busy || !admin.trim() || !password || code.length !== 6}
          size="lg"
          type="submit"
        >
          Sign in
        </Button>
      </form>
      <SignInHelpDialog />
      <p className="m-0 text-small text-muted">
        Setting up this box, or added as a new admin?{" "}
        <Link className="text-primary underline" to="/setup">
          Enter a setup or invitation code
        </Link>
      </p>
      <DevelopmentQuickLogin />
    </CenteredFrame>
  );
}
