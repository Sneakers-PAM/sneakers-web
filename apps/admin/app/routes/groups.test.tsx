import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as groups from "@/routes/groups";
import * as group from "@/routes/groups.$id";
import * as newGroup from "@/routes/groups.new";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: groups, path: "/groups" },
  { module: newGroup, path: "/groups/new" },
  { module: group, path: "/groups/:id" },
];

describe("groups", () => {
  it("lists the groups by name", async () => {
    renderAdmin(ROUTES, "/groups");
    const links = await screen.findAllByRole("link", {
      name: /DB team|Finance|Platform engineers/,
    });
    expect(links.map((l) => l.textContent)).toEqual(["DB team", "Finance", "Platform engineers"]);
  });

  it("creates a group and opens it", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/groups/new");
    await user.type(await screen.findByLabelText(/Name/), "Help desk");
    await user.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByRole("heading", { name: "Help desk" })).toBeInTheDocument();
    expect(screen.getByText("Group · 0 members")).toBeInTheDocument();
  });

  it("refuses a name that's already taken, ignoring case", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/groups/new");
    await user.type(await screen.findByLabelText(/Name/), "db TEAM");
    await user.click(screen.getByRole("button", { name: "Create group" }));
    expect(await screen.findByText("A group with that name already exists")).toBeInTheDocument();
  });

  it("finds people to add and removes members", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/groups/mock-group-db");
    expect(await screen.findByText("Group · 2 members")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Add member…"), "ca");
    await user.click(await screen.findByRole("button", { name: "Add Carol" }));
    expect(await screen.findByText("Group · 3 members")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Bob" }));
    expect(await screen.findByText("Group · 2 members")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bob" })).not.toBeInTheDocument();
  });
});
