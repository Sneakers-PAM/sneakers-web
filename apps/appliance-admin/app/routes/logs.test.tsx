import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { audit } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import Logs from "@/routes/logs";
import { renderPage } from "@/test/renderPage";

const openBundle = async (user: ReturnType<typeof userEvent.setup>) => {
  renderPage(Logs);
  await screen.findByText("Logs and audit");
  await user.click(screen.getByText("Advanced: support bundle"));
  return screen.getByRole("button", { name: "Download support bundle" });
};

describe("Logs", () => {
  it("lists the audit events and keeps the support bundle behind Advanced", async () => {
    const user = userEvent.setup();
    renderPage(Logs);
    expect(await screen.findByText("Logs and audit")).toBeInTheDocument();
    expect(screen.getByText("signin.signout")).toBeInTheDocument();
    expect(screen.getByText(/refused \(ACCESS_KEY_WEAK\)/)).toBeInTheDocument();
    await user.click(screen.getByText("Advanced: support bundle"));
    expect(screen.getByRole("button", { name: "Download support bundle" })).toBeInTheDocument();
  });

  it("saves the support bundle under the name the box gives it", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:support-bundle");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await user.click(await openBundle(user));
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "support-bundle-box1-20261030T120000Z.zip",
    );
    expect(screen.getByRole("button", { name: "Download support bundle" })).toBeEnabled();
  });

  it("holds the button while the box writes the bundle", async () => {
    const user = userEvent.setup();
    vi.spyOn(audit, "exportSupportBundle").mockReturnValueOnce(new Promise(() => {}));
    await user.click(await openBundle(user));
    expect(await screen.findByRole("button", { name: "Preparing the bundle" })).toBeDisabled();
  });

  it("says a box too old for the support bundle needs an update", async () => {
    const user = userEvent.setup();
    vi.spyOn(audit, "exportSupportBundle").mockRejectedValueOnce(
      new OsadminError("unimplemented", "no support bundle here"),
    );
    await user.click(await openBundle(user));
    expect(
      await screen.findByText(/This box's Base OS can't make a support bundle yet/),
    ).toBeInTheDocument();
  });

  it("shows the box's own words when it refuses the bundle", async () => {
    const user = userEvent.setup();
    vi.spyOn(audit, "exportSupportBundle").mockRejectedValueOnce(
      new OsadminError("unavailable", "Another support bundle is running."),
    );
    await user.click(await openBundle(user));
    expect(await screen.findByText("Another support bundle is running.")).toBeInTheDocument();
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

  it("shows a bare-key SSH refusal readably: ssh.login, its source and ACCESS_KEY_NO_CERTIFICATE", async () => {
    renderPage(Logs);
    await screen.findByText("Logs and audit");
    const row = within(screen.getAllByRole("row").find((r) => within(r).queryByText("ssh.login"))!);
    expect(row.getByText(/refused \(ACCESS_KEY_NO_CERTIFICATE\)/)).toBeInTheDocument();
    expect(row.getByText("SSH source")).toBeInTheDocument();
    expect(row.getByText("192.0.2.50")).toBeInTheDocument();
  });
});
