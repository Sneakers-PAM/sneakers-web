import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Backups from "@/routes/backups";
import { renderPage } from "@/test/renderPage";

describe("Backups", () => {
  it("shows the policy and the backup sets", async () => {
    renderPage(Backups);
    expect(await screen.findByText("Backups")).toBeInTheDocument();
    expect(screen.getByDisplayValue("02:00")).toBeInTheDocument();
    expect(screen.getByText("bk-20261006")).toBeInTheDocument();
  });

  it("runs a backup now and adds a new set", async () => {
    const user = userEvent.setup();
    renderPage(Backups);
    await screen.findByText("Backups");
    const before = screen.getAllByText(/^bk-/).length;
    await user.click(screen.getByRole("button", { name: "Run now" }));
    await screen.findByText("Backups");
    expect(await screen.findAllByText(/^bk-/)).toHaveLength(before + 1);
  });
});
