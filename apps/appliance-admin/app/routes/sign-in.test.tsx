import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { getSession } from "@/lib/osadmin/sessionStore";
import SignIn from "@/routes/sign-in";
import { renderPage } from "@/test/renderPage";

describe("SignIn", () => {
  it("shows the code and the ssh instruction", async () => {
    renderPage(SignIn);
    expect(await screen.findByText("ABCD-1234")).toBeInTheDocument();
    expect(screen.getByText(/login ABCD-1234/)).toBeInTheDocument();
  });

  it("signs in as a fixture admin from the dev quick login", async () => {
    const user = userEvent.setup();
    renderPage(SignIn);
    await screen.findByText("ABCD-1234");
    await user.click(screen.getByRole("combobox", { name: /Dev quick login/ }));
    await user.click(screen.getByRole("option", { name: /alice/ }));
    expect(getSession()?.admin).toBe("alice");
  });
});
