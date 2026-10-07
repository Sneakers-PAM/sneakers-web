import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import type { BrowseSecret, BrowseSecretType } from "@/features/browse/types";

import { SecretsTable } from "@/features/browse/SecretsTable";

const TYPES: Record<string, BrowseSecretType> = {
  "type-cert": { fields: [], id: "type-cert", name: "Certificate" },
  "type-db": { fields: [], id: "type-db", name: "Database" },
  "type-ssh": { fields: [], id: "type-ssh", name: "SSH key" },
};

const secret = (id: string, name: string, typeId: string, position: number): BrowseSecret => ({
  canRead: true,
  folderId: "mock-folder",
  id,
  lastHeartbeatResult: null,
  name,
  position,
  retired: false,
  retiredAt: "",
  targetId: null,
  typeId,
});

const SECRETS: BrowseSecret[] = [
  secret("s-zeta", "Zeta", "type-cert", 1),
  secret("s-alpha", "Alpha", "type-db", 2),
  secret("s-mid", "Mid", "type-ssh", 3),
];

const renderTable = ({
  canManage = false,
  secrets = SECRETS,
}: { canManage?: boolean; secrets?: BrowseSecret[] } = {}) => {
  const submitted: FormData[] = [];
  const Stub = createRoutesStub([
    {
      action: async ({ request }: { request: Request }) => {
        submitted.push(await request.formData());
        return { done: "ok", intent: "reorder-secrets", ok: true as const };
      },
      Component: () => (
        <SecretsTable
          canManage={canManage}
          folderId="mock-folder"
          includeRetired={false}
          onMove={() => {}}
          onShowRetired={() => {}}
          secrets={secrets}
          types={TYPES}
        />
      ),
      id: "routes/test",
      index: true,
      path: "/",
    },
  ]);
  render(<Stub initialEntries={["/"]} />);
  return { submitted };
};

const typeCellsInOrder = () =>
  within(screen.getAllByRole("table")[0]!)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[3]!.textContent);

const headerButton = (name: RegExp) =>
  within(screen.getByRole("columnheader", { name })).getByRole("button");

describe("SecretsTable sorting", () => {
  it("sorts by name ascending by default", () => {
    renderTable();
    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("link")?.textContent ?? "");
    expect(names).toEqual(["Alpha", "Mid", "Zeta"]);
  });

  it("sorts by type name ascending when the Type header is clicked", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(headerButton(/^Type/));
    expect(typeCellsInOrder()).toEqual(["Certificate", "Database", "SSH key"]);
  });

  it("sorts by type name descending on a second click of the Type header", async () => {
    const user = userEvent.setup();
    renderTable();
    const typeButton = headerButton(/^Type/);
    await user.click(typeButton);
    await user.click(typeButton);
    expect(typeCellsInOrder()).toEqual(["SSH key", "Database", "Certificate"]);
  });

  it("goes back to ascending name order when the Name header is clicked after sorting by type", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(headerButton(/^Type/));
    await user.click(headerButton(/^Name/));
    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("link")?.textContent ?? "");
    expect(names).toEqual(["Alpha", "Mid", "Zeta"]);
  });
});

describe("the manual order index", () => {
  it("shows each secret's position alongside it, name-sorted by default", () => {
    renderTable();
    const indexCellsByName = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getAllByRole("cell")[1]!.textContent);
    // Default order is Alpha, Mid, Zeta; their positions are 2, 3, 1.
    expect(indexCellsByName).toEqual(["2", "3", "1"]);
  });

  it("sorts by position when the index header is clicked", async () => {
    const user = userEvent.setup();
    renderTable();
    await user.click(headerButton(/^Index/));
    const names = screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("link")?.textContent ?? "");
    expect(names).toEqual(["Zeta", "Alpha", "Mid"]);
  });

  it("hides the move controls from someone who can't manage the folder", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /^Move/ })).not.toBeInTheDocument();
  });

  it("moves a secret up, saves the new order, and switches to index sort", async () => {
    const user = userEvent.setup();
    const { submitted } = renderTable({ canManage: true });
    expect(screen.getByRole("button", { name: "Move Zeta up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Move Mid down" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Move Alpha up" }));
    expect(submitted).toHaveLength(1);
    expect(Object.fromEntries(submitted[0]!)).toEqual({
      folderId: "mock-folder",
      intent: "reorder-secrets",
      orderedIds: "s-alpha,s-zeta,s-mid",
    });
    const names = await screen
      .findAllByRole("row")
      .then((rows) => rows.slice(1).map((row) => within(row).getByRole("link")?.textContent ?? ""));
    // Index sort now reflects the order sent (position values haven't changed in this fixture).
    expect(names).toEqual(["Zeta", "Alpha", "Mid"]);
  });
});
