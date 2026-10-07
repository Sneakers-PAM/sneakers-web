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

const secret = (id: string, name: string, typeId: string): BrowseSecret => ({
  canRead: true,
  folderId: "mock-folder",
  id,
  lastHeartbeatResult: null,
  name,
  retired: false,
  retiredAt: "",
  targetId: null,
  typeId,
});

const SECRETS: BrowseSecret[] = [
  secret("s-zeta", "Zeta", "type-cert"),
  secret("s-alpha", "Alpha", "type-db"),
  secret("s-mid", "Mid", "type-ssh"),
];

const renderTable = () => {
  const Stub = createRoutesStub([
    {
      Component: () => (
        <SecretsTable
          canManage={false}
          folderId="mock-folder"
          includeRetired={false}
          onMove={() => {}}
          onShowRetired={() => {}}
          secrets={SECRETS}
          types={TYPES}
        />
      ),
      id: "routes/test",
      index: true,
      path: "/",
    },
  ]);
  return render(<Stub initialEntries={["/"]} />);
};

const typeCellsInOrder = () =>
  within(screen.getAllByRole("table")[0]!)
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[2]!.textContent);

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
