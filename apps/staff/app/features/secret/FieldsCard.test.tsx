import { render, screen } from "@testing-library/react";

import type { SecretType } from "@/features/secret/secret.server";

import { FieldsCard } from "@/features/secret/FieldsCard";

const databaseType = {
  checkout: null,
  fields: [
    {
      key: "engine",
      kind: "select",
      label: "Engine",
      options: ["PostgreSQL", "MySQL"],
      rotates: null,
      sensitive: null,
      superSensitive: null,
    },
    {
      key: "server",
      kind: "text",
      label: "Server",
      options: null,
      rotates: null,
      sensitive: null,
      superSensitive: null,
    },
  ],
  heartbeat: null,
  id: "type-database-account",
  name: "Database Account",
  origin: "system",
  rotation: null,
  vendor: null,
} as SecretType;

const card = (engine: string) => (
  <FieldsCard
    fields={{ engine, server: "db.example.org" }}
    plainHidden={false}
    rotatesOnCheckIn={false}
    type={databaseType}
  />
);

describe("FieldsCard", () => {
  it("shows a stored choice that isn't one of the options, flagged with the allowed values", () => {
    render(card("postgres"));
    expect(screen.getByText("postgres")).toBeInTheDocument();
    expect(
      screen.getByText("Not one of the allowed values: PostgreSQL, MySQL."),
    ).toBeInTheDocument();
  });

  it("doesn't flag a choice that is one of the options", () => {
    render(card("MySQL"));
    expect(screen.getByText("MySQL")).toBeInTheDocument();
    expect(screen.queryByText(/Not one of the allowed values/)).toBeNull();
  });
});
