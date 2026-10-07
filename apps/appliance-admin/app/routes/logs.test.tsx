import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Logs from "@/routes/logs";
import { renderPage } from "@/test/renderPage";

describe("Logs", () => {
  it("lists the audit events and keeps the support bundle behind Advanced and a flag", async () => {
    const user = userEvent.setup();
    renderPage(Logs);
    expect(await screen.findByText("Logs and audit")).toBeInTheDocument();
    expect(screen.getByText("signin.signout")).toBeInTheDocument();
    expect(screen.getByText(/refused \(ACCESS_KEY_WEAK\)/)).toBeInTheDocument();
    await user.click(screen.getByText("Advanced: support bundle"));
    expect(screen.getByText("Not available in this release.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download support bundle" }),
    ).not.toBeInTheDocument();
  });
});
