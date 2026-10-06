import {
  installIssueCopyCapture,
  issueCopyErrors,
  lastIssueCopyClick,
  noteIssueCopyClick,
  recordIssueCopyError,
  resetIssueCopyCapture,
} from "#shell/issueCopy/errorBuffer";

describe("the UI issue copy ring buffer", () => {
  afterEach(() => resetIssueCopyCapture());

  it("keeps at most 5 entries, newest first", () => {
    for (let index = 0; index < 7; index++) recordIssueCopyError("window", `error ${index}`);
    const errors = issueCopyErrors();
    expect(errors).toHaveLength(5);
    expect(errors.map((error) => error.m)).toEqual([
      "error 6",
      "error 5",
      "error 4",
      "error 3",
      "error 2",
    ]);
  });

  it("redacts the message the same as the logger, and caps it at 200 characters", () => {
    recordIssueCopyError("fetch", "failed with token=snk_abc123");
    expect(issueCopyErrors()[0]?.m).not.toMatch(/snk_abc123/);
    recordIssueCopyError("window", "x".repeat(500));
    expect(issueCopyErrors()[0]?.m.length).toBeLessThanOrEqual(200);
  });

  it("names the clicked element by its data-testid when it has one", () => {
    const wrapper = document.createElement("div");
    wrapper.dataset.testid = "secret-reveal";
    const button = document.createElement("button");
    wrapper.append(button);
    noteIssueCopyClick(button);
    expect(lastIssueCopyClick()).toBe("[data-testid=secret-reveal]");
  });

  it("falls back to a short CSS selector, never the element's text", () => {
    const button = document.createElement("button");
    button.id = "save";
    button.className = "primary secondary";
    button.textContent = "Save the secret sec_01H as plain text";
    noteIssueCopyClick(button);
    expect(lastIssueCopyClick()).toBe("button#save.primary");
    expect(lastIssueCopyClick()).not.toContain("Save the secret");
  });
});

describe("installIssueCopyCapture", () => {
  afterEach(() => {
    resetIssueCopyCapture();
    vi.unstubAllGlobals();
  });

  it("records a window error, an unhandled rejection and a fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const uninstall = installIssueCopyCapture();
    globalThis.dispatchEvent(new ErrorEvent("error", { message: "boom" }));
    globalThis.dispatchEvent(
      new PromiseRejectionEvent("unhandledrejection", {
        promise: Promise.reject(new Error("rejected")).catch(() => {}),
        reason: new Error("rejected"),
      }),
    );
    await globalThis.fetch("https://sneakers.example.org/api").catch(() => {});
    const sources = issueCopyErrors().map((error) => error.src);
    expect(sources).toContain("window");
    expect(sources).toContain("promise");
    expect(sources).toContain("fetch");
    uninstall();
  });

  it("restores the original fetch on uninstall", async () => {
    const original = globalThis.fetch;
    const uninstall = installIssueCopyCapture();
    expect(globalThis.fetch).not.toBe(original);
    uninstall();
    expect(globalThis.fetch).toBe(original);
  });
});
