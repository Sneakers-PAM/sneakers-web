import { mfaWindow } from "@/lib/mfaWindow";

describe("mfaWindow", () => {
  it("names a window of 0 as every time", () => {
    expect(mfaWindow(0)).toBe("Every time");
  });

  it("names whole hours and minutes", () => {
    expect(mfaWindow(1800)).toBe("30 minutes");
    expect(mfaWindow(60)).toBe("1 minute");
    expect(mfaWindow(3600)).toBe("1 hour");
    expect(mfaWindow(5400)).toBe("1 hour 30 minutes");
    expect(mfaWindow(14_400)).toBe("4 hours");
  });

  it("keeps the seconds of a window that isn't whole minutes", () => {
    expect(mfaWindow(45)).toBe("45 seconds");
    expect(mfaWindow(90)).toBe("1 minute 30 seconds");
  });
});
