import type { SecretType } from "@/features/editors/validate";

import {
  assess,
  type Item,
  move,
  propose,
  storedFields,
  swap,
  visibleItems,
} from "@/features/editors/lineUp";

const field = (
  key: string,
  label: string,
  extra: Partial<SecretType["fields"][number]> = {},
): SecretType["fields"][number] => ({
  defaultValue: null,
  key,
  kind: "text",
  label,
  maxLength: 0,
  options: [],
  pattern: null,
  policyEnforcement: null,
  policyId: null,
  required: false,
  rotates: false,
  sensitive: false,
  superSensitive: false,
  ...extra,
});

const type = (id: string, fields: SecretType["fields"]): SecretType =>
  ({
    checkout: false,
    fields,
    heartbeat: false,
    id,
    name: id,
    origin: "system",
    rotation: false,
    vendor: null,
  }) as SecretType;

const notes = field("notes", "Notes", { kind: "multiline" });

const SECURE_NOTE = type("type-secure-note", [
  field("note", "Note", { kind: "multiline", required: true, sensitive: true }),
]);

const GITHUB_APP = type("type-github-app", [
  field("description", "Description", { kind: "multiline" }),
  field("appId", "App ID", { required: true }),
  field("clientId", "Client ID"),
  field("clientSecret", "Client Secret", { kind: "sensitive", sensitive: true }),
  field("installationId", "Installation ID"),
  field("privateKey", "Private Key (PEM)", { kind: "multiline", required: true, sensitive: true }),
  field("webhookSecret", "Webhook Secret", { kind: "sensitive", sensitive: true }),
  field("ownerOrg", "Owner Org", { required: true }),
  notes,
]);

const DATABASE = type("type-database-account", [
  field("server", "Server", { required: true }),
  field("port", "Port"),
  field("username", "Username", { required: true }),
  field("password", "Password", { kind: "password", required: true, sensitive: true }),
  notes,
]);

const API_TOKEN = type("type-api-token", [
  field("scheme", "Scheme", { kind: "select" }),
  field("token", "Token", { kind: "sensitive", required: true, sensitive: true }),
  field("endpoint", "Endpoint / API URL"),
  notes,
]);

const PASSWORD = type("type-password", [
  field("username", "Username", { required: true }),
  field("password", "Password", { kind: "password", required: true, sensitive: true }),
  notes,
]);

const NO_SENSITIVE = type("type-plain", [field("host", "Host"), notes]);

const keysOf = (order: ReturnType<typeof propose>, rows: number) =>
  order.slice(0, rows).map((index) => (index.kind === "field" ? index.key : null));

describe("the stored fields on the left", () => {
  it("lists stored keys in the current type's order, names only, with sensitivity", () => {
    const left = storedFields(["username", "password", "port", "server"], DATABASE);
    expect(left.map((f) => f.key)).toEqual(["server", "port", "username", "password"]);
    expect(left.find((f) => f.key === "password")?.sensitive).toBe(true);
    expect(left.find((f) => f.key === "username")?.sensitive).toBe(false);
  });

  it("treats a stored key the current type doesn't declare as sensitive", () => {
    const left = storedFields(["legacy"], PASSWORD);
    expect(left).toEqual([
      { key: "legacy", label: "legacy", sensitive: true, superSensitive: false },
    ]);
  });
});

