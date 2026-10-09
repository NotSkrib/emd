import { describe, expect, it } from "vitest";
import {
  listNeoForgeMcVersions,
  neoForgeChannel,
  neoForgeMcVersion,
  parseNeoForgeVersions,
  resolveNeoForge,
} from "../../src/versions/neoforge.js";
import { errorCodeOf, fixtureJson } from "../helpers/fixtures.js";

describe("neoForgeMcVersion", () => {
  it.each([
    ["26.3.0.58-beta", "26.3"],
    ["26.2.0.88", "26.2"],
    ["26.1.2.114", "26.1.2"],
    ["26.1.0.0-alpha.1", "26.1"],
    ["21.1.256", "1.21.1"],
    ["21.0.167", "1.21"],
    ["21.11.45", "1.21.11"],
    ["20.4.237", "1.20.4"],
    ["20.2.3-beta", "1.20.2"],
  ])("maps %s to Minecraft %s", (version, expected) => {
    expect(neoForgeMcVersion(version)).toBe(expected);
  });

  it.each([
    "26.1.0.0-alpha.1+snapshot-1",
    "26.1.0.0-alpha.15+pre-3",
    "26.4.0.0-rc.1",
    "0.25w14craftmine.3-beta",
    "not-a-version",
  ])("has no release mapping for %s", (version) => {
    expect(neoForgeMcVersion(version)).toBeUndefined();
  });
});

describe("neoForgeChannel", () => {
  it.each([
    ["26.2.0.88", "stable"],
    ["26.3.0.58-beta", "beta"],
    ["26.1.0.0-alpha.1", "alpha"],
    ["26.4.0.0-rc.1", "alpha"],
  ])("classifies %s as %s", (version, expected) => {
    expect(neoForgeChannel(version)).toBe(expected);
  });
});

describe("resolveNeoForge", () => {
  it("picks the highest build number, not the highest string", () => {
    const versions = ["26.3.0.57-beta", "26.3.0.58-beta", "26.3.0.9-beta"];
    expect(resolveNeoForge("26.3", versions)).toEqual({ version: "26.3.0.58-beta", channel: "beta" });
  });

  it("keeps patch releases separate from their base release", () => {
    const versions = ["26.1.2.113", "26.1.2.114", "26.1.0.5"];
    expect(resolveNeoForge("26.1.2", versions)?.version).toBe("26.1.2.114");
    expect(resolveNeoForge("26.1", versions)?.version).toBe("26.1.0.5");
    expect(resolveNeoForge("26.1", ["26.1.2.114"])).toBeUndefined();
  });

  it("does not let a pre-release tagged build stand in for a release", () => {
    expect(resolveNeoForge("26.1", ["26.1.0.0-alpha.15+pre-3"])).toBeUndefined();
  });

  it("resolves legacy versions", () => {
    expect(resolveNeoForge("1.21.11", ["21.11.44", "21.11.45", "21.1.256"])?.version).toBe("21.11.45");
  });

  it("returns undefined for unsupported versions", () => {
    expect(resolveNeoForge("1.19.4", ["21.1.256"])).toBeUndefined();
  });
});

describe("listNeoForgeMcVersions", () => {
  it("returns each supported Minecraft version once, newest first", () => {
    const versions = ["21.1.255", "21.1.256", "26.2.0.88", "26.3.0.58-beta", "26.1.0.0-alpha.1+snapshot-1"];
    expect(listNeoForgeMcVersions(versions)).toEqual(["26.3", "26.2", "1.21.1"]);
  });

  it("ignores pre-release tagged builds of a version that has not shipped", () => {
    expect(listNeoForgeMcVersions(["26.3.0.64-beta", "26.4.0.0-alpha.1+pre-1"])).toEqual(["26.3"]);
  });
});

describe("parseNeoForgeVersions", () => {
  it("reads the versions array", () => {
    expect(parseNeoForgeVersions({ versions: ["21.1.1", "21.1.2"] })).toEqual(["21.1.1", "21.1.2"]);
  });

  it("drops entries that are not plain version strings", () => {
    expect(parseNeoForgeVersions({ versions: ["21.1.1", "21.1.2\u001b[2K", "x y"] })).toEqual(["21.1.1"]);
  });

  it("rejects a response without versions", () => {
    expect(errorCodeOf(() => parseNeoForgeVersions({ versions: "nope" }))).toBe("BAD_RESPONSE");
  });

  it("parses the recorded list", () => {
    const versions = parseNeoForgeVersions(fixtureJson("neoforge-versions.json"));
    expect(versions.length).toBeGreaterThan(10);
    expect(listNeoForgeMcVersions(versions).length).toBeGreaterThan(2);
  });
});
