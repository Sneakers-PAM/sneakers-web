import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";

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
    secretId="secret-1"
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

  it("wraps a long unbroken multiline value, such as an SSH public key, inside its box", async () => {
    const key = `ssh-ed25519 ${"A".repeat(400)} admin@example.org\nsecond line`;
    const sshType = {
      ...databaseType,
      fields: [
        {
          key: "public_key",
          kind: "multiline",
          label: "Public key",
          options: null,
          rotates: null,
          sensitive: null,
          superSensitive: null,
        },
      ],
      id: "type-ssh-key",
      name: "SSH Key",
    } as SecretType;
    render(
      <FieldsCard
        fields={{ public_key: key }}
        plainHidden={false}
        rotatesOnCheckIn={false}
        secretId="secret-1"
        type={sshType}
      />,
    );
    const value = screen.getByText(
      (_, element) => element?.tagName === "P" && element.textContent === key,
    );
    expect(value).toHaveClass("whitespace-pre-wrap", "wrap-anywhere");
    const writeText = vi.fn().mockResolvedValue(null);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await userEvent.click(screen.getByRole("button", { name: "Copy Public key" }));
    expect(writeText).toHaveBeenCalledWith(key);
  });

  it("marks a required field the secret has no value for, with an Edit link to it, never a blank", () => {
    const passwordType = {
      ...databaseType,
      fields: [
        { key: "username", kind: "text", label: "Username", options: null, rotates: null },
        {
          key: "password",
          kind: "password",
          label: "Password",
          options: null,
          rotates: null,
          sensitive: true,
        },
      ],
    } as SecretType;
    render(
      <MemoryRouter>
        <FieldsCard
          fields={{ username: "root" }}
          missing={["password"]}
          plainHidden={false}
          rotatesOnCheckIn={false}
          secretId="secret-1"
          type={passwordType}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Missing required field")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Edit/ })).toHaveAttribute(
      "href",
      "/secret/secret-1/edit?focus=password",
    );
  });
});
