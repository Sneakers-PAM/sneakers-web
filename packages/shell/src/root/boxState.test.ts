import { watchBoxState } from "#shell/root/boxState";

const answer = (status: number, state?: string) =>
  new Response("", { headers: state ? { "Sneakers-Box-State": state } : {}, status });

describe("watchBoxState", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("calls back once when a request is answered by the box-state page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(answer(200))
      .mockResolvedValueOnce(answer(503, "updating"))
      .mockResolvedValueOnce(answer(503, "updating"));
    vi.stubGlobal("fetch", fetchMock);
    const held = vi.fn();
    const stop = watchBoxState(held);
    const first = await fetch("/secret/s-1.data");
    expect(first.status).toBe(200);
    expect(held).not.toHaveBeenCalled();
    const second = await fetch("/secret/s-1.data");
    expect(second.status).toBe(503);
    await fetch("/home.data");
    expect(held).toHaveBeenCalledTimes(1);
    expect(held).toHaveBeenCalledWith("updating");
    stop();
    expect(globalThis.fetch).toBe(fetchMock);
  });

  it("ignores answers that don't carry a held state", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(answer(503)).mockResolvedValueOnce(answer(200, "running")),
    );
    const held = vi.fn();
    const stop = watchBoxState(held);
    await fetch("/x.data");
    await fetch("/_box/state");
    expect(held).not.toHaveBeenCalled();
    stop();
  });
});
