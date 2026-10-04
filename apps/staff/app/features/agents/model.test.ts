import { agentRefusalMessage } from "@/features/agents/messages";
import { folderPath, grantState, programText, tokenState, usesText } from "@/features/agents/model";

const NOW = 1_000_000;

describe("agent access rules", () => {
  it("gives a token its state: revoked beats expired, and no expiry means active", () => {
    expect(tokenState({ expiresAtUnix: 0, revokedAtUnix: 0 }, NOW)).toBe("active");
    expect(tokenState({ expiresAtUnix: NOW, revokedAtUnix: 0 }, NOW)).toBe("expired");
    expect(tokenState({ expiresAtUnix: NOW - 1, revokedAtUnix: 5 }, NOW)).toBe("revoked");
  });

  it("gives a grant its state, used up once it hits its limit", () => {
    const g = { expiresAtUnix: NOW + 60, maxUses: 5, revokedAtUnix: 0, uses: 4 };
    expect(grantState(g, NOW)).toBe("active");
    expect(grantState({ ...g, uses: 5 }, NOW)).toBe("used");
    expect(grantState({ ...g, maxUses: 0, uses: 99 }, NOW)).toBe("active");
    expect(grantState({ ...g, expiresAtUnix: NOW }, NOW)).toBe("expired");
    expect(grantState({ ...g, revokedAtUnix: 1 }, NOW)).toBe("revoked");
  });

  it("writes uses, programs and folder paths the way the tables show them", () => {
    expect(usesText(3, 20)).toBe("3 / 20");
    expect(usesText(3, 0)).toBe("3 / no limit");
    expect(programText({ argPattern: "-h db1.example.org *", program: "psql" })).toBe(
      "psql -h db1.example.org *",
    );
    const folders = new Map([
      ["a", { name: "Platform", parentId: null }],
      ["b", { name: "Databases", parentId: "a" }],
    ]);
    expect(folderPath("b", folders)).toBe("Platform / Databases");
    expect(folderPath("x", folders)).toBe("");
  });

  it("uses the gateway's own text for its uncoded factor and token checks", () => {
    expect(agentRefusalMessage({ detail: "second factor was not accepted", metadata: {} })).toBe(
      "Second factor was not accepted.",
    );
    expect(
      agentRefusalMessage({ code: "NOT_FOUND", detail: "use grant not found", metadata: {} }),
    ).toBe("That item no longer exists. It may have been deleted.");
  });
});
