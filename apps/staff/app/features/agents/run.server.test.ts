// @vitest-environment node
import { mockState } from "@sneakers-web/mock-gateway";
import {
  appRequest,
  form,
  sessionCookie,
  withMockGateway,
} from "@sneakers-web/mock-gateway/testing";

import { loadRun, runAction } from "@/features/agents/run.server";

withMockGateway();

const RUN = "run_mock_build1";
const PATH = `/approvals/run/${RUN}`;
const world = () => mockState.world;
const secretUse = (id: string) => world().secretUses.find((u) => u.id === id)!;
const nowUnix = () => Math.floor(Date.now() / 1000);

const raiseReveal = (id = "mock-use-run-reveal") =>
  world().secretUses.push({
    ...secretUse("mock-use-1"),
    argv: [],
    expiresAtUnix: nowUnix() + 120,
    fieldKey: "token",
    id,
    reveal: true,
    secretId: "mock-secret-status-api",
    secretName: "Status page API",
    state: "pending",
  });

/** One of Alice's own uses that nobody else can decide: her always-approve lab secret. */
const raiseConfirm = (id = "mock-use-run-lab") => {
  world().secrets.find((x) => x.id === "mock-secret-alice-wifi")!.alwaysRequireApproval = true;
  world().secretUses.push({
    ...secretUse("mock-use-1"),
    argv: [],
    confirm: true,
    expiresAtUnix: nowUnix() + 120,
    fieldKey: "password",
    id,
    reveal: true,
    secretId: "mock-secret-alice-wifi",
    secretName: "Lab wifi",
    state: "pending",
  });
};

/** One signed-in session for a whole test, so a step-up carries to the next call. */
const session = (user = "mock-user-alice") => {
  const cookie = sessionCookie(user);
  return {
    get: () => appRequest(PATH, { cookie }),
    post: (fields: Record<string, string>) =>
      appRequest(PATH, { body: form(fields), cookie, method: "POST" }),
  };
};

describe("the run page's data", () => {
  it("lists the run's pending uses, soonest to expire first, with who asked and why", async () => {
    raiseReveal();
    const d = await loadRun(session().get(), RUN);
    expect(d.runId).toBe(RUN);
    expect(d.uses.map((u) => u.id)).toEqual(["mock-use-run-reveal", "mock-use-1"]);
    expect(d.uses[1]).toMatchObject({
      command: "psql -h db1.example.org -U postgres_admin",
      confirm: false,
      fieldKey: "password",
      purpose: secretUse("mock-use-1").purpose,
      requester: "build1 agent",
      reveal: false,
      secretName: "DB admin",
    });
    expect(d.uses[0]).toMatchObject({ command: "", reveal: true });
    expect(d.freshUntil).toBe(0);
    expect(d.user.name).toBe("Alice");
  });

  it("is empty for a run with nothing waiting", async () => {
    const d = await loadRun(session().get(), "run_mock_nothing");
    expect(d.uses).toEqual([]);
  });
});

describe("confirming or withdrawing the ticked uses", () => {
  it("steps up once with the code, then confirms every ticked use", async () => {
    raiseConfirm();
    raiseConfirm("mock-use-run-lab-2");
    const s = session();
    const r = await runAction(
      s.post({
        code: "123456",
        factor: "totp",
        ids: "mock-use-run-lab,mock-use-run-lab-2",
        intent: "confirm",
      }),
      RUN,
    );
    expect(r).toEqual({
      decision: "confirm",
      outcomes: [
        { decided: true, id: "mock-use-run-lab", reason: null },
        { decided: true, id: "mock-use-run-lab-2", reason: null },
      ],
      view: "decided",
    });
    expect(secretUse("mock-use-run-lab").state).toBe("approved");
    const after = await loadRun(s.get(), RUN);
    expect(after.freshUntil).toBeGreaterThan(Date.now());
  });

  it("never confirms a use an owner or approver decides", async () => {
    const r = await runAction(
      session().post({ code: "123456", factor: "totp", ids: "mock-use-1", intent: "confirm" }),
      RUN,
    );
    expect(r).toMatchObject({
      outcomes: [{ decided: false, id: "mock-use-1", reason: "OTHER_APPROVER" }],
      view: "decided",
    });
    expect(secretUse("mock-use-1").state).toBe("pending");
  });

  it("confirms a follow-up inside the window without a factor", async () => {
    raiseConfirm();
    const s = session();
    await runAction(
      s.post({ code: "123456", factor: "totp", ids: "mock-use-run-lab", intent: "confirm" }),
      RUN,
    );
    raiseConfirm("mock-use-run-lab-2");
    const r = await runAction(s.post({ ids: "mock-use-run-lab-2", intent: "confirm" }), RUN);
    expect(r).toMatchObject({ outcomes: [{ decided: true }], view: "decided" });
  });

  it("asks for the factor when the window is closed, confirming nothing", async () => {
    raiseConfirm();
    const r = await runAction(session().post({ ids: "mock-use-run-lab", intent: "confirm" }), RUN);
    expect(r).toEqual({ problem: "step-up", view: "prompt" });
    expect(secretUse("mock-use-run-lab").state).toBe("pending");
  });

  it("says a wrong code was wrong, confirming nothing", async () => {
    raiseConfirm();
    const r = await runAction(
      session().post({
        code: "000000",
        factor: "totp",
        ids: "mock-use-run-lab",
        intent: "confirm",
      }),
      RUN,
    );
    expect(r).toEqual({ problem: "code", view: "prompt" });
    expect(secretUse("mock-use-run-lab").state).toBe("pending");
  });

  it("denies without a factor", async () => {
    const r = await runAction(session().post({ ids: "mock-use-1", intent: "deny" }), RUN);
    expect(r).toEqual({
      decision: "deny",
      outcomes: [{ decided: true, id: "mock-use-1", reason: null }],
      view: "decided",
    });
    expect(secretUse("mock-use-1").state).toBe("denied");
  });

  it("hands back a refused item's reason without stopping the rest", async () => {
    raiseReveal();
    secretUse("mock-use-run-reveal").expiresAtUnix = nowUnix() - 1;
    const r = await runAction(
      session().post({ ids: "mock-use-run-reveal,mock-use-1", intent: "deny" }),
      RUN,
    );
    expect(r).toMatchObject({
      outcomes: [
        { decided: false, id: "mock-use-run-reveal", reason: "EXPIRED" },
        { decided: true, id: "mock-use-1" },
      ],
    });
  });

  it("refuses an empty batch as a problem, not a crash", async () => {
    const r = await runAction(session().post({ ids: "", intent: "deny" }), RUN);
    expect(r).toEqual({ problem: "batch", view: "prompt" });
  });

  it("emails a code through the step-up", async () => {
    const r = await runAction(session().post({ intent: "factor-email" }), RUN);
    expect(r).toEqual({ emailState: "sent", view: "prompt" });
  });
});
