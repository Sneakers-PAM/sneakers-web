import { OsadminError } from "@/lib/osadmin/errors";
import { edge, MOCK_INVITE_CODE, MOCK_SETUP_CODE } from "@/mock/edge.mock";
import { signInAs } from "@/test/session";

// What the box draws every code from; no 0, 1, G, I, L, O, Q or U.
const CODE = /^[23456789ABCDEFHJKMNPRSTVWXYZ]{4}(-[23456789ABCDEFHJKMNPRSTVWXYZ]{4})+$/;

describe("the mock's codes", () => {
  it("writes its sample codes in the box's code alphabet", () => {
    expect(MOCK_SETUP_CODE).toMatch(CODE);
    expect(MOCK_INVITE_CODE).toMatch(CODE);
  });

  it("answers a root-shell challenge with a code in the alphabet", async () => {
    signInAs("alice");
    const { code } = await edge.request<{ code: string }>(
      "RootShellService",
      "IssueRootShellCode",
      { challenge: "K3M9-7PXR-2HDW-R4TE", totpCode: "314159" },
    );
    expect(code).toMatch(CODE);
  });

  it("refuses a root-shell challenge with a character outside the alphabet", async () => {
    signInAs("alice");
    await expect(
      edge.request("RootShellService", "IssueRootShellCode", {
        challenge: "K3M9-7PQX-2HDW-R4TE",
        totpCode: "314159",
      }),
    ).rejects.toBeInstanceOf(OsadminError);
  });

  it("makes invitation codes in the alphabet", async () => {
    signInAs("alice");
    for (let round = 0; round < 40; round++) {
      const { invitation } = await edge.request<{ invitation: { code: string } }>(
        "AccessService",
        "ReinviteAdmin",
        { name: "bob" },
      );
      expect(invitation.code).toMatch(CODE);
    }
  });
});
