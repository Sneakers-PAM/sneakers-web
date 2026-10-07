import { runAction } from "@/lib/osadmin/action";
import { OsadminError } from "@/lib/osadmin/errors";
import { cancelStepUp, stepUpPending } from "@/lib/osadmin/stepUpController";

describe("runAction", () => {
  afterEach(() => cancelStepUp());

  it("calls onSuccess when the action resolves", async () => {
    const onSuccess = vi.fn();
    await runAction(() => Promise.resolve("ok"), { onSuccess });
    expect(onSuccess).toHaveBeenCalledWith("ok");
  });

  it("queues the action behind the step-up dialog on ACCESS_STEPUP_REQUIRED", async () => {
    let attempts = 0;
    const action = () => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(
          new OsadminError("permission_denied", "ACCESS_STEPUP_REQUIRED", "ACCESS_STEPUP_REQUIRED"),
        );
      }
      return Promise.resolve("done");
    };
    const onSuccess = vi.fn();
    await runAction(action, { onSuccess });
    expect(stepUpPending()).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("leaves a plain error to the toast, not the step-up dialog", async () => {
    await runAction(() => Promise.reject(new Error("boom")));
    expect(stepUpPending()).toBe(false);
  });
});
