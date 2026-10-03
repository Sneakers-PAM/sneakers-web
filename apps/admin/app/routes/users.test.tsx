import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as users from "@/routes/users";
import * as userDetail from "@/routes/users.$id";
import * as verify from "@/routes/users.$id.verify";
import * as newUser from "@/routes/users.new";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: users, path: "/users" },
  { module: newUser, path: "/users/new" },
  { module: userDetail, path: "/users/:id" },
  { module: verify, path: "/users/:id/verify" },
];

describe("users", () => {
  it("lists every user with their roles, verification and the root badge", async () => {
    renderAdmin(ROUTES, "/users");
    const carol = await screen.findByRole("row", { name: /Carol/ });
    expect(within(carol).getByText("Root")).toBeInTheDocument();
    expect(within(carol).getByText("Site admin")).toBeInTheDocument();
    const dave = screen.getByRole("row", { name: /Dave/ });
    expect(within(dave).getByText("Unverified")).toBeInTheDocument();
    expect(within(dave).getByText("Member")).toBeInTheDocument();
  });

  it("filters by name, username or email", async () => {
    renderAdmin(ROUTES, "/users?q=car");
    expect(await screen.findByRole("link", { name: "Carol" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Alice" })).not.toBeInTheDocument();
    expect(screen.getByText("Showing 1 of 5.")).toBeInTheDocument();
  });

  it("creates a user and goes on to verify their email", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/users/new");
    await user.type(await screen.findByLabelText(/Display name/), "Frank");
    await user.type(screen.getByLabelText(/Username/), "frank");
    await user.type(screen.getByLabelText(/Email/), "frank@example.org");
    expect(screen.getByLabelText("Generated password").textContent).toHaveLength(16);
    await user.click(screen.getByRole("button", { name: "Create user" }));
    expect(await screen.findByRole("heading", { name: "Verify email" })).toBeInTheDocument();
    expect(screen.getByText(/Frank's account is ready/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("6-digit code"), "000000");
    expect(await screen.findByText(/That code is wrong/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText("6-digit code"));
    await user.type(screen.getByLabelText("6-digit code"), "481027");
    expect(await screen.findByRole("heading", { name: "Email verified" })).toBeInTheDocument();
  });

  it("says why a duplicate account was refused", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/users/new");
    await user.type(await screen.findByLabelText(/Display name/), "Another Bob");
    await user.type(screen.getByLabelText(/Username/), "bob");
    await user.type(screen.getByLabelText(/Email/), "bob2@example.org");
    await user.click(screen.getByRole("button", { name: "Create user" }));
    expect(
      await screen.findByText("A user with that username or email already exists"),
    ).toBeInTheDocument();
  });
});

describe("user detail", () => {
  it("grants and removes the recovery role", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/users/mock-user-bob");
    const recovery = await screen.findByRole("switch", { name: "Recovery" });
    expect(recovery).not.toBeChecked();
    await user.click(recovery);
    expect(
      screen.getByRole("alertdialog", { name: "Give Bob the recovery role?" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Grant" }));
    await vi.waitFor(() => expect(screen.getByRole("switch", { name: "Recovery" })).toBeChecked());
    await user.click(screen.getByRole("switch", { name: "Recovery" }));
    await user.click(await screen.findByRole("button", { name: "Remove" }));
    await vi.waitFor(() =>
      expect(screen.getByRole("switch", { name: "Recovery" })).not.toBeChecked(),
    );
  });

  it("asks before a role change and changes nothing on Cancel", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/users/mock-user-bob");
    await user.click(await screen.findByRole("switch", { name: "Site admin" }));
    expect(screen.getByRole("alertdialog", { name: "Make Bob a site admin?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("switch", { name: "Site admin" })).not.toBeChecked();
  });

  it("locks the root admin's admin and disable switches", async () => {
    renderAdmin(ROUTES, "/users/mock-user-carol");
    expect(await screen.findByText(/This is the root admin/)).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Site admin" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Site admin" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Disable user" })).toBeDisabled();
  });

  it("won't let you disable yourself", async () => {
    renderAdmin(ROUTES, "/users/mock-user-alice");
    expect(await screen.findByText("You can't disable your own account.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Disable user" })).toBeDisabled();
  });

  it("saves the identity, changes groups and revokes a personal token", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/users/mock-user-alice");
    const name = await screen.findByLabelText("Display name");
    await user.clear(name);
    await user.type(name, "Alice Example");
    await user.click(screen.getByRole("button", { name: "Save identity" }));
    expect(await screen.findByRole("heading", { name: "Alice Example" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add to DB team" }));
    expect(await screen.findByRole("button", { name: "Remove from DB team" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove from Platform engineers" }));
    expect(
      await screen.findByRole("button", { name: "Add to Platform engineers" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revoke build1 agent" }));
    expect(await screen.findByText("Revoked")).toBeInTheDocument();
  });

  it("removes an authenticator after a confirmation", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/users/mock-user-carol");
    await user.click(await screen.findByRole("button", { name: "Remove…" }));
    await user.click(screen.getByRole("button", { name: "Remove authenticator" }));
    expect(await screen.findByText("Not set up.")).toBeInTheDocument();
  });

  it("shows unverified email with a way to enter the code", async () => {
    renderAdmin(ROUTES, "/users/mock-user-dave");
    expect(await screen.findByText("Email not verified yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Enter code…" })).toHaveAttribute(
      "href",
      "/users/mock-user-dave/verify",
    );
  });

  it("says the user doesn't exist", async () => {
    renderAdmin(ROUTES, "/users/mock-user-nobody");
    expect(await screen.findByText("Not found")).toBeInTheDocument();
  });
});

describe("someone who isn't a site admin", () => {
  it("gets the gateway's reason instead of the list", async () => {
    renderAdmin(ROUTES, "/users", "mock-user-bob");
    expect(await screen.findByText("You can't open this")).toBeInTheDocument();
    expect(screen.getByText("Only a site admin can do that.")).toBeInTheDocument();
  });
});
