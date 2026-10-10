import { movedBy, movedTo, moveNote } from "@/features/browse/reorder";

const IDS = ["a", "b", "c", "d"];

describe("movedBy", () => {
  it("swaps a secret with its neighbour", () => {
    expect(movedBy(IDS, "b", "up")).toEqual(["b", "a", "c", "d"]);
    expect(movedBy(IDS, "b", "down")).toEqual(["a", "c", "b", "d"]);
  });

  it("is null at an end or for an id that isn't in the order", () => {
    expect(movedBy(IDS, "a", "up")).toBeNull();
    expect(movedBy(IDS, "d", "down")).toBeNull();
    expect(movedBy(IDS, "x", "up")).toBeNull();
  });

  it("leaves the order it was given alone", () => {
    const ids = [...IDS];
    movedBy(ids, "b", "up");
    expect(ids).toEqual(IDS);
  });
});

describe("movedTo", () => {
  it("drops a secret dragged down in the place of the row it lands on", () => {
    expect(movedTo(IDS, "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(movedTo(IDS, "a", "d")).toEqual(["b", "c", "d", "a"]);
  });

  it("drops a secret dragged up in the place of the row it lands on", () => {
    expect(movedTo(IDS, "d", "b")).toEqual(["a", "d", "b", "c"]);
    expect(movedTo(IDS, "c", "a")).toEqual(["c", "a", "b", "d"]);
  });

  it("is null when nothing moves, or for an id that isn't in the order", () => {
    expect(movedTo(IDS, "b", "b")).toBeNull();
    expect(movedTo(IDS, "x", "b")).toBeNull();
    expect(movedTo(IDS, "b", "x")).toBeNull();
  });
});

describe("moveNote", () => {
  it("says where the secret is now, for the live region", () => {
    expect(moveNote("Alpha", ["b", "a", "c"], "a")).toBe("Alpha moved to position 2 of 3.");
  });
});
