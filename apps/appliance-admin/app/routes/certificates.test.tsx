import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { tls } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { MISSING_INTERMEDIATE, MOCK_PFX_PASSWORD } from "@/mock/certificates.mock";
import { applyMockScenario } from "@/mock/edge.mock";
import Certificates from "@/routes/certificates";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const PEM_CERT = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----";
const PEM_KEY = "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----";

const openAdd = async (user: ReturnType<typeof userEvent.setup>) => {
  await screen.findByRole("heading", { level: 1, name: "Certificates" });
  await user.click(screen.getByRole("button", { name: "Add certificate" }));
  return screen.findByRole("dialog");
};

describe("Certificates", () => {
  beforeEach(() => signInAs("alice"));

  it("shows the store, the endpoints, ACME and the status", async () => {
    renderPage(Certificates);
    const store = await screen.findByRole("table", { name: "Certificates" });
    expect(within(store).getByText("Self-signed")).toBeInTheDocument();
    const endpoints = screen.getByRole("region", { name: "Endpoints" });
    expect(within(endpoints).getByText(":8443 admin")).toBeInTheDocument();
    expect(
      within(endpoints).getByText("Available when the product is installed."),
    ).toBeInTheDocument();
    const acme = screen.getByRole("region", { name: "ACME / cert-manager" });
    expect(within(acme).getAllByText(/Not available yet/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/This page uses the box's own self-signed certificate/),
    ).toBeInTheDocument();
  });

  it("says it isn't available when the box's certificate backend isn't there", async () => {
    vi.spyOn(tls, "get").mockRejectedValueOnce(
      new OsadminError("unimplemented", "Not available in this release"),
    );
    renderPage(Certificates);
    expect(
      await screen.findByText("Certificates: not available in this release"),
    ).toBeInTheDocument();
  });

  it("offers Upload PFX first, then PEM, then a request on this box", async () => {
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    const choices = within(dialog).getAllByRole("radio");
    expect(choices.map((c) => c.getAttribute("value"))).toEqual(["pfx", "pem", "csr"]);
    expect(choices[0]).toBeChecked();
    expect(within(dialog).getByText("Recommended")).toBeInTheDocument();
  });

  it("imports a PFX, lists its checks and applies it to :8443", async () => {
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.upload(
      within(dialog).getByLabelText("PFX file"),
      new File([new Uint8Array([48, 130, 1])], "wildcard.example.org.pfx"),
    );
    await user.type(within(dialog).getByLabelText("Password"), MOCK_PFX_PASSWORD);
    await user.click(within(dialog).getByRole("button", { name: "Validate and save" }));
    expect(await within(dialog).findByText("Validation passed")).toBeInTheDocument();
    expect(within(dialog).getByText(/Example Issuing CA > Example Root CA/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Apply to :8443" }));
    const applied = await within(dialog).findByText(/Applied\. :8443 now serves/);
    expect(applied).toBeInTheDocument();
    // The fingerprint wraps inside the alert instead of running off it (issue #240).
    expect(within(dialog).getByText(/^SHA256:|^[\dA-F]{2}(:[\dA-F]{2})+$/).className).toContain(
      "break-all",
    );
    await user.click(within(dialog).getByRole("button", { name: "Done" }));
    const endpoints = screen.getByRole("region", { name: "Endpoints" });
    const assigned = await within(endpoints).findAllByText(/\*\.example\.org/);
    expect(assigned.length).toBeGreaterThan(0);
  });

  it("says a PFX password is wrong, and keeps the password out of the page after", async () => {
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.upload(within(dialog).getByLabelText("PFX file"), new File(["x"], "a.pfx"));
    await user.type(within(dialog).getByLabelText("Password"), "nope");
    await user.click(within(dialog).getByRole("button", { name: "Validate and save" }));
    expect(await within(dialog).findByText("the PKCS#12 password is wrong")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Password")).toHaveValue("");
  });

  it("names a missing intermediate on a PEM upload and changes nothing", async () => {
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("radio", { name: /Upload PEM/ }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.type(
      within(dialog).getByLabelText("Certificate (PEM)"),
      `${PEM_CERT}\n${MISSING_INTERMEDIATE}`,
    );
    await user.type(within(dialog).getByLabelText("Private key (PEM)"), PEM_KEY);
    await user.click(within(dialog).getByRole("button", { name: "Validate and save" }));
    expect(await within(dialog).findByText("Validation failed")).toBeInTheDocument();
    expect(within(dialog).getAllByText(/isn't in the upload/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(/Nothing was changed/)).toBeInTheDocument();
  });

  it("refuses a wildcard in a request made on this box, then makes a single-name CSR", async () => {
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("radio", { name: /Create a request on this box/ }));
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByRole("radio", { name: /RSA 4096/ })).toBeChecked();
    const name = within(dialog).getByLabelText(/Name for the certificate/);
    await user.type(name, "*.example.org");
    expect(
      within(dialog).getByText(/wildcard key is shared across servers; import it with Upload PFX/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Generate CSR" })).toBeDisabled();
    await user.clear(name);
    await user.type(name, "admin.example.org");
    await user.click(within(dialog).getByRole("button", { name: "Generate CSR" }));
    expect(
      await within(dialog).findByDisplayValue(/BEGIN CERTIFICATE REQUEST/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/admin\.example\.org, appliance\.example\.org/),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("button", { name: "Next: upload signed certificate" }),
    );
    await user.type(within(dialog).getByLabelText("Signed certificate (PEM)"), PEM_CERT);
    await user.click(within(dialog).getByRole("button", { name: "Validate and save" }));
    expect(await within(dialog).findByText("Validation passed")).toBeInTheDocument();
  });

  it("says when :8443 didn't serve the new certificate and the previous one is back", async () => {
    applyMockScenario("cert-not-served");
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.upload(within(dialog).getByLabelText("PFX file"), new File(["x"], "a.pfx"));
    await user.type(within(dialog).getByLabelText("Password"), MOCK_PFX_PASSWORD);
    await user.click(within(dialog).getByRole("button", { name: "Validate and save" }));
    await user.click(await within(dialog).findByRole("button", { name: "Apply to :8443" }));
    expect(await within(dialog).findByText(/the previous one was put back/)).toBeInTheDocument();
  });

  it("reverts :8443 to self-signed", async () => {
    applyMockScenario("cert-assigned");
    const user = userEvent.setup();
    renderPage(Certificates);
    const endpoints = await screen.findByRole("region", { name: "Endpoints" });
    await user.click(within(endpoints).getByRole("button", { name: "Revert to self-signed" }));
    await user.click(await screen.findByRole("button", { name: "Revert" }));
    expect(await within(endpoints).findByText("Self-signed")).toBeInTheDocument();
  });

  it("deletes only a certificate nothing uses", async () => {
    applyMockScenario("cert-assigned");
    renderPage(Certificates);
    const store = await screen.findByRole("table", { name: "Certificates" });
    expect(within(store).queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Delete is off for a certificate in use/)).toBeInTheDocument();
  });

  it("shows a pending CSR with its download and upload", async () => {
    applyMockScenario("cert-csr-pending");
    renderPage(Certificates);
    const pending = await screen.findByRole("table", { name: "Pending requests" });
    expect(within(pending).getByText(/admin\.example\.org/)).toBeInTheDocument();
    expect(within(pending).getByRole("button", { name: "Download CSR" })).toBeInTheDocument();
    expect(
      within(pending).getByRole("button", { name: "Upload signed certificate" }),
    ).toBeInTheDocument();
  });

  it("warns when an assigned certificate expires soon, since nothing renews it", async () => {
    applyMockScenario("cert-expiring");
    renderPage(Certificates);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/expires in 1[12] days/);
  });

  it("shows the names the box checks a certificate against", async () => {
    renderPage(Certificates);
    const endpoints = await screen.findByRole("region", { name: "Endpoints" });
    expect(
      within(endpoints).getByText("Checked against: appliance.example.org, 192.0.2.10"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Set the host name on Network/ })).toBeNull();
  });

  it("says when the box has no host name, and links to Network to set it", async () => {
    applyMockScenario("cert-no-hostname");
    renderPage(Certificates);
    const notice = await screen.findByRole("region", { name: "No host name" });
    expect(within(notice).getByRole("status")).toHaveTextContent("No host name");
    expect(notice).toHaveTextContent(
      /This box has no host name yet, so a certificate is checked against 192\.0\.2\.10 only/,
    );
    expect(
      within(notice).getByRole("link", { name: "Set the host name on Network" }),
    ).toHaveAttribute("href", "/network");
    const endpoints = screen.getByRole("region", { name: "Endpoints" });
    expect(within(endpoints).getByText("Checked against: 192.0.2.10")).toBeInTheDocument();
  });

  it("refuses a wildcard PFX on a box with no host name, naming both sides and Network", async () => {
    applyMockScenario("cert-no-hostname");
    const user = userEvent.setup();
    renderPage(Certificates);
    const dialog = await openAdd(user);
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    await user.upload(within(dialog).getByLabelText("PFX file"), new File(["x"], "a.pfx"));
    await user.type(within(dialog).getByLabelText("Password"), MOCK_PFX_PASSWORD);
    await user.click(within(dialog).getByRole("button", { name: "Validate and save" }));
    const refusal = await within(dialog).findByRole("alert");
    expect(refusal).toHaveTextContent(/checked against 192\.0\.2\.10 only/);
    expect(refusal).toHaveTextContent(/it covers \*\.example\.org, example\.org/);
    expect(
      within(refusal).getByRole("link", { name: "Set the host name on Network" }),
    ).toHaveAttribute("href", "/network");
  });

  it("lets an admin who isn't an owner look, not change", async () => {
    signInAs("bob");
    renderPage(Certificates);
    await screen.findByRole("heading", { level: 1, name: "Certificates" });
    expect(screen.getByRole("button", { name: "Add certificate" })).toBeDisabled();
    expect(screen.getByText("Only an owner can change certificates.")).toBeInTheDocument();
  });
});
