import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { modules } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import Modules from "@/routes/modules";
import { renderPage } from "@/test/renderPage";

describe("Modules", () => {
  it("shows the detected platform and the available modules", async () => {
    renderPage(Modules);
    expect(await screen.findByText("Add-on modules")).toBeInTheDocument();
    expect(screen.getByText("sneakers-core-bundle")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("says it isn't available when the box's modules backend isn't there", async () => {
    vi.spyOn(modules, "list").mockRejectedValueOnce(
      new OsadminError("unimplemented", "ModulesService isn't on this box"),
    );
    renderPage(Modules);
    expect(
      await screen.findByText("Add-on modules: not available in this release"),
    ).toBeInTheDocument();
  });

  it("adds a module from an uploaded .bin", async () => {
    const user = userEvent.setup();
    renderPage(Modules);
    await screen.findByText("Add-on modules");
    const input = screen.getByLabelText("Module .bin file");
    await user.upload(input, new File(["bin"], "module.bin"));
    await user.click(screen.getByRole("button", { name: "Add from .bin" }));
    expect(await screen.findByText("uploaded-module")).toBeInTheDocument();
  });
});
