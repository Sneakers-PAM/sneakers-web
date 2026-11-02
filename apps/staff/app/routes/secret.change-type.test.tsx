import { mockState } from "@sneakers-pam/mock-server/in-process";
import { withMockGateway } from "@sneakers-pam/mock-server/in-process/testing";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "react-router";

import * as changeType from "@/routes/secret.change-type";
import * as editor from "@/routes/secret.edit";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const SecretStub = () => <p>Secret page {useParams().id}</p>;

const routes = [
  {
    action: changeType.action,
    Component: changeType.default,
    loader: changeType.loader,
    path: "/secret/:id/change-type",
  },
  {
    action: editor.action,
    Component: editor.default,
    loader: editor.loader,
    path: "/secret/:id/edit",
  },
  { Component: SecretStub, path: "/secret/:id" },
];

const NOTE = "mock-secret-alice-wifi";
const ROUTER = "mock-secret-edge-router";
const DB = "mock-secret-db-admin";
const stored = (id: string) => mockState.world.secrets.find((s) => s.id === id);

type User = ReturnType<typeof userEvent.setup>;

const pickType = async (user: User, type: string) => {
  await user.click(await screen.findByRole("combobox", { name: /New type/ }));
  await user.click(
    await screen.findByRole("option", {
      name: new RegExp(`^${type.replaceAll(/[()]/g, String.raw`\$&`)}`),
    }),
  );
};

const check = () => screen.getByRole("region", { name: "Check" });
const next = () => screen.getByRole("button", { name: "Next: review" });

