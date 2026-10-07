import { screen } from "@testing-library/react";

import Status from "@/routes/status";
import { renderPage } from "@/test/renderPage";

describe("Status", () => {
  it("shows the version, protection and a TLS warning", async () => {
    renderPage(Status);
    expect(await screen.findByText("Status")).toBeInTheDocument();
    expect(await screen.findByText(/Running/)).toBeInTheDocument();
    expect(screen.getByText("Full")).toBeInTheDocument();
    expect(screen.getByText(/self-signed/)).toBeInTheDocument();
  });
});
