import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { upgrade } from "@/lib/osadmin/client";
import { applyMockScenario } from "@/mock/edge.mock";
import Updates from "@/routes/updates";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const openPage = async () => {
  renderPage(Updates);
  await screen.findByRole("heading", { name: "Updates" });
};

/** Types the version and a code into the open dialog and confirms with label. */
const confirmWith = async (
  user: ReturnType<typeof userEvent.setup>,
  word: string,
  label: string,
) => {
  const dialog = within(await screen.findByRole("dialog"));
  await user.type(dialog.getByLabelText(`Type ${word} to confirm`), word);
  await user.type(dialog.getByLabelText("Authenticator code"), "123456");
  await user.click(dialog.getByRole("button", { name: label }));
};

describe("Updates: the three update units", () => {
  beforeEach(() => signInAs("alice"));

  it("fetches, verifies, applies and reverts the Base Web with no reboot", async () => {
    const user = userEvent.setup();
    await openPage();
    const web = within(screen.getByRole("region", { name: "Base Web" }));
    expect(web.getByText(/\(built-in pages\)/)).toBeInTheDocument();
    expect(web.getByText(/Previous: none/)).toBeInTheDocument();
    const offers = within(await web.findByRole("radiogroup", { name: "Base Web versions" }));
    expect(offers.getByRole("radio", { name: /0\.1\.2/ })).toBeChecked();
    expect(offers.getByText(/base 0.1.0 to before 0.2.0/)).toBeInTheDocument();
    await user.click(web.getByRole("button", { name: "Fetch pages 0.1.2" }));
    await user.click(await web.findByRole("button", { name: "Verify and stage" }));
    const result = await web.findByRole("region", { name: "Verify result" });
    expect(await within(result).findByText("Verified")).toBeInTheDocument();
    expect(within(result).getByText("admin pages 0.1.2")).toBeInTheDocument();
    expect(within(result).getByText("Staged into web slot a")).toBeInTheDocument();
    await user.click(await web.findByRole("button", { name: "Apply pages 0.1.2" }));
    expect(within(await screen.findByRole("dialog")).getByText(/no reboot/)).toBeInTheDocument();
    await confirmWith(user, "0.1.2", "Switch the admin pages");
    expect(await web.findByText(/\(web slot a\)/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Restarting" })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("region", { name: "Base OS" })).getByText(/in the active slot/),
    ).toHaveTextContent("Running 0.1.0 in the active slot");
    await user.click(web.getByRole("button", { name: "Revert pages to built-in" }));
    await confirmWith(user, "0.1.0", "Switch back");
    expect(await web.findByText(/\(built-in pages\)/)).toBeInTheDocument();
    const after = await upgrade.get();
    expect(after.baseWeb?.canRevert).toBe(false);
    expect(after.history?.[0]).toMatchObject({
      action: "revert",
      target: "UPDATE_TARGET_BASE_WEB",
    });
  });

  it("refuses a Base Web for another Base OS with the fix in words, and keeps the file", async () => {
    applyMockScenario("web-compat");
    const user = userEvent.setup();
    await openPage();
    const install = within(screen.getByRole("region", { name: "Install an update" }));
    await user.click(await install.findByRole("button", { name: "Verify and stage" }));
    const result = await install.findByRole("region", { name: "Verify result" });
    await vi.waitFor(() => expect(result).toHaveAttribute("data-tone", "danger"));
    expect(within(result).getByText("UPGRADE_COMPAT")).toBeInTheDocument();
    expect(
      within(result).getByText(
        /needs Base OS 0.2.0 to before 0.3.0\. This box runs Base OS 0\.1\.0\. Install Base OS 0\.2\.x first/,
      ),
    ).toBeInTheDocument();
    expect(
      await within(result).findByText("The file is still on the appliance."),
    ).toBeInTheDocument();
    expect(within(result).getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("says why the built-in pages serve when the installed Base Web doesn't load", async () => {
    applyMockScenario("web-failed");
    await openPage();
    const web = within(screen.getByRole("region", { name: "Base Web" }));
    expect(web.getByText("Serving the built-in pages")).toBeInTheDocument();
    expect(web.getByText(/UPGRADE_WEB_LOAD/)).toBeInTheDocument();
  });

  it("names the Base Web that waits for a newer Base OS", async () => {
    await openPage();
    expect(
      await within(screen.getByRole("region", { name: "Base Web" })).findByText(
        /Base Web 0.2.1 needs Base OS 0.2.0 to before 0.3.0\. Install that Base OS first/,
      ),
    ).toBeInTheDocument();
  });

  it("names the Base Web each Base OS ships with, offered and staged", async () => {
    await openPage();
    const base = within(screen.getByRole("region", { name: "Base OS" }));
    const offers = within(await base.findByRole("radiogroup", { name: "Base OS versions" }));
    expect(offers.getAllByText("Includes Base Web 0.2.0")).toHaveLength(2);
  });

  it("names the Base Web a staged Base OS ships with", async () => {
    applyMockScenario("staged");
    await openPage();
    expect(
      await within(screen.getByRole("region", { name: "Base OS" })).findByText(
        /Includes Base Web 0\.2\.0, which serves after the reboot/,
      ),
    ).toBeInTheDocument();
  });

  it("says before a Base OS apply which pages serve after the reboot", async () => {
    applyMockScenario("staged");
    applyMockScenario("web-installed");
    await openPage();
    const notes = within(screen.getByRole("region", { name: "Base OS" }))
      .getAllByRole("status")
      .filter((status) =>
        /After the reboot the box serves the built-in pages of 0.2.0/.test(status.textContent),
      );
    expect(notes).toHaveLength(1);
  });

  it("shows a fetch under way on its card: state, bytes, percentage, speed and time left", async () => {
    applyMockScenario("fetching");
    await openPage();
    const progress = within(
      within(screen.getByRole("region", { name: "Base OS" })).getByRole("region", {
        name: "Fetch progress",
      }),
    );
    expect(progress.getByText(/^Downloading: sneakers-appliance-baseOS-0.2.0/)).toBeInTheDocument();
    expect(progress.getByText("45 MB of 72 MB (62%), 12 MB/s, 2 s left")).toBeInTheDocument();
    expect(progress.getByRole("progressbar")).toHaveAttribute("value", "62");
  });

  it("reads the index again on every Check now", async () => {
    const user = userEvent.setup();
    const check = vi.spyOn(upgrade, "checkUpdates");
    await openPage();
    await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(1));
    const mirror = within(screen.getByRole("region", { name: "Update mirror" }));
    expect(
      await mirror.findByText(
        /Last check .*: Base OS 0\.2\.0; Base Web 0\.1\.2; product 0\.2\.0, 0\.1\.1/,
      ),
    ).toBeInTheDocument();
    await user.click(mirror.getByRole("button", { name: "Check now" }));
    await vi.waitFor(() => expect(check).toHaveBeenCalledTimes(2));
  });

  it("names the built-in list as the source", async () => {
    applyMockScenario("source-builtin");
    await openPage();
    const mirror = within(screen.getByRole("region", { name: "Update mirror" }));
    expect(mirror.getByText(/Source: the built-in list/)).toBeInTheDocument();
    expect(mirror.getByRole("radio", { name: "Built-in list" })).toBeChecked();
    expect(await mirror.findByText(/from the release source/)).toBeInTheDocument();
  });

  it("leaves the mirror out of Install an update: it uploads only", async () => {
    await openPage();
    const install = within(screen.getByRole("region", { name: "Install an update" }));
    expect(install.getByLabelText("Update .bin file")).toBeInTheDocument();
    expect(install.queryByRole("button", { name: /^Fetch/ })).not.toBeInTheDocument();
    expect(install.queryByLabelText("File name on the mirror")).not.toBeInTheDocument();
  });
});
