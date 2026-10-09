import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { importer } from "@/lib/osadmin/client";
import { applyMockScenario } from "@/mock/edge.mock";
import Import from "@/routes/import";
import { renderPage } from "@/test/renderPage";

describe("Import", () => {
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

  it("has nothing to show with no product installed", async () => {
    applyMockScenario("no-product");
    const get = vi.spyOn(importer, "get");
    renderPage(Import);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });
});
