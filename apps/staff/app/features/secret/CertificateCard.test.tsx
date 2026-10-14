import { render, screen } from "@testing-library/react";

import { CertificateCard } from "@/features/secret/CertificateCard";

describe("CertificateCard", () => {
  it("wraps a long SHA-256 fingerprint instead of letting it run off the panel", () => {
    const fingerprint = `SHA256:${"A".repeat(300)}`;
    render(
      <CertificateCard
        fields={{
          fingerprintSha256: fingerprint,
          isCA: "false",
          issuer: "CN=Example Issuing CA",
          keyAlgorithm: "RSA",
          keyBits: "2048",
          notAfter: "2030-01-01T00:00:00Z",
          notBefore: "2024-01-01T00:00:00Z",
          serialNumber: "01",
          subject: "CN=box.example.org",
        }}
        now={Date.parse("2025-01-01T00:00:00Z")}
      />,
    );
    expect(screen.getByText(fingerprint)).toHaveClass("min-w-0", "flex-1", "wrap-anywhere");
  });
});
