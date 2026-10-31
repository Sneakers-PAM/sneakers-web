import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { importer, setup } from "@/lib/osadmin/client";
import { applyMockScenario } from "@/mock/edge.mock";
import Import from "@/routes/import";
import { renderPage } from "@/test/renderPage";

describe("Import", () => {
  it("says what an import leaves behind and refuses, before it's opened and while it's open", async () => {
    const user = userEvent.setup();
    renderPage(Import);
    const note = () => screen.getByRole("region", { name: "The audit trail stays on the old box" });
    await screen.findByRole("button", { name: "Open an import" });
    expect(note()).toHaveTextContent(/one record of the import, naming the box it came from/);
    expect(note()).toHaveTextContent(/format 1\.x .*refused/);
    expect(screen.queryByText(/audit chain in/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open an import" }));
    await screen.findByTestId("import-recipient");
    expect(note()).toBeInTheDocument();
  });

  it("opens an import and shows the box's import key", async () => {
    const user = userEvent.setup();
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Open an import" }));
    expect(await screen.findByTestId("import-recipient")).toHaveTextContent(/^age1/);
    expect(screen.getByText(/--current-only --reset-sign-in/)).toBeInTheDocument();
  });

  it("uploads a file of its kind", async () => {
    const user = userEvent.setup();
    const upload = vi.spyOn(importer, "upload").mockResolvedValue({ bytes: 3 });
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Open an import" }));
    const file = new File(["{}"], "mapping.json", { type: "application/json" });
    await user.upload(await screen.findByLabelText("Mapping file"), file);
    await vi.waitFor(() => expect(upload).toHaveBeenCalledWith("mapping", file));
  });

  it("runs a review and keeps its output", async () => {
    const user = userEvent.setup();
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Open an import" }));
    await user.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Passed")).toBeInTheDocument();
    expect(screen.getByText(/review: done/)).toBeInTheDocument();
  });

  it("imports, says the box is in imported-users mode and shows the first admin's password once", async () => {
    const user = userEvent.setup();
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Open an import" }));
    await user.click(await screen.findByLabelText("Rehearsal"));
    await user.type(screen.getByLabelText("First admin's email"), "admin@example.org");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText("Imported-users mode")).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Show the one-time password" }));
    expect(await screen.findByTestId("owner-password")).toHaveTextContent("mock-one-time-password");
    await vi.waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Show the one-time password" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("closes the import", async () => {
    const user = userEvent.setup();
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Open an import" }));
    await user.click(await screen.findByRole("button", { name: "Close the import" }));
    expect(await screen.findByRole("button", { name: "Open an import" })).toBeInTheDocument();
  });

  it("offers the escrow download before the import is closed, and after", async () => {
    const user = userEvent.setup();
    const escrow = vi.spyOn(setup, "downloadEscrow");
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Open an import" }));
    await user.click(await screen.findByLabelText("Rehearsal"));
    await user.type(screen.getByLabelText("First admin's email"), "admin@example.org");
    await user.click(screen.getByRole("button", { name: "Import" }));
    expect(await screen.findByText("Imported-users mode")).toBeInTheDocument();
    expect(screen.getAllByText(/carries .* keys/).length).toBeGreaterThan(0);
    const before = screen.getAllByRole("button", { name: "Download the escrow" });
    expect(before).toHaveLength(2);
    for (const button of before) await user.click(button);
    await vi.waitFor(() => expect(escrow).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole("button", { name: "Close the import" }));
    await screen.findByRole("button", { name: "Open an import" });
    await user.click(screen.getByRole("button", { name: "Download the escrow" }));
    await vi.waitFor(() => expect(escrow).toHaveBeenCalledTimes(3));
  });

  it("says why a step failed when the box read it from the step's Job", async () => {
    vi.spyOn(importer, "get").mockResolvedValue({
      available: true,
      files: [{ kind: "bundle", size: 3, uploadedAt: "2026-10-13T10:00:00Z" }],
      imported: false,
      importedAt: "",
      importedBundle: "",
      importedMode: "",
      label: "Import from an earlier Sneakers",
      open: true,
      reason: "",
      recipient: "age1mockimportrecipientexampleexampleexampleexampleexampleexample",
      runs: [
        {
          exitCode: 137,
          finishedAt: "2026-10-13T10:05:00Z",
          job: "sneakers-migrate-review-1",
          output: "",
          ownerEmail: "",
          ownerPasswordWaiting: false,
          reason: "the review step ran out of memory (limit 4Gi)",
          rehearsal: false,
          report: "",
          startedAt: "2026-10-13T10:00:00Z",
          state: "failed",
          step: "review",
          template: "",
          wipe: false,
        },
      ],
      setupDone: false,
    });
    renderPage(Import);
    expect(await screen.findByText("Failed (exit 137)")).toBeInTheDocument();
    expect(screen.getByTestId("import-run-reason")).toHaveTextContent(
      "the review step ran out of memory (limit 4Gi)",
    );
    expect(screen.getByRole("button", { name: "Review" })).toBeEnabled();
  });

  it("closes the import while a step runs, after a confirm that it stops the step", async () => {
    const user = userEvent.setup();
    vi.spyOn(importer, "get").mockResolvedValue({
      available: true,
      files: [{ kind: "bundle", size: 3, uploadedAt: "2026-10-13T10:00:00Z" }],
      imported: false,
      importedAt: "",
      importedBundle: "",
      importedMode: "",
      label: "Import from an earlier Sneakers",
      open: true,
      reason: "",
      recipient: "age1mockimportrecipientexampleexampleexampleexampleexampleexample",
      runs: [
        {
          exitCode: 0,
          finishedAt: "",
          job: "sneakers-migrate-review-1",
          output: "",
          ownerEmail: "",
          ownerPasswordWaiting: false,
          reason: "",
          rehearsal: false,
          report: "",
          startedAt: "2026-10-13T10:00:00Z",
          state: "running",
          step: "review",
          template: "",
          wipe: false,
        },
      ],
      setupDone: false,
    });
    const close = vi.spyOn(importer, "close").mockResolvedValue({});
    renderPage(Import);
    await user.click(await screen.findByRole("button", { name: "Close the import" }));
    expect(await screen.findByText(/stops the running review step/)).toBeInTheDocument();
    expect(close).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Stop the step and close" }));
    await vi.waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  });

  it("has nothing to show with no product installed", async () => {
    applyMockScenario("no-product");
    const get = vi.spyOn(importer, "get");
    renderPage(Import);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
