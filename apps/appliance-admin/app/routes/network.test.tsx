import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Network from "@/routes/network";
import { renderPage } from "@/test/renderPage";

describe("Network", () => {
  it("shows the management address and settings", async () => {
    renderPage(Network);
    expect(await screen.findByText("Network")).toBeInTheDocument();
    expect(screen.getByText("192.0.2.50")).toBeInTheDocument();
    expect(screen.getByDisplayValue("appliance.example.org")).toBeInTheDocument();
  });

  it("applies a change and offers Confirm", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.clear(screen.getByLabelText("Hostname"));
    await user.type(screen.getByLabelText("Hostname"), "box.example.org");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByText(/pending/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm" }));
  });

  it("runs the network checks", async () => {
    const user = userEvent.setup();
    renderPage(Network);
    await screen.findByText("Network");
    await user.click(screen.getByRole("button", { name: "Run checks" }));
    expect(await screen.findByText("link")).toBeInTheDocument();
  });
});
