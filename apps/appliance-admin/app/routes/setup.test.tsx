import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { csrfToken, getSession } from "@/lib/osadmin/sessionStore";
import {
  applyMockScenario,
  MOCK_INVITE_CODE,
  MOCK_PASSWORD,
  MOCK_SETUP_CODE,
} from "@/mock/edge.mock";
import Setup from "@/routes/setup";

type User = ReturnType<typeof userEvent.setup>;

const open = () => {
  const Stub = createRoutesStub([
    { Component: Setup, path: "/setup" },
    { Component: () => <p>Status page</p>, path: "/home" },
    { Component: () => <p>Updates page</p>, path: "/updates" },
  ]);
  return render(<Stub initialEntries={["/setup"]} />);
};

const progress = () => within(screen.getByRole("navigation", { name: "Setup progress" }));

const current = () =>
  progress()
    .getAllByRole("listitem")
    .find((item) => item.getAttribute("aria-current") === "step");

const redeem = async (user: User, code = MOCK_SETUP_CODE) => {
  await user.type(await screen.findByLabelText("Setup code"), code);
  await user.click(screen.getByRole("button", { name: "Continue" }));
};

const createAdmin = async (user: User) => {
  await user.type(await screen.findByLabelText("Admin name"), "alice");
  await user.type(screen.getByLabelText("Password"), MOCK_PASSWORD);
  await user.type(screen.getByLabelText("Password again"), MOCK_PASSWORD);
  await screen.findByText("Strong enough.");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.type(await screen.findByLabelText("6-digit code from the app"), "482913");
  await user.click(screen.getByRole("button", { name: "Continue" }));
};

