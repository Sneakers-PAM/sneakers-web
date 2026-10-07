import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Certificates from "@/routes/certificates";
import { renderPage } from "@/test/renderPage";

describe("Certificates", () => {
  it("shows the product certificate and the self-signed badge", async () => {
    renderPage(Certificates);
    expect(await screen.findByText("Certificates")).toBeInTheDocument();
    expect(screen.getByText(/Subject: appliance\.example\.org/)).toBeInTheDocument();
    expect(screen.getByText("Self-signed")).toBeInTheDocument();
  });

  it("opens the Advanced disclosure to create a CSR", async () => {
    const user = userEvent.setup();
    renderPage(Certificates);
    await screen.findByText("Certificates");
    await user.click(screen.getByText("Advanced: trust and PKI"));
    await user.click(screen.getByRole("button", { name: "Create a CSR" }));
    expect(await screen.findByDisplayValue(/BEGIN CERTIFICATE REQUEST/)).toBeInTheDocument();
  });
});
