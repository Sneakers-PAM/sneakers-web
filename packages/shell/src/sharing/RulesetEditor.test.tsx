import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { RulesetDraft, RulesetEditorProps } from "#shell/sharing/types";

import { RulesetEditor } from "#shell/sharing/RulesetEditor";

const VALUE: RulesetDraft = {
  owners: ["mock-user-alice"],
  rules: [
    { grants: { C: "deny" }, subject: { id: "mock-user-dave", kind: "user", name: "Dave" } },
    {
      grants: { C: "allow", I: "allow", R: "allow" },
      subject: { id: "mock-group-db", kind: "group", name: "DB team" },
    },
  ],
};

const PROPS: RulesetEditorProps = {
  inherited: [
    {
      fromFolderId: "mock-folder-platform",
      fromFolderName: "Platform",
      grants: { C: "allow", I: "allow" },
      subject: { id: "mock-group-platform", kind: "group", name: "Platform engineers" },
    },
    {
      fromFolderId: "mock-folder-platform",
      fromFolderName: "Platform",
      grants: { I: "allow" },
      subject: { kind: "everyone", name: "Everyone" },
    },
  ],
  inheritedOwners: [
    {
      fromFolderId: "mock-folder-platform",
      fromFolderName: "Platform",
      name: "Carol",
      userId: "mock-user-carol",
    },
  ],
  labels: { "mock-user-alice": "Alice", "mock-user-dave": "Dave" },
  onChange: () => {},
  scope: "folder",
  subjectOptions: [
    { id: "mock-group-db", kind: "group", name: "DB team" },
    { id: "mock-group-finance", kind: "group", name: "Finance" },
    { id: "mock-user-bob", kind: "user", name: "Bob" },
  ],
  value: VALUE,
};

const setup = (props: Partial<RulesetEditorProps> = {}) => {
  const onChange = vi.fn();
  render(<RulesetEditor {...PROPS} onChange={onChange} {...props} />);
  return { onChange, user: userEvent.setup() };
};

const last = (onChange: ReturnType<typeof vi.fn>): RulesetDraft =>
  onChange.mock.calls.at(-1)?.[0] as RulesetDraft;

const advanced = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("radio", { name: "Advanced (RACI grid)" }));

describe("RulesetEditor, simple view", () => {
  it("ticks what each subject is allowed, and shows a deny as set in Advanced", () => {
    setup();
    expect(screen.getByRole("checkbox", { name: "DB team: Reveal" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "DB team: Manage" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).not.toBeChecked();
    const dave = screen.getByRole("row", { name: /Dave/ });
    expect(within(dave).getByText("Denied in Advanced")).toBeInTheDocument();
    expect(within(dave).queryByRole("checkbox", { name: "Dave: Reveal" })).toBeNull();
  });

  it("hands back the whole draft when a tick changes", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "DB team: Approve" }));
    expect(last(onChange).rules[1]?.grants).toEqual({
      A: "allow",
      C: "allow",
      I: "allow",
      R: "allow",
    });
    expect(last(onChange).owners).toEqual(["mock-user-alice"]);
    await user.click(screen.getByRole("checkbox", { name: "DB team: Approve" }));
    expect(last(onChange).rules[1]?.grants).toEqual({ C: "allow", I: "allow", R: "allow" });
  });

  it("lists inherited rules read-only, by the folder they come from", () => {
    setup();
    const inherited = screen.getByRole("region", { name: "Inherited from Platform" });
    expect(within(inherited).getByText("Platform engineers")).toBeInTheDocument();
    expect(within(inherited).getByText("Reveal, Informed")).toBeInTheDocument();
    expect(within(inherited).queryByRole("checkbox")).toBeNull();
  });

  it("adds a person or group from the picker, allowed to reveal, never one already listed", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "Add person or group" }));
    expect(screen.queryByRole("option", { name: /DB team/ })).toBeNull();
    await user.click(await screen.findByRole("option", { name: /Finance/ }));
    expect(last(onChange).rules[2]).toEqual({
      grants: { C: "allow" },
      subject: { id: "mock-group-finance", kind: "group", name: "Finance" },
    });
  });

  it("asks the app for more people as the user types", async () => {
    const searchSubjects = vi.fn(async (q: string) =>
      q === "er" ? [{ id: "mock-user-erin", kind: "user" as const, name: "Erin" }] : [],
    );
    const { onChange, user } = setup({ searchSubjects });
    await user.click(screen.getByRole("button", { name: "Add person or group" }));
    await user.type(screen.getByPlaceholderText("Search people and groups"), "er");
    await user.click(await screen.findByRole("option", { name: /Erin/ }));
    expect(searchSubjects).toHaveBeenCalledWith("er");
    expect(last(onChange).rules[2]?.subject).toEqual({
      id: "mock-user-erin",
      kind: "user",
      name: "Erin",
    });
  });

  it("removes a subject", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "Remove Dave" }));
    expect(last(onChange).rules.map((r) => r.subject.name)).toEqual(["DB team"]);
  });
});

