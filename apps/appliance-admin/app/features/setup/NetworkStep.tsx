import { Alert, Button, CodeInput, Field, Input, Skeleton } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type {
  CheckHostnameResponse,
  GetNetworkResponse,
  Ipv4Mode,
  Ipv6Mode,
} from "@/lib/osadmin/types";

import { noAutofill } from "@/lib/noAutofill";
import { network, setup } from "@/lib/osadmin/client";
import { plainMessage } from "@/lib/osadmin/errors";
import { goToNewName } from "@/lib/osadmin/handoff";
import { refusalMessage } from "@/lib/osadmin/refusal";

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5 tablet:flex-row tablet:gap-4">
    <dt className="w-40 shrink-0 text-muted">{label}</dt>
    <dd className="m-0 font-mono break-words">{value || "none"}</dd>
  </div>
);

const modeName = (mode: Ipv4Mode | Ipv6Mode) => mode.replace(/^IPV[46]_MODE_/, "");

/** What the box's DNS said about the name, in one sentence the admin can act on. */
const verdictText = (check: CheckHostnameResponse): string => {
  const addresses = (check.addresses ?? []).map((a) => a.address).join(", ");
  switch (check.result) {
    case "HOSTNAME_CHECK_DNS_DOWN": {
      return "None of the box's DNS servers answered. Fix that on the Network page, or set the name there later.";
    }
    case "HOSTNAME_CHECK_ELSEWHERE": {
      return `${check.hostname} points at other addresses, not this box's (${addresses}). Point it at ${(check.managementAddresses ?? []).join(", ") || "this box"}, then check again.`;
    }
    case "HOSTNAME_CHECK_MATCH": {
      return `${check.hostname} points at this box.`;
    }
    case "HOSTNAME_CHECK_NOT_FOUND": {
      return `${check.hostname} isn't in the box's DNS, or has no address record. Add it, then check again.`;
    }
    default: {
      return check.message ?? "The box couldn't check that name.";
    }
  }
};

/**
 * Setting the box's host name: look the name up in the box's own DNS, then keep it with a
 * fresh authenticator code. The box makes a certificate for the name and the page moves to it,
 * signed in again by the one-time handoff code (the name is another origin).
 */
const HostnameForm = ({ current }: { current: string }) => {
  const [name, setName] = useState("");
  const [check, setCheck] = useState<CheckHostnameResponse>();
  const [code, setCode] = useState("");
  const [refusal, setRefusal] = useState("");
  const [busy, setBusy] = useState(false);
  const [moving, setMoving] = useState("");
  const matched = check?.result === "HOSTNAME_CHECK_MATCH";
  const verify = () => {
    setBusy(true);
    setRefusal("");
    setCheck(undefined);
    setup
      .checkHostname(name.trim())
      .then(setCheck)
      .catch((error: unknown) => setRefusal(plainMessage(error)))
      .finally(() => setBusy(false));
  };
  const set = () => {
    setBusy(true);
    setRefusal("");
    setup
      .setHostname(check?.hostname ?? name.trim(), code)
      .then((response) => {
        setMoving(response.hostname);
        goToNewName(response.url);
      })
      .catch((error: unknown) => {
        setRefusal(refusalMessage(error, { what: "code" }));
        setCode("");
      })
      .finally(() => setBusy(false));
  };
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (matched) set();
        else verify();
      }}
    >
      <p className="m-0 text-body">
        Give the box its host name now, so its first certificate is made for it
        {current ? ` (it is ${current} now)` : ""}. The name must already point at this box in DNS.
        You&apos;ll be moved to the new name, and your browser may ask you to trust the box&apos;s
        new certificate once.
      </p>
      <Field label="Host name">
        <Input
          {...noAutofill()}
          autoCapitalize="none"
          disabled={!!moving}
          onChange={(event) => {
            setName(event.target.value);
            setCheck(undefined);
          }}
          placeholder="appliance.example.org"
          spellCheck={false}
          value={name}
        />
      </Field>
      <div>
        <Button
          disabled={busy || !name.trim() || !!moving}
          onClick={verify}
          type="button"
          variant="secondary"
        >
          Check name
        </Button>
      </div>
      {check && (
        <Alert tone={matched ? "ok" : "warn"}>
          {verdictText(check)}
          {check.result === "HOSTNAME_CHECK_MATCH" &&
            (check.addresses ?? []).map((a) => (
              <code className="ml-2 font-mono" key={a.address}>
                {a.address}
              </code>
            ))}
        </Alert>
      )}
      <Field label="Authenticator code">
        <CodeInput label="Authenticator code" onChange={setCode} size="md" value={code} />
      </Field>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      {moving && <Alert tone="ok">Moving to {moving}. Signing you in there.</Alert>}
      <div>
        <Button disabled={busy || !matched || code.length !== 6 || !!moving} type="submit">
          Set host name
        </Button>
      </div>
    </form>
  );
};

/** Step 4 (optional): the settings the box got, read only; the Network page changes them. */
export const NetworkStep = () => {
  const [data, setData] = useState<GetNetworkResponse>();
  useEffect(
    () =>
      void network
        .get()
        .then(setData)
        .catch(() => setData({} as GetNetworkResponse)),
    [],
  );
  if (!data) return <Skeleton className="h-40" />;
  const settings = data.settings;
  const addresses = [settings?.management?.ipv4, settings?.management?.ipv6]
    .flatMap((family) => (family?.mode ? [{ ...family, mode: family.mode }] : []))
    .map(({ address, gateway, mode }) =>
      [modeName(mode), address, gateway && `gateway ${gateway}`].filter(Boolean).join(" "),
    )
    .join("; ");
  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-body">
        These are the settings the box has now. Change them only if you need to, on the Network page
        once setup is done. The host name can be set here.
      </p>
      <dl className="m-0 flex flex-col gap-2 text-small">
        <Row label="Admin port" value={settings?.management?.name ?? ""} />
        <Row label="Addresses" value={addresses} />
        <Row label="Host name" value={settings?.hostname ?? ""} />
        <Row label="DNS" value={(settings?.dns ?? []).join(", ")} />
        <Row
          label="Time server"
          value={`${(settings?.ntp ?? []).join(", ")}${data.ntpSynced ? ", synced" : ", not synced"}`}
        />
        <Row
          label="Who can reach this page and SSH"
          value={(settings?.allowList ?? []).join(", ")}
        />
      </dl>
      <HostnameForm current={settings?.hostname ?? ""} />
    </div>
  );
};
