import { LiveRegion } from "@sneakers-web/ui";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  applyOrder = false,
  canManage = false,
  secrets = SECRETS,
}: { applyOrder?: boolean; canManage?: boolean; secrets?: BrowseSecret[] } = {}) => {
  const submitted: FormData[] = [];
  let current = secrets;
  const Stub = createRoutesStub([
    {
      action: async ({ request }: { request: Request }) => {
        const form = await request.formData();
        submitted.push(form);
        if (applyOrder) {
          const ids = String(form.get("orderedIds")).split(",");
          current = ids.map((id, index) => ({
            ...current.find((s) => s.id === id)!,
            position: index + 1,
          }));
        }
        return { done: "ok", intent: "reorder-secrets", ok: true as const };
      },
      Component: () => (
        <SecretsTable
          canManage={canManage}
          folderId="mock-folder"
          includeRetired={false}
          onMove={() => {}}
          onShowRetired={() => {}}
          secrets={current}
          types={TYPES}
        />
      ),
      id: "routes/test",
      index: true,
      path: "/",
    },
  ]);
  render(
    <>
      <Stub initialEntries={["/"]} />
      <LiveRegion />
    </>,
  );
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

const rowOf = (name: string) =>
  screen.getAllByRole("row").find((row) => within(row).queryByRole("link", { name }))!;

describe("drag and drop reordering", () => {
  it("puts the reorder controls in their own column on the left", () => {
    renderTable({ canManage: true });
    const first = within(rowOf("Alpha")).getAllByRole("cell")[0]!;
    expect(within(first).getByRole("button", { name: "Move Alpha up" })).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: "Move Alpha down" })).toBeInTheDocument();
    expect(within(first).getByRole("button", { name: /^Reorder Alpha/ })).toBeInTheDocument();
    const index = within(rowOf("Alpha")).getAllByRole("cell")[2]!;
    expect(within(index).queryByRole("button")).not.toBeInTheDocument();
    expect(index.textContent).toBe("2");
  });

  it("has no reorder column for someone who can't manage the folder", () => {
    renderTable();
    expect(screen.queryByRole("button", { name: /^Reorder/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Reorder" })).not.toBeInTheDocument();
  });

  it("saves the order when a row is dragged onto another", async () => {
    const { submitted } = renderTable({ canManage: true });
    fireEvent.dragStart(screen.getByRole("button", { name: /^Reorder Mid/ }));
    fireEvent.dragOver(rowOf("Zeta"));
    fireEvent.drop(rowOf("Zeta"));
    await screen.findByText("Mid moved to position 1 of 3.");
    expect(submitted).toHaveLength(1);
    expect(Object.fromEntries(submitted[0]!)).toEqual({
      folderId: "mock-folder",
      intent: "reorder-secrets",
      orderedIds: "s-mid,s-zeta,s-alpha",
    });
  });

  it("does nothing when a row is dropped on itself", () => {
    const { submitted } = renderTable({ canManage: true });
    fireEvent.dragStart(screen.getByRole("button", { name: /^Reorder Mid/ }));
    fireEvent.drop(rowOf("Mid"));
    expect(submitted).toHaveLength(0);
  });

  it("moves with the arrow keys on the handle, announces it and keeps the focus there", async () => {
    const user = userEvent.setup();
    const { submitted } = renderTable({ canManage: true });
    const handle = screen.getByRole("button", { name: /^Reorder Alpha/ });
    handle.focus();
    await user.keyboard("{ArrowUp}");
    expect(Object.fromEntries(submitted[0]!)).toMatchObject({ orderedIds: "s-alpha,s-zeta,s-mid" });
    await screen.findByText("Alpha moved to position 1 of 3.");
    expect(screen.getByRole("button", { name: /^Reorder Alpha/ })).toHaveFocus();
  });

  it("keeps the focus in the row when an arrow button reaches the end", async () => {
    const user = userEvent.setup();
    renderTable({ applyOrder: true, canManage: true });
    await user.click(screen.getByRole("button", { name: "Move Alpha up" }));
    await screen.findByText("Alpha moved to position 1 of 3.");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Move Alpha up" })).toBeDisabled(),
    );
    expect(screen.getByRole("button", { name: /^Reorder Alpha/ })).toHaveFocus();
  });
});
