import { mockSettings } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
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
    expect(
      screen.getByText(/from 0 \(every time\)\s+to 4 hours, 30 minutes by default/),
    ).toBeInTheDocument();
    expect(screen.getByText("30 minutes")).toBeInTheDocument();
    expect(screen.queryByText("MFA_MAX_AGE", { selector: "span" })).not.toBeInTheDocument();
    await user.click(api);
    await vi.waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Allow API access to sensitive secrets" }),
      ).toBeChecked(),
    );
  });

  it("turns the top-level folder restriction on and off, starting off", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/settings");
    const name = "Restrict top-level folders to admins";
    const restrict = await screen.findByRole("switch", { name });
    expect(restrict).not.toBeChecked();
    expect(screen.getByText(/create a top-level folder/)).toBeInTheDocument();
    await user.click(restrict);
    await vi.waitFor(() => expect(screen.getByRole("switch", { name })).toBeChecked());
    expect(mockSettings.security.restrictTopLevelFolders).toBe(true);
    await user.click(screen.getByRole("switch", { name }));
    await vi.waitFor(() => expect(screen.getByRole("switch", { name })).not.toBeChecked());
    expect(mockSettings.security.restrictTopLevelFolders).toBe(false);
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
