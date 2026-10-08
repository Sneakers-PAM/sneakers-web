import { screen, within } from "@testing-library/react";
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

  it("names targets in words and shows the ids and the rest of the detail", async () => {
    renderPage(Logs);
    await screen.findByText("Logs and audit");
    const row = (target: string) =>
      within(screen.getAllByRole("row").find((r) => within(r).queryByText(target))!);
    expect(row("*.example.org").getByText("tls.certificate.remove")).toBeInTheDocument();
    expect(row("*.example.org").getByText("Certificate")).toBeInTheDocument();
    expect(row("*.example.org").getByText("c-7f3a9e")).toHaveClass("font-mono");
    expect(row("bob's browser session from 192.0.2.50").getByText("Session")).toBeInTheDocument();
    expect(row("bob's browser session from 192.0.2.50").getByText("S-1A2B")).toHaveClass(
      "font-mono",
    );
    expect(row("bob's elevated shell").getByText("Reason")).toBeInTheDocument();
    expect(row("bob's elevated shell").getByText("investigate kubelet")).not.toHaveClass(
      "font-mono",
    );
  });
});
