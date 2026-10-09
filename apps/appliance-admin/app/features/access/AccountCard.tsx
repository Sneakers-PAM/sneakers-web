import {
  Alert,
  Button,
  Card,
  CardHeader,
  CodeInput,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  shortDate,
  Spinner,
  Textarea,
  timeAgo,
  toast,
} from "@sneakers-web/ui";
import { ClipboardCopy } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { Admin, IssueSshKeyResponse, TotpEnrolment } from "@/lib/osadmin/types";

import { type NewPassword, NewPasswordFields } from "@/components/NewPasswordFields";
import { PasswordInput } from "@/components/PasswordInput";
import { TotpEnrolmentPanel } from "@/components/TotpEnrolmentPanel";
import { saveText } from "@/lib/download";
import { runAction } from "@/lib/osadmin/action";
import { access } from "@/lib/osadmin/client";
import { isStepUpRequired } from "@/lib/osadmin/errors";
import { refusalMessage } from "@/lib/osadmin/refusal";

type Open = "password" | "ssh" | "totp" | null;

/** Runs a dialog's call, keeping the box's refusal in the dialog instead of a toast. */
const inDialog = <T,>(
  function_: () => Promise<T>,
  onRefused: (message: string) => void,
  onSuccess: (result: T) => void,
  successMessage?: string,
) =>
  void runAction(
    async () => {
      try {
        return { ok: true as const, result: await function_() };
      } catch (error) {
        if (isStepUpRequired(error)) throw error;
        onRefused(refusalMessage(error, { what: "code" }));
        return { ok: false as const };
      }
    },
    {
      onSuccess: (outcome) => {
        if (outcome.ok) onSuccess(outcome.result);
      },
      successMessage,
    },
  );

/**
 * The signed-in admin's own sign-in methods: the password, the authenticator, and the SSH
 * keys the box issues (optional, but the recommended way into SSH).
 */
