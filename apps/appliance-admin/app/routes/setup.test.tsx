import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Setup from "@/routes/setup";
import { renderPage } from "@/test/renderPage";

describe("Setup", () => {
  it("shows the one recovery key and lets a multi-admin box finish", async () => {
    renderPage(Setup);
    expect(await screen.findByText("Setup")).toBeInTheDocument();
    expect(screen.getByText("offline safe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Finish" })).not.toBeDisabled();
  });

  it("adds a recovery key from the form", async () => {
    const user = userEvent.setup();
    renderPage(Setup);
    await screen.findByText("Setup");
    await user.type(
      screen.getByLabelText(/Public key/),
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAItest",
    );
    await user.type(screen.getByLabelText("Label"), "second key");
    await user.click(screen.getByRole("button", { name: "Add recovery key" }));
    expect(await screen.findByText("second key")).toBeInTheDocument();
  });
});
