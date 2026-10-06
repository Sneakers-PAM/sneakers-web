import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as settings from "@/routes/settings";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [{ module: settings, path: "/settings" }];

describe("admin settings", () => {
  it("shows the security settings with their defaults and saves a switch", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/settings");
    const checkout = await screen.findByRole("switch", {
      name: /Require MFA for sensitive checkout/,
    });
    expect(checkout).toBeChecked();
    const api = screen.getByRole("switch", { name: "Allow API access to sensitive secrets" });
    expect(api).not.toBeChecked();
    expect(screen.getByRole("switch", { name: "Require MFA before a reveal" })).not.toBeChecked();
    expect(screen.getByText(/1 minute\s+to 1 hour, 5 minutes by default/)).toBeInTheDocument();
    await user.click(api);
    await vi.waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Allow API access to sensitive secrets" }),
      ).toBeChecked(),
    );
  });

  it("refuses a session timeout outside 15 to 60 minutes", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/settings");
    const timeout = await screen.findByLabelText("Session timeout (minutes)");
    await user.clear(timeout);
    await user.type(timeout, "75");
    expect(screen.getByText("Max is 60.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save limits" })).toBeDisabled();
  });
});