export const AccountCard = ({ me, onChanged }: { me: Admin; onChanged: () => void }) => {
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);
  const done = () => {
    setOpen(null);
    onChanged();
  };
  return (
    <section aria-label="Your account">
      <Card>
        <CardHeader subtitle={me.name} title="Your account" />
        <dl className="m-0 flex flex-col divide-y divide-border">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5.5">
            <div className="flex flex-col gap-0.5">
              <dt className="font-bold">Password</dt>
              <dd className="m-0 text-small text-muted">
                {me.passwordChanged ? `Set ${shortDate(me.passwordChanged)}` : "Set"}
              </dd>
            </div>
            <Button onClick={() => setOpen("password")} size="sm" variant="secondary">
              Change password
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-5.5">
            <div className="flex flex-col gap-0.5">
              <dt className="font-bold">Authenticator</dt>
              <dd className="m-0 text-small text-muted">
                {me.totpAdded ? `Added ${shortDate(me.totpAdded)}` : "Added"}
              </dd>
            </div>
            <Button onClick={() => setOpen("totp")} size="sm" variant="secondary">
              Replace authenticator
            </Button>
          </div>
          <div className="flex flex-col gap-3 p-5.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <dt className="font-bold">SSH keys</dt>
                <dd className="m-0 text-small text-muted">
                  Optional, and the recommended way into SSH. The box makes the key and you download
                  it once. SSH asks for your TOTP code after login.
                </dd>
              </div>
              <Button onClick={() => setOpen("ssh")} size="sm" variant="secondary">
                Get an SSH key
              </Button>
            </div>
            {me.keys.length > 0 && (
              <ul aria-label="Your SSH keys" className="m-0 flex list-none flex-col gap-2 p-0">
                {me.keys.map((key) => (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                    key={key.fingerprint}
                  >
                    <div className="flex min-w-0 flex-col gap-0.5 text-small">
                      <span className="font-bold">{key.comment || key.type}</span>
                      <span className="truncate font-mono text-muted">{key.fingerprint}</span>
                      <span className="text-muted">
                        {key.validBefore ? `Valid until ${shortDate(key.validBefore)}` : ""}
                        {key.lastUsed ? ` · last used ${timeAgo(key.lastUsed)}` : " · not used yet"}
                      </span>
                    </div>
                    <Button
                      onClick={() =>
                        void runAction(() => access.removeKey(me.name, key.fingerprint), {
                          onSuccess: onChanged,
                        })
                      }
                      size="sm"
                      variant="secondary"
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </dl>
      </Card>
      <Dialog onOpenChange={(next) => !next && close()} open={open === "password"}>
        {open === "password" && <ChangePasswordDialog admin={me.name} onDone={done} />}
      </Dialog>
      <Dialog onOpenChange={(next) => !next && close()} open={open === "totp"}>
        {open === "totp" && <ReplaceTotpDialog onDone={done} />}
      </Dialog>
      <Dialog onOpenChange={(next) => !next && close()} open={open === "ssh"}>
        {open === "ssh" && <IssueSshKeyDialog admin={me.name} onDone={done} />}
      </Dialog>
    </section>
  );
};

const ChangePasswordDialog = ({ admin, onDone }: { admin: string; onDone: () => void }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState<NewPassword>({ again: "", password: "" });
  const [valid, setValid] = useState(false);
  const [refusal, setRefusal] = useState("");
  const onValid = useCallback((ok: boolean) => setValid(ok), []);
  return (
    <DialogContent>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setRefusal("");
          inDialog(
            () => access.changePassword(current, next.password),
            (message) => {
              setRefusal(message);
              setCurrent("");
            },
            onDone,
            "Password changed.",
          );
        }}
      >
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>Your other sessions stay signed in.</DialogDescription>
        </DialogHeader>
        {refusal && <Alert tone="danger">{refusal}</Alert>}
        <Field label="Current password">
          <PasswordInput label="the current password" onChange={setCurrent} value={current} />
        </Field>
        <NewPasswordFields
          admin={admin}
          label="New password"
          onChange={setNext}
          onValid={onValid}
          value={next}
        />
        <DialogFooter>
          <Button disabled={!current || !valid} type="submit">
            Change password
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

const ReplaceTotpDialog = ({ onDone }: { onDone: () => void }) => {
  const [enrolment, setEnrolment] = useState<TotpEnrolment>();
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  useEffect(() => {
    inDialog(
      () => access.beginTotpReplacement(),
      setRefusal,
      (response) => setEnrolment(response.totp),
    );
  }, []);
  return (
    <DialogContent>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!enrolment) return;
          setRefusal("");
          inDialog(
            () => access.completeTotpReplacement(enrolment.id, code),
            (message) => {
              setRefusal(message);
              setCode("");
            },
            onDone,
            "Authenticator replaced.",
          );
        }}
      >
        <DialogHeader>
          <DialogTitle>Replace your authenticator</DialogTitle>
          <DialogDescription>
            Your current authenticator keeps working until the new one&apos;s code checks out.
          </DialogDescription>
        </DialogHeader>
        {refusal && <Alert tone="danger">{refusal}</Alert>}
        {enrolment ? (
          <TotpEnrolmentPanel code={code} enrolment={enrolment} onCode={setCode} />
        ) : (
          !refusal && <Spinner />
        )}
        <DialogFooter>
          <Button disabled={!enrolment || code.length !== 6} type="submit">
            Replace
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

const IssueSshKeyDialog = ({ admin, onDone }: { admin: string; onDone: () => void }) => {
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [issued, setIssued] = useState<IssueSshKeyResponse>();
  const [refusal, setRefusal] = useState("");
  if (issued) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your new SSH key</DialogTitle>
          <DialogDescription>
            Save these now, next to each other; the box can&apos;t show them again. SSH is
            certificate-only here, so a bare key is always refused.
          </DialogDescription>
        </DialogHeader>
        <Alert title="This is shown once" tone="warn">
          The box keeps only the public part and the certificate, so it can&apos;t show this private
          key again. If you lose it, revoke it here and get a new one.
        </Alert>
        <Field label="Private key">
          <Textarea className="min-h-32" mono readOnly value={issued.privateKey} />
        </Field>
        <div className="flex flex-col gap-2">
          <p className="m-0 font-bold">Download</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => saveText(issued.ppkFileName, issued.ppk)}>
              Download the .ppk ({issued.ppkFileName})
            </Button>
            <Button
              onClick={() => saveText(issued.fileName, issued.privateKey)}
              variant="secondary"
            >
              Download the private key ({issued.fileName})
            </Button>
            <Button
              onClick={() => saveText(issued.publicKeyFileName, `${issued.publicKey}\n`)}
              variant="secondary"
            >
              Download the public key ({issued.publicKeyFileName})
            </Button>
            <Button
              onClick={() => saveText(issued.certificateFileName, `${issued.certificate}\n`)}
              variant="secondary"
            >
              Download the certificate ({issued.certificateFileName})
            </Button>
            <Button onClick={() => saveText(issued.pemFileName, issued.pem)} variant="secondary">
              Download the PEM ({issued.pemFileName})
            </Button>
          </div>
          <p className="m-0 text-small text-muted">
            The .ppk has the certificate built in and is recommended for PuTTY 0.78 or later and
            MobaXterm 25.1 or later. OpenSSH uses the key and the certificate as a pair; the public
            key isn&apos;t needed to sign in, but some tools ask for it. The PEM carries no
            certificate either, so use it with the certificate.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="m-0 font-bold">OpenSSH</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-sunken px-2 py-1 font-mono text-small break-all">
              {issued.sshCommand}
            </code>
            <Button
              onClick={() => {
                void navigator.clipboard
                  .writeText(issued.sshCommand)
                  .then(() => toast("Command copied."))
                  .catch(() => toast("Couldn't copy. Try again."));
              }}
              size="sm"
              variant="secondary"
            >
              <ClipboardCopy aria-hidden />
              Copy
            </Button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-small text-muted">
          <p className="m-0 font-bold text-ink">PuTTY</p>
          <p className="m-0">
            Open the .ppk as the session&apos;s private key; its certificate is already inside it.
            To build one yourself from the key and certificate pair instead, PuTTY 0.78 or later: in
            PuTTYgen, Conversions &gt; Import key, then Key &gt; Add certificate to key, then save
            as .ppk; or Connection &gt; SSH &gt; Auth &gt; Credentials &gt; &quot;Certificate to
            use&quot;.
          </p>
        </div>
        <div className="flex flex-col gap-1.5 text-small text-muted">
          <p className="m-0 font-bold text-ink">MobaXterm</p>
          <ol className="m-0 flex list-decimal flex-col gap-0.5 pl-5">
            <li>Session (or User sessions &gt; New session), then SSH.</li>
            <li>Remote host: the box&apos;s address. Username: {admin}. Port: 22.</li>
            <li>
              Advanced SSH settings: tick &quot;Use private key&quot; and browse to the box&apos;s
              .ppk (the one with the certificate embedded).
            </li>
            <li>Connect, and enter your TOTP code at the menu.</li>
          </ol>
        </div>
        <p className="m-0 text-small text-muted">The TOTP prompt comes next, in the menu.</p>
        <DialogFooter>
          <Button onClick={onDone}>I&apos;ve saved it</Button>
        </DialogFooter>
      </DialogContent>
    );
  }
  return (
    <DialogContent>
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          setRefusal("");
          inDialog(
            () => access.issueSshKey(label.trim(), code),
            (message) => {
              setRefusal(message);
              setCode("");
            },
            setIssued,
          );
        }}
      >
        <DialogHeader>
          <DialogTitle>Get an SSH key</DialogTitle>
          <DialogDescription>
            The box makes a new key pair for you and signs it with its root key. You download the
            private key once; the box never keeps it. A new key takes a fresh code from your
            authenticator, even right after you signed in.
          </DialogDescription>
        </DialogHeader>
        {refusal && <Alert tone="danger">{refusal}</Alert>}
        <Field hint="Say where it lives, such as a laptop." label="Label">
          <Input onChange={(event) => setLabel(event.target.value)} value={label} />
        </Field>
        <Field label="Authenticator code">
          <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
        </Field>
        <DialogFooter>
          <Button disabled={!label.trim() || code.length !== 6} type="submit">
            Make the key
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};
