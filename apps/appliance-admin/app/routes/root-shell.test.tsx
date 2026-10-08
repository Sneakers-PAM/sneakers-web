import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { setSession } from "@/lib/osadmin/sessionStore";
import RootShell from "@/routes/root-shell";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

type User = ReturnType<typeof userEvent.setup>;

const ask = async (user: User, challenge: string, code: string) => {
  await user.type(await screen.findByLabelText("Challenge from the SSH menu"), challenge);
  await user.type(screen.getByLabelText("Authenticator code"), code);
  await user.click(screen.getByRole("button", { name: "Get the code" }));
};

describe("RootShell", () => {
  it("answers a pasted challenge with a one-use code, its expiry and the SSH source", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    renderPage(RootShell);
    await ask(user, "k3m9 7pqx 2hdw r4te", "314159");
    const result = within(await screen.findByRole("region", { name: "Your root-shell code" }));
    expect(result.getByLabelText("Root-shell code")).toHaveTextContent(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(
      result.getByText(/works once, for this challenge only, until \d{1,2}:\d{2}/),
    ).toBeInTheDocument();
    expect(result.getByText(/may stay open 10 minutes/)).toBeInTheDocument();
    expect(result.getByText(/192\.0\.2\.50/)).toBeInTheDocument();
    expect(result.getByRole("timer")).toBeInTheDocument();
  });

  it("keeps a wrong authenticator code's refusal on the page", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    renderPage(RootShell);
    await ask(user, "K3M9-7PQX-2HDW-R4TE", "000000");
    expect(await screen.findByText(/That code didn't work/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Your root-shell code" })).not.toBeInTheDocument();
  });

  it("says when the challenge isn't one from the SSH menu", async () => {
    signInAs("alice");
    const user = userEvent.setup();
    renderPage(RootShell);
    await ask(user, "not a challenge", "314159");
    expect(await screen.findByText(/isn't a challenge from your SSH menu/)).toBeInTheDocument();
  });

  it("tells an admin who isn't a root operator how to become one, with no form", () => {
    setSession({ admin: "carol", csrfToken: "c", role: "ROLE_ADMIN", rootOperator: false });
    renderPage(RootShell);
    expect(screen.getByText(/Only root operators can open the root shell/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Challenge from the SSH menu")).not.toBeInTheDocument();
  });
});
