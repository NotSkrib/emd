import { describe, expect, it } from "vitest";
import { compareDotted, isStableMcVersion, isYearVersion, newestStable, sortNewestFirst } from "../../src/versions/compare.js";

describe("compareDotted", () => {
  it("compares numerically instead of lexically", () => {
    expect(compareDotted("1.21.10", "1.21.9")).toBeGreaterThan(0);
  });

  it("treats a longer version as newer when the shared prefix matches", () => {
    expect(compareDotted("26.3.1", "26.3")).toBeGreaterThan(0);
  });

  it("returns 0 for identical versions", () => {
    expect(compareDotted("26.3", "26.3")).toBe(0);
  });

  it("sorts year versions after 1.x versions", () => {
    expect(compareDotted("26.1", "1.21.11")).toBeGreaterThan(0);
  });

  it("reads build numbers inside longer strings", () => {
    expect(compareDotted("26.3.build.162-beta", "26.3.build.9-beta")).toBeGreaterThan(0);
  });

  it("ranks a release above its own pre-releases", () => {
    expect(compareDotted("1.19.0", "1.19.0-rc.1")).toBeGreaterThan(0);
    expect(compareDotted("26.3.0.58", "26.3.0.58-beta")).toBeGreaterThan(0);
  });

  it("does not let digits in a suffix outrank a newer base version", () => {
    expect(compareDotted("26.1.0.19-beta", "26.1.0.0-alpha.15")).toBeGreaterThan(0);
  });

  it("orders two pre-releases of the same version by their suffix numbers", () => {
    expect(compareDotted("1.19.0-rc.2", "1.19.0-rc.1")).toBeGreaterThan(0);
  });
});

describe("sortNewestFirst", () => {
  it("orders newest first without mutating the input", () => {
    const input = ["1.21.9", "1.21.11", "26.1", "1.21"];
    expect(sortNewestFirst(input)).toEqual(["26.1", "1.21.11", "1.21.9", "1.21"]);
    expect(input).toEqual(["1.21.9", "1.21.11", "26.1", "1.21"]);
  });
});

describe("newestStable", () => {
  it("returns the newest plain major.minor.patch version", () => {
    expect(newestStable(["1.17.21", "1.18.3", "1.18.2", "1.19.0-rc.1", "1.19-SNAPSHOT"])).toBe("1.18.3");
  });

  it("ignores versions with any suffix or a different shape", () => {
    expect(newestStable(["1.19-dev", "2.0", "3.0.0-beta"])).toBeUndefined();
  });
});

describe("isYearVersion", () => {
  it.each(["26.1", "26.3", "26.1.2"])("accepts %s", (version) => {
    expect(isYearVersion(version)).toBe(true);
  });

  it.each(["1.21", "1.21.11", "1.8.9"])("rejects %s", (version) => {
    expect(isYearVersion(version)).toBe(false);
  });
});

describe("isStableMcVersion", () => {
  it.each(["26.3", "26.1.2", "1.21", "1.21.11"])("accepts %s", (version) => {
    expect(isStableMcVersion(version)).toBe(true);
  });

  it.each(["26.3-rc-3", "26.4-snapshot-3", "1.21.11-pre3", "24w14a", "26.3-pre-2", "26.3\n"])("rejects %s", (version) => {
    expect(isStableMcVersion(version)).toBe(false);
  });
});
