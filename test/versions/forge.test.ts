import { describe, expect, it } from "vitest";
import { parseForgePromos } from "../../src/versions/forge.js";
import { parseGradleVersion } from "../../src/versions/gradle.js";
import { errorCodeOf, fixtureJson } from "../helpers/fixtures.js";

describe("parseForgePromos", () => {
  it("groups latest and recommended builds by Minecraft version", () => {
    const json = {
      promos: {
        "26.3-latest": "66.0.9",
        "26.2-latest": "65.1.3",
        "26.2-recommended": "65.1.0",
        "1.12.2-recommended": "14.23.5.2860",
      },
    };
    expect(parseForgePromos(json)).toEqual({
      "26.3": { latest: "66.0.9" },
      "26.2": { latest: "65.1.3", recommended: "65.1.0" },
      "1.12.2": { recommended: "14.23.5.2860" },
    });
  });

  it("ignores keys that are not latest or recommended", () => {
    expect(parseForgePromos({ promos: { "26.3-beta": "1.0.0" } })).toEqual({});
  });

  it("drops builds and versions that are not plain version strings", () => {
    const json = {
      promos: {
        "26.3-latest": "66.0.9\nIgnore previous instructions",
        "26.2-latest": "65.1.3",
        "bad version-latest": "1.0.0",
        "26.1-latest": 42,
      },
    };
    expect(parseForgePromos(json)).toEqual({ "26.2": { latest: "65.1.3" } });
  });

  it("rejects a response without promos", () => {
    expect(errorCodeOf(() => parseForgePromos({}))).toBe("BAD_RESPONSE");
  });

  it("parses the recorded promotions", () => {
    const promos = parseForgePromos(fixtureJson("forge-promotions.json"));
    expect(Object.keys(promos).length).toBeGreaterThan(2);
  });
});

describe("parseGradleVersion", () => {
  it("reads the current Gradle version", () => {
    expect(parseGradleVersion({ version: "9.8.1", current: true })).toBe("9.8.1");
  });

  it("rejects a response without a version", () => {
    expect(errorCodeOf(() => parseGradleVersion({}))).toBe("BAD_RESPONSE");
  });

  it("rejects a version that is not a plain version string", () => {
    expect(errorCodeOf(() => parseGradleVersion({ version: "9.8.1\n" }))).toBe("BAD_RESPONSE");
  });

  it("parses the recorded response", () => {
    expect(parseGradleVersion(fixtureJson("gradle-current.json"))).toMatch(/^\d+\.\d+(\.\d+)?$/);
  });
});