describe("RulesetEditor, advanced view", () => {
  it("numbers this folder's rules first, then the inherited ones, locked", async () => {
    const { user } = setup();
    await advanced(user);
    expect(screen.getByRole("button", { name: "Rule 1, Dave, Reveal: deny" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Rule 2, DB team, Manage: allow" })).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Rule 3, Platform engineers, Reveal: allow, inherited, locked",
      }),
    ).toBeDisabled();
    expect(screen.getAllByText("Inherited from Platform").length).toBeGreaterThan(0);
  });

  it("cycles a cell blank, allow, deny and back to blank", async () => {
    const { onChange, user } = setup();
    await advanced(user);
    await user.click(screen.getByRole("button", { name: "Rule 2, DB team, Approve: blank" }));
    expect(last(onChange).rules[1]?.grants.A).toBe("allow");
    await user.click(screen.getByRole("button", { name: "Rule 2, DB team, Approve: allow" }));
    expect(last(onChange).rules[1]?.grants.A).toBe("deny");
    await user.click(screen.getByRole("button", { name: "Rule 2, DB team, Approve: deny" }));
    expect(last(onChange).rules[1]?.grants.A).toBeUndefined();
  });

  it("reorders and deletes rules", async () => {
    const { onChange, user } = setup();
    await advanced(user);
    expect(screen.getByRole("button", { name: "Move rule 1 up" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move rule 1 down" }));
    expect(last(onChange).rules.map((r) => r.subject.name)).toEqual(["DB team", "Dave"]);
    await user.click(screen.getByRole("button", { name: "Delete rule 1" }));
    expect(last(onChange).rules.map((r) => r.subject.name)).toEqual(["Dave"]);
  });

  it("adds a new rule blank, at the bottom of this folder's list", async () => {
    const { onChange, user } = setup();
    await advanced(user);
    await user.click(screen.getByRole("button", { name: "Add rule" }));
    await user.click(await screen.findByRole("option", { name: /Bob/ }));
    expect(last(onChange).rules[2]).toEqual({
      grants: {},
      subject: { id: "mock-user-bob", kind: "user", name: "Bob" },
    });
  });

  it("keeps the draft when switching views", async () => {
    const { user } = setup();
    await advanced(user);
    await user.click(screen.getByRole("button", { name: "Rule 2, DB team, Approve: blank" }));
    await user.click(screen.getByRole("radio", { name: "Simple" }));
    expect(screen.getByRole("checkbox", { name: "DB team: Approve" })).toBeChecked();
  });
});

describe("RulesetEditor, owners", () => {
  it("lists owners, and inherited owners locked to the folder they come from", () => {
    setup();
    const owners = screen.getByRole("region", { name: "Owners" });
    expect(within(owners).getByText("Alice")).toBeInTheDocument();
    expect(within(owners).getByText("Carol")).toBeInTheDocument();
    expect(within(owners).getByText("from Platform · locked")).toBeInTheDocument();
    expect(within(owners).queryByRole("button", { name: "Remove owner Alice" })).toBeNull();
  });

  it("adds a person as an owner, and removes one while another is left", async () => {
    const { onChange, user } = setup();
    await user.click(screen.getByRole("button", { name: "Add owner" }));
    expect(screen.queryByRole("option", { name: /DB team/ })).toBeNull();
    await user.click(await screen.findByRole("option", { name: /Bob/ }));
    expect(last(onChange).owners).toEqual(["mock-user-alice", "mock-user-bob"]);
    await user.click(screen.getByRole("button", { name: "Remove owner Alice" }));
    expect(last(onChange).owners).toEqual(["mock-user-bob"]);
  });

  it("has no owners for a secret, whose ownership lives on its folder", () => {
    setup({ inheritedOwners: [], scope: "secret", value: { rules: VALUE.rules } });
    expect(screen.queryByRole("region", { name: "Owners" })).toBeNull();
  });
});

describe("RulesetEditor, everyone rules", () => {
  const everyone: RulesetDraft = {
    owners: ["mock-user-alice"],
    rules: [{ grants: { I: "allow" }, subject: { kind: "everyone", name: "Everyone" } }],
  };

  it("keeps everyone rules read-only unless the app says the user may change them", async () => {
    const { user } = setup({ value: everyone });
    expect(screen.getByRole("checkbox", { name: "Everyone: Informed" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Remove Everyone" })).toBeNull();
    expect(
      screen.getByText("Only a site admin can change rules for everyone."),
    ).toBeInTheDocument();
    await advanced(user);
    expect(
      screen.getByRole("button", { name: "Rule 1, Everyone, Informed: allow" }),
    ).toBeDisabled();
  });

  it("lets a site admin change them, and offers Everyone in the picker", async () => {
    const { onChange, user } = setup({ canEditEveryone: true, value: everyone });
    await user.click(screen.getByRole("checkbox", { name: "Everyone: Informed" }));
    expect(last(onChange).rules[0]?.grants).toEqual({});
    await user.click(screen.getByRole("button", { name: "Remove Everyone" }));
    await user.click(screen.getByRole("button", { name: "Add person or group" }));
    await user.click(await screen.findByRole("option", { name: /Everyone/ }));
    expect(last(onChange).rules).toEqual([
      { grants: { C: "allow" }, subject: { kind: "everyone", name: "Everyone" } },
    ]);
  });

  it("never offers Everyone to someone who can't change it", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Add person or group" }));
    await screen.findByRole("option", { name: /Finance/ });
    expect(screen.queryByRole("option", { name: /Everyone/ })).toBeNull();
  });
});

describe("RulesetEditor, read-only", () => {
  it("shows everything with the reason, and nothing can be changed", async () => {
    const { user } = setup({ readOnlyReason: "Only owners manage sharing." });
    expect(screen.getByText("Only owners manage sharing.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "DB team: Reveal" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add person or group" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add owner" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Dave" })).toBeNull();
    await advanced(user);
    expect(screen.getByRole("button", { name: "Rule 1, Dave, Reveal: deny" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Delete rule 1" })).toBeNull();
  });
});
