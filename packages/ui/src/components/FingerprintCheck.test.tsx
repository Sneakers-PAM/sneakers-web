import { render, screen, within } from "@testing-library/react";

import { FingerprintCheck } from "#ui/components/FingerprintCheck";

const sshKey = {
  address: "build1.example.org:22",
  fingerprint: "SHA256:offeredFingerprintPlaceholder",
  keyType: "ssh-ed25519",
  kind: "ssh-host-key",
} as const;

/** The description beside a term in the check's list. */
const termOf = (term: string) => {
  const index = screen.getAllByRole("term").findIndex((t) => t.textContent === term);
  return screen.getAllByRole("definition")[index];
};

describe("FingerprintCheck", () => {
  it("shows an SSH host key's type, fingerprint and the address it was read from", () => {
    render(<FingerprintCheck offered={sshKey} />);
    expect(termOf("Key type")).toHaveTextContent("ssh-ed25519");
    expect(termOf("Fingerprint")).toHaveTextContent(sshKey.fingerprint);
    expect(termOf("Address")).toHaveTextContent("build1.example.org:22");
  });

  it("says plainly to check the fingerprint against one got another way", () => {
    render(<FingerprintCheck offered={sshKey} />);
    expect(screen.getByText(/got another way/)).toHaveTextContent(/server's console or its admin/);
  });

  it("wraps a long fingerprint instead of letting it overflow", () => {
    const fingerprint = `SHA256:${"A".repeat(300)}`;
    render(<FingerprintCheck offered={{ ...sshKey, fingerprint }} />);
    expect(screen.getByText(fingerprint)).toHaveClass("min-w-0", "flex-1", "wrap-anywhere");
  });

  it("puts the pinned and the offered fingerprints side by side when the key changed", () => {
    render(<FingerprintCheck offered={sshKey} pinned={["SHA256:oldOne", "SHA256:oldTwo"]} />);
    const before = screen.getByRole("group", { name: "Pinned now" });
    const after = screen.getByRole("group", { name: "Offered now" });
    expect(within(before).getByText("SHA256:oldOne")).toBeInTheDocument();
    expect(within(before).getByText("SHA256:oldTwo")).toBeInTheDocument();
    expect(within(after).getByText(sshKey.fingerprint)).toBeInTheDocument();
    expect(within(before).queryByText(sshKey.fingerprint)).toBeNull();
  });

  it("shows no comparison when nothing is pinned yet", () => {
    render(<FingerprintCheck offered={sshKey} pinned={[]} />);
    expect(screen.queryByRole("group", { name: "Pinned now" })).toBeNull();
  });

  // The LDAPS target and the email relay pin a TLS certificate the same way.
  it("shows a TLS certificate's subject, names, issuer, validity and SHA-256 fingerprint", () => {
    render(
      <FingerprintCheck
        offered={{
          address: "dc1.corp.example.org:636",
          fingerprint: "SHA256:certFingerprintPlaceholder",
          issuer: "CN=Example Issuing CA",
          kind: "tls-certificate",
          notAfter: "2027-06-01",
          notBefore: "2026-06-01",
          sans: ["dc1.corp.example.org", "ldap.corp.example.org"],
          subject: "CN=dc1.corp.example.org",
        }}
      />,
    );
    expect(termOf("Subject")).toHaveTextContent("CN=dc1.corp.example.org");
    expect(termOf("Alternative names")).toHaveTextContent(
      "dc1.corp.example.org, ldap.corp.example.org",
    );
    expect(termOf("Issuer")).toHaveTextContent("CN=Example Issuing CA");
    expect(termOf("Valid")).toHaveTextContent("2026-06-01 to 2027-06-01");
    expect(termOf("SHA-256")).toHaveTextContent("SHA256:certFingerprintPlaceholder");
    expect(termOf("Address")).toHaveTextContent("dc1.corp.example.org:636");
    expect(screen.queryByText("Key type")).toBeNull();
  });
});
