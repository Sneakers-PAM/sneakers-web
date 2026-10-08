import type { Admin } from "@/lib/osadmin/types";

import { removeBlocked } from "@/features/access/removeBlocked";

const admin = (name: string, role: Admin["role"]): Admin => ({
  createdBy: "console",
  keys: [],
  name,
  role,
  uid: 20_000,
});

describe("removeBlocked", () => {
  const alice = admin("alice", "ROLE_OWNER");
  const bob = admin("bob", "ROLE_ADMIN");
  const dana = admin("dana", "ROLE_OWNER");

  it("lets an owner remove another admin", () => {
    expect(removeBlocked(bob, [alice, bob], "alice")).toBeUndefined();
  });

  it("lets an owner remove another owner while one remains", () => {
    expect(removeBlocked(dana, [alice, dana], "alice")).toBeUndefined();
  });

  it("never lets you remove yourself, and says another owner can", () => {
    expect(removeBlocked(alice, [alice, dana], "alice")).toBe(
      "You can't remove your own account. Another owner can.",
    );
  });

  it("says at least one owner must remain when you're the only one", () => {
    expect(removeBlocked(alice, [alice, bob], "alice")).toBe(
      "You can't remove your own account, and at least one owner must remain.",
    );
  });

  it("refuses to remove the last owner", () => {
    expect(removeBlocked(dana, [bob, dana], "bob")).toBe("At least one owner must remain.");
  });
});
