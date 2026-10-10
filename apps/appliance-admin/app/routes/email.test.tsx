import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepUpDialog } from "@/components/StepUpDialog";
import { email } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario } from "@/mock/edge.mock";
import Email from "@/routes/email";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const UNENCRYPTED = /Mail and the relay password are sent unencrypted/;

const fillRelay = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByLabelText("Relay host"), "relay.example.org");
  await user.type(screen.getByLabelText("From address"), "no-reply@sneakers.example.org");
  await user.type(screen.getByLabelText("Username"), "mailer");
  await user.type(screen.getByLabelText("Password"), "relay-pass");
};

describe("Email", () => {
  it("starts with no relay, STARTTLS on 587 and verification on, and no warning", async () => {
    renderPage(Email);
    expect(await screen.findByLabelText("Relay host")).toHaveValue("");
    expect(screen.getByLabelText("Port")).toHaveValue("587");
    expect(screen.getByRole("radio", { name: "STARTTLS" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Verify the certificate" })).toBeChecked();
    expect(screen.getByText(/No relay is set/)).toBeInTheDocument();
    expect(screen.queryByText(UNENCRYPTED)).not.toBeInTheDocument();
  });

  it("warns whenever TLS is off or verification is off", async () => {
    const user = userEvent.setup();
    renderPage(Email);
    await user.click(await screen.findByRole("radio", { name: "None" }));
    expect(screen.getByText(UNENCRYPTED)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "TLS" }));
    expect(screen.queryByText(UNENCRYPTED)).not.toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Verify the certificate" }));
    expect(screen.getByText(UNENCRYPTED)).toBeInTheDocument();
  });

  it("saves the relay, says the product is applied again, and never shows the password back", async () => {
    const user = userEvent.setup();
    const set = vi.spyOn(email, "set");
    renderPage(Email);
    await fillRelay(user);
    await user.click(screen.getByRole("button", { name: "Save and apply" }));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    expect(set.mock.calls[0]?.[0]).toMatchObject({
      password: "relay-pass",
      settings: {
        from: "no-reply@sneakers.example.org",
        host: "relay.example.org",
        port: 587,
        tls: "EMAIL_TLS_STARTTLS",
        username: "mailer",
        verify: true,
      },
    });
    expect(await screen.findByText(/A password is saved/)).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByText(/product is applied again/)).toBeInTheDocument();
  });

  it("keeps the saved password unless one is typed, and can clear it", async () => {
    const user = userEvent.setup();
    renderPage(Email);
    await fillRelay(user);
    await user.click(screen.getByRole("button", { name: "Save and apply" }));
    await screen.findByText(/A password is saved/);
    const set = vi.spyOn(email, "set");
    await user.click(screen.getByRole("button", { name: "Save and apply" }));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    expect(set.mock.calls[0]?.[0].password).toBeUndefined();
    await user.click(screen.getByRole("checkbox", { name: "Clear the saved password" }));
    await user.click(screen.getByRole("button", { name: "Save and apply" }));
    await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(2));
    expect(set.mock.calls[1]?.[0].password).toBe("");
  });

  it("takes the relay CA from a PEM file", async () => {
    const user = userEvent.setup();
    renderPage(Email);
    const pem = "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----\n";
    await user.upload(await screen.findByLabelText("Relay CA file"), new File([pem], "ca.pem"));
    await vi.waitFor(() => expect(screen.getByLabelText("Relay CA")).toHaveValue(pem));
  });

  it("shows the box's refusal of a bad setting", async () => {
    const user = userEvent.setup();
    renderPage(Email);
    await user.type(await screen.findByLabelText("Relay host"), "relay.example.org");
    await user.type(screen.getByLabelText("From address"), "Mailer");
    await user.click(screen.getByRole("button", { name: "Save and apply" }));
    expect(await screen.findByText(/isn't a plain email address/)).toBeInTheDocument();
  });

  it("sends a test email to the address typed in, through the settings on the page", async () => {
    const user = userEvent.setup();
    const test = vi.spyOn(email, "test");
    renderPage(Email);
    await fillRelay(user);
    await user.type(screen.getByLabelText("Send a test to"), "admin@example.org");
    await user.click(screen.getByRole("button", { name: "Send test email" }));
    expect(await screen.findByText(/the relay took the message/)).toBeInTheDocument();
    expect(test.mock.calls[0]?.[0]).toMatchObject({
      password: "relay-pass",
      settings: { host: "relay.example.org" },
      to: "admin@example.org",
    });
  });

  it("shows why a test email didn't go out", async () => {
    const user = userEvent.setup();
    renderPage(Email);
    await user.type(await screen.findByLabelText("Relay host"), "unreachable.example.org");
    await user.type(screen.getByLabelText("From address"), "no-reply@sneakers.example.org");
    await user.type(screen.getByLabelText("Send a test to"), "admin@example.org");
    await user.click(screen.getByRole("button", { name: "Send test email" }));
    expect(await screen.findByText(/can't be reached/)).toBeInTheDocument();
  });

  it("asks for a fresh code before it saves", async () => {
    signInAs("alice");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(() => (
      <>
        <Email />
        <StepUpDialog />
      </>
    ));
    await fillRelay(user);
    await user.click(screen.getByRole("button", { name: "Save and apply" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Authenticator code"), "123456");
    await user.click(dialog.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByText(/A password is saved/)).toBeInTheDocument();
  });

  it("has no form when the product reads no email settings", async () => {
    applyMockScenario("email-absent");
    renderPage(Email);
    expect(await screen.findByText(/Sneakers sends no mail/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Relay host")).not.toBeInTheDocument();
  });

  it("has nothing to show with no product installed", async () => {
    applyMockScenario("no-product");
    const get = vi.spyOn(email, "get");
    renderPage(Email);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("says it isn't available when the box has no Email backend", async () => {
    vi.spyOn(email, "get").mockRejectedValueOnce(
      new OsadminError("unimplemented", "EmailService isn't on this box"),
    );
    renderPage(Email);
    expect(await screen.findByText("Email: not available in this release")).toBeInTheDocument();
  });
});
