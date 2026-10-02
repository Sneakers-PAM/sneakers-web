/**
 * The browser side of a passkey ceremony. The gateway sends WebAuthn options as JSON with
 * base64url byte fields; these helpers convert them for navigator.credentials and turn the
 * result back into JSON for the gateway.
 */

const fromB64url = (s: string): ArrayBuffer => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replaceAll("-", "+").replaceAll("_", "/"));
  const out = new Uint8Array(bin.length);
  for (let index = 0; index < bin.length; index++) out[index] = bin.charCodeAt(index);
  return out.buffer;
};

const toB64url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

type Options = { publicKey?: Record<string, unknown> } & Record<string, unknown>;

interface WireDescriptor {
  id: string;
  transports?: string[];
  type: string;
}

export const passkeysSupported = (): boolean => {
  return (
    globalThis.window !== undefined &&
    "PublicKeyCredential" in globalThis &&
    !!navigator.credentials
  );
};

const unwrap = (json: string): Record<string, unknown> => {
  const parsed = JSON.parse(json) as Options;
  return (parsed.publicKey ?? parsed) as Record<string, unknown>;
};

const descriptors = (list: unknown): PublicKeyCredentialDescriptor[] | undefined =>
  Array.isArray(list)
    ? (list as WireDescriptor[]).map((d) => ({
        ...d,
        id: fromB64url(d.id),
        transports: d.transports as AuthenticatorTransport[] | undefined,
        type: "public-key" as const,
      }))
    : undefined;

/** Register: create a credential and return its JSON for the register/finish call. */
export const createCredential = async (optionsJson: string): Promise<string> => {
  const o = unwrap(optionsJson);
  const user = o.user as { displayName: string; id: string; name: string };
  const cred = (await navigator.credentials.create({
    publicKey: {
      ...(o as unknown as PublicKeyCredentialCreationOptions),
      challenge: fromB64url(o.challenge as string),
      excludeCredentials: descriptors(o.excludeCredentials),
      user: { ...user, id: fromB64url(user.id) },
    },
  })) as null | PublicKeyCredential;
  if (!cred) throw new Error("No passkey was created.");
  const r = cred.response as AuthenticatorAttestationResponse;
  return JSON.stringify({
    id: cred.id,
    rawId: toB64url(cred.rawId),
    response: {
      attestationObject: toB64url(r.attestationObject),
      clientDataJSON: toB64url(r.clientDataJSON),
    },
    type: cred.type,
  });
};

/** Sign in: run the assertion and return the credential JSON for /auth/verify-otp. */
export const getAssertion = async (optionsJson: string): Promise<string> => {
  const o = unwrap(optionsJson);
  const cred = (await navigator.credentials.get({
    publicKey: {
      ...(o as unknown as PublicKeyCredentialRequestOptions),
      allowCredentials: descriptors(o.allowCredentials),
      challenge: fromB64url(o.challenge as string),
    },
  })) as null | PublicKeyCredential;
  if (!cred) throw new Error("No passkey was chosen.");
  const r = cred.response as AuthenticatorAssertionResponse;
  return JSON.stringify({
    id: cred.id,
    rawId: toB64url(cred.rawId),
    response: {
      authenticatorData: toB64url(r.authenticatorData),
      clientDataJSON: toB64url(r.clientDataJSON),
      signature: toB64url(r.signature),
      userHandle: r.userHandle ? toB64url(r.userHandle) : null,
    },
    type: cred.type,
  });
};
