import { edge } from "@sneakers-web/edge";
import { toast } from "@sneakers-web/ui";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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

const row = (target: string) =>
  within(screen.getAllByRole("row").find((r) => within(r).queryByText(target))!);

const saved = () => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:logs");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  return vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
};
const card = () => within(screen.getByRole("region", { name: "Download logs" }));
const openLogs = async () => {
  renderPage(Logs);
  await screen.findByText("Logs and audit");
};
const deferred = <T,>() => {
  const held: { resolve: (value: T) => void } = { resolve: () => {} };
  const promise = new Promise<T>((resolve) => {
    held.resolve = resolve;
  });
  return { promise, resolve: (value: T) => held.resolve(value) };
};

describe("Logs", () => {
  // A toast from one test would otherwise still be on screen in the next.
  afterEach(() => void toast.dismiss());

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

  it("confirms with a toast once the support bundle is saved", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:support-bundle");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await user.click(await openBundle(user));
    expect(await screen.findByText("Support bundle downloaded.")).toBeInTheDocument();
  });

  it("confirms with a toast once the audit log is exported", async () => {
    const user = userEvent.setup();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:audit-log");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPage(Logs);
    await screen.findByText("Logs and audit");
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("Audit log exported.")).toBeInTheDocument();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe("audit-log.jsonl");
  });

  it("says in a toast when the audit log can't be exported", async () => {
    const user = userEvent.setup();
    vi.spyOn(audit, "exportLog").mockRejectedValueOnce(new Error("boom"));
    renderPage(Logs);
    await screen.findByText("Logs and audit");
    await user.click(screen.getByRole("button", { name: "Export" }));
    expect(await screen.findByText("The audit log didn't export. Try again.")).toBeInTheDocument();
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

  describe("Download logs", () => {
    it("offers the four windows with 24 hours chosen, and no custom range until asked", async () => {
      await openLogs();
      expect(card().getByRole("radio", { name: "24 hours" })).toBeChecked();
      for (const name of ["15 minutes", "1 hour", "6 hours", "Custom range"])
        expect(card().getByRole("radio", { name })).not.toBeChecked();
      expect(card().queryByLabelText("From")).not.toBeInTheDocument();
    });

    it("downloads the chosen window under the name the box gives it, and says so", async () => {
      const user = userEvent.setup();
      const click = saved();
      const exportLogs = vi.spyOn(edge, "exportLogs");
      await openLogs();
      await user.click(card().getByRole("radio", { name: "6 hours" }));
      await user.click(card().getByRole("button", { name: "Download logs" }));
      await waitFor(() => expect(click).toHaveBeenCalledOnce());
      expect(exportLogs).toHaveBeenCalledWith("window=6h");
      expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe(
        "sneakers-logs-20261115T120000Z-20261116T120000Z.tar.gz",
      );
      expect(await screen.findByText("Logs downloaded.")).toBeInTheDocument();
    });

    it("says the box is still writing the archive, and offers no second click meanwhile", async () => {
      const user = userEvent.setup();
      saved();
      const pending = deferred<{ blob: Blob; fileName: string }>();
      vi.spyOn(edge, "exportLogs").mockReturnValueOnce(pending.promise);
      await openLogs();
      await user.click(card().getByRole("button", { name: "Download logs" }));
      expect(await card().findByText(/The box is writing the archive/)).toBeInTheDocument();
      expect(card().getByRole("button", { name: "Preparing the logs" })).toBeDisabled();
      pending.resolve({ blob: new Blob(["x"]), fileName: "l.tar.gz" });
      await waitFor(() =>
        expect(card().getByRole("button", { name: "Download logs" })).toBeEnabled(),
      );
    });

    it("refuses a custom range over seven days before asking the box", async () => {
      const user = userEvent.setup();
      const click = saved();
      const exportLogs = vi.spyOn(edge, "exportLogs");
      await openLogs();
      await user.click(card().getByRole("radio", { name: "Custom range" }));
      fireEvent.change(card().getByLabelText("From"), { target: { value: "2026-11-01T00:00" } });
      fireEvent.change(card().getByLabelText("To"), { target: { value: "2026-11-16T00:00" } });
      await user.click(card().getByRole("button", { name: "Download logs" }));
      expect(await card().findByText("The range can be at most 7 days.")).toBeInTheDocument();
      expect(exportLogs).not.toHaveBeenCalled();
      expect(click).not.toHaveBeenCalled();
    });

    it("sends a custom range as UTC, both ends", async () => {
      const user = userEvent.setup();
      saved();
      const exportLogs = vi.spyOn(edge, "exportLogs");
      await openLogs();
      await user.click(card().getByRole("radio", { name: "Custom range" }));
      fireEvent.change(card().getByLabelText("From"), { target: { value: "2026-11-16T10:00" } });
      fireEvent.change(card().getByLabelText("To"), { target: { value: "2026-11-16T12:00" } });
      await user.click(card().getByRole("button", { name: "Download logs" }));
      await waitFor(() => expect(exportLogs).toHaveBeenCalledOnce());
      const sent = new URLSearchParams(exportLogs.mock.calls[0]![0]);
      expect(sent.get("from")).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00Z$/);
      expect(Date.parse(sent.get("to")!) - Date.parse(sent.get("from")!)).toBe(2 * 3_600_000);
      expect(sent.has("window")).toBe(false);
    });

    it("shows the box's refusal in its own words, with no file saved", async () => {
      const user = userEvent.setup();
      const click = saved();
      vi.spyOn(edge, "exportLogs").mockRejectedValueOnce(
        new OsadminError(
          "failed_precondition",
          "Another log export is running. Try again in 10 seconds.",
        ),
      );
      await openLogs();
      await user.click(card().getByRole("button", { name: "Download logs" }));
      expect(
        await card().findByText("Another log export is running. Try again in 10 seconds."),
      ).toBeInTheDocument();
      expect(click).not.toHaveBeenCalled();
    });

    it("reports a download that broke part way as failed, with no file saved", async () => {
      const user = userEvent.setup();
      const click = saved();
      vi.spyOn(edge, "exportLogs").mockRejectedValueOnce(
        new OsadminError(
          "unavailable",
          "The download broke part way, so nothing was saved. Try again.",
        ),
      );
      await openLogs();
      await user.click(card().getByRole("button", { name: "Download logs" }));
      expect(await card().findByText(/broke part way, so nothing was saved/)).toBeInTheDocument();
      expect(click).not.toHaveBeenCalled();
      expect(screen.queryByText("Logs downloaded.")).not.toBeInTheDocument();
    });

    it("says an older box can't download logs yet", async () => {
      const user = userEvent.setup();
      vi.spyOn(edge, "exportLogs").mockRejectedValueOnce(
        new OsadminError("unimplemented", "This box has no log download."),
      );
      await openLogs();
      await user.click(card().getByRole("button", { name: "Download logs" }));
      expect(await card().findByText(/can't download its logs yet/)).toBeInTheDocument();
    });
  });
});
