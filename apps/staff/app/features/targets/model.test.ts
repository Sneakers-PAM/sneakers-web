import { connectionsProblem } from "@/features/targets/model";

const CHOICES = [
  { label: "SSH", protocol: "ssh", value: "conn-ssh" },
  { label: "LDAPS", protocol: "ldap", value: "conn-ldaps" },
  { label: "PostgreSQL", protocol: "postgres", value: "conn-pg" },
];

describe("connectionsProblem", () => {
  it("wants at least one connection", () => {
    expect(connectionsProblem([], CHOICES)).toBe("Add at least one connection.");
  });

  it("refuses two connections on the same protocol", () => {
    expect(
      connectionsProblem(
        [
          { connectionId: "conn-ssh", isDefault: true },
          { connectionId: "conn-ssh", isDefault: false },
        ],
        CHOICES,
      ),
    ).toBe("Each connection needs a different protocol.");
  });

  it("wants exactly one default, not zero", () => {
    expect(
      connectionsProblem(
        [
          { connectionId: "conn-ssh", isDefault: false },
          { connectionId: "conn-ldaps", isDefault: false },
        ],
        CHOICES,
      ),
    ).toBe("Pick exactly one connection as the default.");
  });

  it("wants exactly one default, not two", () => {
    expect(
      connectionsProblem(
        [
          { connectionId: "conn-ssh", isDefault: true },
          { connectionId: "conn-ldaps", isDefault: true },
        ],
        CHOICES,
      ),
    ).toBe("Pick exactly one connection as the default.");
  });

  it("is fine with one or more connections, different protocols, one default", () => {
    expect(
      connectionsProblem([{ connectionId: "conn-ssh", isDefault: true }], CHOICES),
    ).toBeUndefined();
    expect(
      connectionsProblem(
        [
          { connectionId: "conn-ssh", isDefault: true },
          { connectionId: "conn-ldaps", isDefault: false },
        ],
        CHOICES,
      ),
    ).toBeUndefined();
  });
});
