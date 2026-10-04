import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as folders from "@/routes/folders";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [
  { module: folders, path: "/folders" },
  { module: folders, path: "/folders/:id" },
];

// Carol is root and owns the platform folders, so every change here is hers to make.
const CAROL = "mock-user-carol";

describe("folders", () => {
  it("shows the shared tree, without anyone's personal folders", async () => {
    renderAdmin(ROUTES, "/folders", CAROL);
    const tree = await screen.findByRole("navigation", { name: "Shared folders" });
    expect(within(tree).getByRole("link", { name: /Platform/ })).toBeInTheDocument();
    expect(within(tree).getByRole("link", { name: /Databases/ })).toBeInTheDocument();
    expect(within(tree).queryByRole("link", { name: /My secrets/ })).not.toBeInTheDocument();
    await userEvent.setup().click(within(tree).getByRole("button", { name: "Collapse Platform" }));
    expect(within(tree).queryByRole("link", { name: /Databases/ })).not.toBeInTheDocument();
  });

  it("shows a folder's path, counts and owners", async () => {
    renderAdmin(ROUTES, "/folders/mock-folder-platform", CAROL);
    expect(await screen.findByRole("heading", { name: "Platform" })).toBeInTheDocument();
    const facts = screen.getAllByRole("definition").map((d) => d.textContent);
    expect(facts).toEqual(["8", "3", "Alice, Carol"]);
  });

  it("explains what inherit means for a folder", async () => {
    renderAdmin(ROUTES, "/folders/mock-folder-databases", CAROL);
    expect(
      await screen.findByText(/Inherits from the security settings: .* not required/),
    ).toBeInTheDocument();
  });

  it("sets a folder's reveal step-up", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/folders/mock-folder-platform", CAROL);
    const require = await screen.findByRole("radio", { name: "Require" });
    await user.click(require);
    await vi.waitFor(() => expect(require).toHaveAttribute("data-state", "on"));
    expect(screen.getByText(/A fresh second factor is required/)).toBeInTheDocument();
  });

  it("makes a subfolder, renames it and deletes it", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/folders/mock-folder-network", CAROL);
    await user.click(await screen.findByRole("button", { name: "New subfolder" }));
    await user.type(screen.getByLabelText("Name"), "Firewalls");
    await user.click(screen.getByRole("button", { name: "Create folder" }));
    expect(await screen.findByRole("heading", { name: "Firewalls" })).toBeInTheDocument();
    expect(screen.getByText("Platform / Network / Firewalls")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rename" }));
    await user.clear(screen.getByLabelText("Folder name"));
    await user.type(screen.getByLabelText("Folder name"), "Edge firewalls");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("heading", { name: "Edge firewalls" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete…" }));
    expect(screen.getByText("It's empty.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete folder" }));
    expect(await screen.findByRole("heading", { name: "Network" })).toBeInTheDocument();
  });

  it("asks where a folder's secrets go before deleting it", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/folders/mock-folder-certificates", CAROL);
    await user.click(await screen.findByRole("button", { name: "Delete…" }));
    expect(screen.getByText(/Pick a folder to move them to first/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete folder" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Move its contents to" }));
    await user.click(await screen.findByRole("option", { name: "Network" }));
    await user.click(screen.getByRole("button", { name: "Delete folder" }));
    expect(await screen.findByRole("heading", { name: "Platform" })).toBeInTheDocument();
  });

  it("creates a top-level shared folder", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/folders", CAROL);
    await user.click(await screen.findByRole("button", { name: "New shared folder" }));
    await user.type(screen.getByLabelText(/Name/), "Security");
    await user.click(screen.getByRole("button", { name: "Create folder" }));
    expect(await screen.findByRole("heading", { name: "Security" })).toBeInTheDocument();
  });

  it("shows a folder's own rules and what it inherits, and saves a change", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/folders/mock-folder-databases", CAROL);
    const sharing = await screen.findByRole("heading", { name: "Sharing" });
    expect(sharing).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DB team: Reveal" })).toBeChecked();
    expect(screen.getByRole("region", { name: "Inherited from Platform" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save sharing" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "DB team: Approve" }));
    await user.click(screen.getByRole("button", { name: "Save sharing" }));
    expect(await screen.findByText("Saved · sharing.")).toBeInTheDocument();
    await vi.waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).toBeChecked(),
    );
    expect(await screen.findByRole("button", { name: "Save sharing" })).toBeDisabled();
  });

  it("puts the saved rules back on Discard", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/folders/mock-folder-databases", CAROL);
    await user.click(await screen.findByRole("checkbox", { name: "DB team: Approve" }));
    expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).not.toBeChecked();
  });

  it("refuses the page to someone who isn't a site admin", async () => {
    // The console is for site admins; Bob isn't one.
    renderAdmin(ROUTES, "/folders/mock-folder-databases", "mock-user-bob");
    expect(await screen.findByText("Only a site admin can do that.")).toBeInTheDocument();
  });
});
