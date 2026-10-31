// Every field the :8443 pages take a value in keeps the browser and password managers out
// (#320), so the admin's own sign-in is never filled into a relay, network, backup,
// certificate or update setting. The sign-in itself is the one place that wants them.

const sources = import.meta.glob<string>(["../**/*.tsx", "!../**/*.test.tsx", "!../mock/**"], {
  eager: true,
  import: "default",
  query: "?raw",
});

/** Fields where filling the admin's own sign-in is right, by file and the field's label. */
const SIGN_IN_FIELDS: Record<string, string[]> = {
  // The password field itself: its callers pass the autofill props in.
  "../components/PasswordInput.tsx": ["wiring"],
  // Changing your own password starts with the current one.
  "../features/access/AccountCard.tsx": ["the current password"],
  // Setup's last step signs in with the account just made.
  "../features/setup/FinishStep.tsx": ["username", "setPassword"],
  "../routes/sign-in.tsx": ["username", "setPassword"],
};

// The props run to the tag's closing ">"; an arrow function's "=>" inside them doesn't end it.
const FIELD = /<(Input|PasswordInput|Textarea|input|textarea)\b((?:=>|[^>])*?)\/?>/gs;
const NOT_TYPED_INTO = /type="(checkbox|file|hidden|radio)"/;

const fieldsMissingIt = () =>
  Object.entries(sources).flatMap(([file, source]) =>
    [...source.matchAll(FIELD)]
      .filter(([, , props = ""]) => !NOT_TYPED_INTO.test(props) && !/\breadOnly\b/.test(props))
      .filter(([, , props = ""]) => !props.includes("noAutofill("))
      .filter(([, , props = ""]) => !(SIGN_IN_FIELDS[file] ?? []).some((m) => props.includes(m)))
      .map((match) => {
        const line = source.slice(0, match.index).split("\n").length;
        return `${file.replace("../", "app/")}:${line} <${match[1]}>`;
      }),
  );

describe("noAutofill on the :8443 forms", () => {
  it("reads the app's pages and components", () => {
    expect(Object.keys(sources)).toContain("../routes/email.tsx");
    expect(Object.keys(sources)).toContain("../routes/network.tsx");
  });

  it("is on every field an admin types into, except the sign-in's own", () => {
    expect(fieldsMissingIt()).toEqual([]);
  });
});