describe("Setup", () => {
  it("starts a fresh box at step 1 of 6, with the progress line", async () => {
    applyMockScenario("first-boot");
    open();
    expect(await screen.findByText("Step 1 of 6: Enter the setup code")).toBeInTheDocument();
    expect(progress().getAllByRole("listitem")).toHaveLength(6);
    expect(current()).toHaveTextContent("1");
    expect(
      screen.getByText(
        "16 characters, XXXX-XXXX-XXXX-XXXX. Dashes and capital letters don't matter.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Setup code")).toHaveAttribute(
      "placeholder",
      "XXXX-XXXX-XXXX-XXXX",
    );
    expect(screen.queryByText(MOCK_SETUP_CODE)).not.toBeInTheDocument();
  });

  it("takes the 16-character setup code with spaces instead of dashes, and refuses half of it", async () => {
    applyMockScenario("first-boot");
    const user = userEvent.setup();
    open();
    await redeem(user, MOCK_SETUP_CODE.slice(0, 9));
    expect(
      await screen.findByText(/tries left before the console shows a new code/),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Setup code"));
    await redeem(user, MOCK_SETUP_CODE.replaceAll("-", " "));
    expect(await screen.findByText("Step 2 of 6: Create the first admin")).toBeInTheDocument();
  });

  it("says how many tries a wrong setup code leaves", async () => {
    applyMockScenario("first-boot");
    const user = userEvent.setup();
    open();
    await redeem(user, "AAAA-BBBB");
    expect(
      await screen.findByText(/4 tries left before the console shows a new code/),
    ).toBeInTheDocument();
  });

  it("takes the code in any case and without dashes, then creates the first admin", async () => {
    applyMockScenario("first-boot");
    const user = userEvent.setup();
    open();
    await redeem(user, MOCK_SETUP_CODE.replaceAll("-", "").toLowerCase());
    expect(await screen.findByText("Step 2 of 6: Create the first admin")).toBeInTheDocument();
    expect(current()).toHaveTextContent("2");
    await createAdmin(user);
    expect(await screen.findByText("Step 3 of 6: Add a recovery key")).toBeInTheDocument();
    expect(getSession()?.admin).toBe("alice");
  });

  it("uses the redeemed code's CSRF token until the admin is signed in", async () => {
    applyMockScenario("first-boot");
    const user = userEvent.setup();
    open();
    await redeem(user);
    await screen.findByText("Step 2 of 6: Create the first admin");
    expect(csrfToken()).toBe("mock-code-csrf");
    await createAdmin(user);
    await screen.findByText("Step 3 of 6: Add a recovery key");
    expect(csrfToken()).toBe("mock-csrf-alice");
  });

  it("checks the password as it's typed, and needs it twice", async () => {
    applyMockScenario("setup-admin");
    const user = userEvent.setup();
    open();
    await user.type(await screen.findByLabelText("Admin name"), "alice");
    const password = screen.getByLabelText("Password");
    await user.type(password, "short");
    expect(await screen.findByText("Use at least 12 characters.")).toBeInTheDocument();
    await user.clear(password);
    await user.type(password, "password1234");
    expect(await screen.findByText(/on a list of breached passwords/)).toBeInTheDocument();
    await user.clear(password);
    await user.type(password, MOCK_PASSWORD);
    expect(await screen.findByText("Strong enough.")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText("Password again"), `${MOCK_PASSWORD}x`);
    expect(screen.getByText("The two passwords don't match.")).toBeInTheDocument();
    expect(next).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Show the password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("shows the authenticator as a QR code and a typed key, and says what to do if it's lost", async () => {
    applyMockScenario("setup-admin");
    const user = userEvent.setup();
    open();
    await user.type(await screen.findByLabelText("Admin name"), "alice");
    await user.type(screen.getByLabelText("Password"), MOCK_PASSWORD);
    await user.type(screen.getByLabelText("Password again"), MOCK_PASSWORD);
    await screen.findByText("Strong enough.");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Step 2 of 6: Add your authenticator")).toBeInTheDocument();
    expect(screen.getByTitle("QR code for your authenticator app")).toBeInTheDocument();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP GZ4T KNRW MV2X 4Y3Q")).toBeInTheDocument();
    expect(
      screen.getByText(
        "If you lose your authenticator, another owner can reset it, or use Recover access on the console.",
      ),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("6-digit code from the app"), "000000");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
  });

  it("needs one recovery key before step 4, and offers the escrow", async () => {
    applyMockScenario("setup-keys");
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Step 3 of 6: Add a recovery key")).toBeInTheDocument();
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    await user.type(
      screen.getByLabelText("Public key"),
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest",
    );
    await user.type(screen.getByLabelText("Label"), "backup-1");
    await user.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("backup-1")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Download the recovery bundle escrow-20261007.age/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Step 4 of 6: Network (optional)")).toBeInTheDocument();
  });

  it("resumes where setup is after a reload, and shows the network the box got", async () => {
    applyMockScenario("setup-network");
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Step 4 of 6: Network (optional)")).toBeInTheDocument();
    expect(await screen.findByText("appliance.example.org")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.0/24")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Step 5 of 6: How your data is protected")).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText(/Sealed in the TPM/)).toBeInTheDocument();
  });

  it("says plainly what reduced protection means", async () => {
    applyMockScenario("setup-protection");
    applyMockScenario("reduced");
    open();
    expect(await screen.findByText("Reduced")).toBeInTheDocument();
    expect(screen.getByText(/In a key file on the disk/)).toBeInTheDocument();
    expect(screen.getByText(/Someone who takes this disk could read its data/)).toBeInTheDocument();
  });

  it("finishes with one sign-in after the single-admin warning", async () => {
    applyMockScenario("setup-finish");
    const user = userEvent.setup();
    open();
    expect(await screen.findByText("Step 6 of 6: Sign in to finish")).toBeInTheDocument();
    expect(screen.getByLabelText("Admin name")).toHaveValue("alice");
    await user.type(screen.getByLabelText("Password"), MOCK_PASSWORD);
    await user.type(screen.getByLabelText("Authenticator code"), "135790");
    const finish = screen.getByRole("button", { name: "Sign in and finish" });
    expect(finish).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Go on with one admin/ }));
    await user.click(finish);
    expect(await screen.findByText("Setup is complete")).toBeInTheDocument();
    expect(screen.getByText(/You're signed in as alice/)).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Go to Updates" }));
    expect(await screen.findByText("Updates page")).toBeInTheDocument();
  });

  it("takes an invitation code: the name is fixed, then a password and an authenticator", async () => {
    applyMockScenario("invited");
    const user = userEvent.setup();
    open();
    await redeem(user, MOCK_INVITE_CODE);
    expect(
      await screen.findByRole("heading", { name: "Set your password and authenticator" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Setup progress" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Admin name")).toHaveValue("carol");
    expect(screen.getByLabelText("Admin name")).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Password"), MOCK_PASSWORD);
    await user.type(screen.getByLabelText("Password again"), MOCK_PASSWORD);
    await screen.findByText("Strong enough.");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("6-digit code from the app"), "246801");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Status page")).toBeInTheDocument();
    expect(getSession()?.admin).toBe("carol");
  });

  it("sends a set-up box's signed-in admin to Status", async () => {
    applyMockScenario("signed-in");
    open();
    expect(await screen.findByText("Status page")).toBeInTheDocument();
  });
});
