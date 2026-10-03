import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as policies from "@/routes/policies";
import * as policy from "@/routes/policies.$id";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: policies, path: "/policies" },
  { module: policy, path: "/policies/new" },
  { module: policy, path: "/policies/:id" },
];

describe("password policies", () => {
  it("lists the policies and lets only an unused, non-default one be deleted", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/policies");
    expect(await screen.findByText("Default")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Strong" })).toHaveAttribute("aria-disabled");
    await user.click(screen.getByRole("button", { name: "Delete Legacy app" }));
    expect(await screen.findByText("Deleted Legacy app.")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: "Delete Legacy app" })).not.toBeInTheDocument(),
    );
  });

  it("shows the security settings with their defaults and saves a switch", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/policies");
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
    renderAdmin(ROUTES, "/policies");
    const timeout = await screen.findByLabelText("Session timeout (minutes)");
    await user.clear(timeout);
    await user.type(timeout, "75");
    expect(screen.getByText("Max is 60.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save limits" })).toBeDisabled();
  });

  it("pauses the example on impossible rules and saves a valid policy", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/policies/mock-policy-strong");
    const max = await screen.findByLabelText(/Max length/);
    await user.clear(max);
    await user.type(max, "12");
    expect(screen.getByText("Paused: these rules are impossible")).toBeInTheDocument();
    expect(screen.getAllByText("Must be at least the min (14).")[0]).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save policy" })).toBeDisabled();
    await user.clear(max);
    await user.type(max, "40");
    expect(screen.getByLabelText("Example password").textContent).toMatch(/^.{14,40}$/);
    await user.click(screen.getByRole("button", { name: "Save policy" }));
    expect(await screen.findByRole("heading", { name: "Password policies" })).toBeInTheDocument();
    expect(screen.getByText("14–40")).toBeInTheDocument();
  });

  it("creates a policy", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/policies/new");
    await user.type(await screen.findByLabelText(/Name/), "Wi-Fi");
    await user.click(screen.getByRole("button", { name: "Save policy" }));
    expect(await screen.findByText("Wi-Fi")).toBeInTheDocument();
  });
});