describe("changing a secret's type on its own page", () => {
  it("turns a Secure Note into a GitHub App, the note proposed as the private key", async () => {
    const user = userEvent.setup();
    const note = stored(NOTE)?.fields.note;
    renderRoute(`/secret/${NOTE}/change-type`, routes);
    await pickType(user, "GitHub App");

    // Step 1: the note lines up with Private Key (PEM), the one sensitive, required choice.
    const card = await screen.findByRole("button", {
      name: /^Private Key \(PEM\), lined up against Note\./,
    });
    expect(card).toBeInTheDocument();
    expect(screen.getAllByTestId("stored-field").map((element) => element.textContent)).toEqual([
      "Notesensitive",
    ]);
    expect(within(check()).getByText("Note moves to Private Key (PEM).")).toBeInTheDocument();
    expect(within(check()).getByText("Nothing goes to Notes.")).toBeInTheDocument();
    // The private key is filled by the note, so it isn't asked for as an empty input.
    expect(screen.queryByRole("textbox", { name: /Private Key/ })).not.toBeInTheDocument();
    expect(within(check()).getByText("App ID is required. Fill it in above.")).toBeInTheDocument();
    expect(next()).toBeDisabled();
    // Names only: the stored value is nowhere on the page.
    expect(document.body).not.toHaveTextContent(note ?? "?");

    await user.type(screen.getByRole("textbox", { name: /App ID/ }), "5530191");
    await user.type(screen.getByRole("textbox", { name: /Owner Org/ }), "example-org");
    await waitFor(() => expect(next()).toBeEnabled());
    await user.click(next());

    // Step 2: what moves where, with a reveal for the sensitive note.
    const review = screen.getByRole("region", { name: "Review what moves" });
    expect(review).toHaveTextContent("Note moves to Private Key (PEM)");
    expect(review).toHaveTextContent("New field App ID: 5530191");
    expect(review).toHaveTextContent("Nothing goes to Notes.");
    expect(within(review).getByRole("button", { name: "Change Note" })).toBeInTheDocument();
    expect(within(review).getByRole("button", { name: "Reveal Note" })).toBeInTheDocument();
    expect(stored(NOTE)?.typeId).toBe("type-secure-note");

    const confirm = screen.getByRole("button", { name: "Change type" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);

    expect(await screen.findByText(`Secret page ${NOTE}`)).toBeInTheDocument();
    expect(stored(NOTE)?.typeId).toBe("type-github-app");
    expect(stored(NOTE)?.fields).toEqual({
      appId: "5530191",
      ownerOrg: "example-org",
      privateKey: note,
    });
  });

  it("reveals a sensitive value on the review through the audited reveal path", async () => {
    const user = userEvent.setup();
    const note = stored(NOTE)?.fields.note ?? "";
    renderRoute(`/secret/${NOTE}/change-type?to=type-github-app`, routes);
    await user.type(await screen.findByRole("textbox", { name: /App ID/ }), "1");
    await user.type(screen.getByRole("textbox", { name: /Owner Org/ }), "o");
    await waitFor(() => expect(next()).toBeEnabled());
    await user.click(next());
    await user.click(screen.getByRole("button", { name: "Reveal Note" }));
    expect(await screen.findByText(note)).toBeInTheDocument();
    expect(screen.getByText("Revealed · logged")).toBeInTheDocument();
  });

  it("refuses a sensitive value next to a non-sensitive field, and the arrow keys fix it", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${NOTE}/change-type?to=type-github-app`, routes);
    const card = await screen.findByRole("button", {
      name: /^Private Key \(PEM\), lined up against Note\./,
    });
    card.focus();
    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(check()).toHaveTextContent(
        /Note is sensitive and can't go into .+\. Move a sensitive field next to it\./,
      ),
    );
    expect(next()).toBeDisabled();
    // Focus stays on the card that moved, so ArrowUp puts it straight back.
    expect(
      screen.getByRole("button", { name: /^Private Key \(PEM\), not lined up\./ }),
    ).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(within(check()).getByText("Note moves to Private Key (PEM).")).toBeInTheDocument();
  });

  it("sends values with no field to Notes, and says so, before it changes anything", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${DB}/change-type`, routes);
    await pickType(user, "API Token");

    await screen.findByRole("region", { name: "Check" });
    expect(await within(check()).findByText("Password moves to Token.")).toBeInTheDocument();
    expect(within(check()).getByText("Username goes to Notes.")).toBeInTheDocument();
    expect(check()).toHaveTextContent(/fields go to Notes/);
    await waitFor(() => expect(next()).toBeEnabled());
    await user.click(next());

    const review = screen.getByRole("region", { name: "Review what moves" });
    expect(review).toHaveTextContent("Username goes to Notes");
    // A non-sensitive value is a Show away, not a reveal.
    await user.click(within(review).getByRole("button", { name: "Show Username" }));
    expect(within(review).getByText("postgres_admin")).toBeInTheDocument();

    const confirm = screen.getByRole("button", { name: "Change type" });
    await waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    await waitFor(() => expect(stored(DB)?.typeId).toBe("type-api-token"));
    expect(stored(DB)?.fields.token).toBe("mock-Tongue-Eyelet-91");
    expect(stored(DB)?.fields.notes).toContain("[moved from username]");
  });

  it("marks fields that keep their name unchanged, with no Change button", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${ROUTER}/change-type`, routes);
    await pickType(user, "Password Account (SSH)");
    await user.type(await screen.findByRole("textbox", { name: /Host/ }), "router.example.org");
    await waitFor(() => expect(next()).toBeEnabled());
    await user.click(next());
    const review = screen.getByRole("region", { name: "Review what moves" });
    expect(within(review).getByRole("listitem", { name: "Username" })).toHaveTextContent(
      "unchanged",
    );
    expect(within(review).queryByRole("button", { name: "Change Username" })).toBeNull();
    expect(within(review).getByRole("button", { name: "Change Host" })).toBeInTheDocument();
    expect(review).toHaveTextContent("New field Host: router.example.org");

    // Change goes back to step 1 with what was typed kept.
    await user.click(within(review).getByRole("button", { name: "Change Host" }));
    expect(screen.getByRole("textbox", { name: /Host/ })).toHaveValue("router.example.org");
  });

  it("opens from the edit form and goes back there when it's cancelled", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${DB}/edit`, routes);
    await user.click(await screen.findByRole("button", { name: "Change type…" }));
    await pickType(user, "API Token");
    await screen.findByRole("region", { name: "Check" });
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Change type…" })).toBeInTheDocument();
    expect(stored(DB)?.typeId).toBe("type-database-account");
  });

  it("names the refusal when the person can't change it", async () => {
    const user = userEvent.setup();
    renderRoute(`/secret/${DB}/change-type`, routes, { user: "mock-user-bob" });
    await pickType(user, "API Token");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You don't have permission to do that.",
    );
    expect(next()).toBeDisabled();
  });
});