describe("the proposed line-up", () => {
  it("proposes Private Key (PEM) for a secure note's note when it becomes a GitHub App", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, GITHUB_APP);
    expect(keysOf(order, 1)).toEqual(["privateKey"]);
    const a = assess(left, order, GITHUB_APP, {});
    expect(a.rows[0]).toMatchObject({ outcome: "moved", toKey: "privateKey" });
    expect(a.problems).toEqual([]);
    expect(a.mapping).toEqual([{ from: "note", to: "privateKey" }]);
    // The required field the note fills is never asked for as an empty input.
    expect(a.unfilled.map((f) => f.key)).not.toContain("privateKey");
    expect(a.unfilled.filter((f) => f.required).map((f) => f.key)).toEqual(["appId", "ownerOrg"]);
  });

  it("offers a sensitive value only sensitive fields", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, NO_SENSITIVE);
    expect(keysOf(order, 1)).toEqual([null]);
    const a = assess(left, order, NO_SENSITIVE, {});
    expect(a.rows[0]?.outcome).toBe("notes");
    expect(a.problems[0]).toMatch(/Note is sensitive/);
    expect(a.problems[0]).toMatch(/no sensitive field/);
    expect(a.problems[0]).toMatch(/Pick another type/);
  });

  it("keeps same-named fields and sends the rest to Notes", () => {
    const left = storedFields(["password", "port", "server", "username"], DATABASE);
    const order = propose(left, API_TOKEN);
    expect(keysOf(order, 4)).toEqual([null, null, null, "token"]);
    const a = assess(left, order, API_TOKEN, {});
    expect(a.problems).toEqual([]);
    expect(a.toNotes).toEqual(["server", "port", "username"]);
    expect(a.mapping).toEqual([{ from: "password", to: "token" }]);
  });

  it("carries a field that keeps its name, with no mapping", () => {
    const left = storedFields(["password", "username"], PASSWORD);
    const order = propose(left, DATABASE);
    const a = assess(left, order, DATABASE, {});
    expect(a.rows.map((r) => r.outcome)).toEqual(["same", "same"]);
    expect(a.mapping).toEqual([]);
    expect(a.unfilled.filter((f) => f.required).map((f) => f.key)).toEqual(["server"]);
  });
});

describe("the live check", () => {
  it("refuses a sensitive value next to a non-sensitive field, saying how to fix it", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, GITHUB_APP);
    // Line Description up against the note instead.
    const index = order.findIndex(
      (index_) => index_.kind === "field" && index_.key === "description",
    );
    const next = swap(order, 0, index);
    const a = assess(left, next, GITHUB_APP, {});
    expect(a.problems).toEqual([
      "Note is sensitive and can't go into Description. Move a sensitive field next to it.",
    ]);
  });

  it("flags a value whose own field is lined up against something else", () => {
    const left = storedFields(["password", "username"], PASSWORD);
    const order: Item[] = [
      { id: 0, kind: "notes" },
      { key: "username", kind: "field" },
      { key: "password", kind: "field" },
    ];
    const a = assess(left, order, DATABASE, {});
    expect(a.rows[0]).toMatchObject({ outcome: "own", toKey: "username" });
    expect(a.problems).toContain(
      "Username keeps its own field, Username, which is lined up against Password. Move another field next to Username.",
    );
  });

  it("asks for a required field nothing fills, until it's typed", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, GITHUB_APP);
    expect(assess(left, order, GITHUB_APP, {}).missing.map((f) => f.key)).toEqual([
      "appId",
      "ownerOrg",
    ]);
    const typed = assess(left, order, GITHUB_APP, { appId: "5530191", ownerOrg: "example" });
    expect(typed.missing).toEqual([]);
  });

  it("says when nothing goes to Notes", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    expect(assess(left, propose(left, GITHUB_APP), GITHUB_APP, {}).toNotes).toEqual([]);
  });
});

describe("moving fields to line them up", () => {
  it("draws every row's card, the fields not lined up and one spare Notes card", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, GITHUB_APP);
    const shown = visibleItems(order, 1);
    expect(shown.filter((v) => v.item.kind === "notes")).toHaveLength(1);
    expect(shown.filter((v) => v.item.kind === "field")).toHaveLength(GITHUB_APP.fields.length);
  });

  it("swaps a card with its neighbour, and stays put at either end", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, GITHUB_APP);
    const second = visibleItems(order, 1)[1]?.item;
    expect(move(order, 1, 0, 1)[0]).toEqual(second);
    expect(move(order, 1, 0, -1)).toBe(order);
    const last = visibleItems(order, 1).length - 1;
    expect(move(order, 1, last, 1)).toBe(order);
  });

  it("brings the spare Notes card up against a row, sending that row's field below", () => {
    const left = storedFields(["note"], SECURE_NOTE);
    const order = propose(left, GITHUB_APP);
    const spare = visibleItems(order, 1).find((v) => v.item.kind === "notes");
    const next = swap(order, 0, spare?.index ?? 0);
    expect(next[0]?.kind).toBe("notes");
    expect(assess(left, next, GITHUB_APP, {}).rows[0]?.outcome).toBe("notes");
  });
});
